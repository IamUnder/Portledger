import { db } from "./db.js";
import { runCommand } from "./exec.js";
import { HOST_UID, HOST_GID } from "./config.js";
import type { Service, Project } from "@prisma/client";

export async function listRemoteBranches(
  repoPath: string
): Promise<{ branches: string[]; fetchError: string | null }> {
  const fetch = await runCommand("git", ["fetch", "--prune", "origin"], { cwd: repoPath });
  const { output } = await runCommand("git", ["branch", "-r", "--format=%(refname:short)"], {
    cwd: repoPath,
  });
  const branches = output
    .split("\n")
    .map((l) => l.trim().replace(/^origin\//, ""))
    .filter((l) => l && l !== "HEAD");
  // si el fetch falla (típicamente falta de credenciales para un remoto privado), no lo tapamos:
  // las ramas que se devuelven son las que ya había en local, potencialmente desactualizadas.
  return { branches, fetchError: fetch.code === 0 ? null : fetch.output.trim().split("\n").pop() || "git fetch falló" };
}

export async function startDeploy(
  service: Service & { project: Project },
  branch: string,
  trigger: "manual" | "webhook"
): Promise<string> {
  const deployEvent = await db.deployEvent.create({
    data: { serviceId: service.id, branch, status: "running", trigger },
  });
  runDeployWork(deployEvent.id, service, branch).catch((err) =>
    console.error(`deploy ${deployEvent.id} crashed:`, err)
  );
  return deployEvent.id;
}

async function runDeployWork(
  deployEventId: string,
  service: Service & { project: Project },
  branch: string
) {
  let logBuffer = "";
  const append = async (text: string) => {
    logBuffer += text;
    await db.deployEvent.update({ where: { id: deployEventId }, data: { log: logBuffer } });
  };

  try {
    if (service.repoPath) {
      await append(`\n$ git checkout ${branch} && git pull\n`);
      const checkout = await runCommand("git", ["checkout", branch], {
        cwd: service.repoPath,
        onData: append,
      });
      if (checkout.code !== 0) throw new Error("git checkout falló");

      const pull = await runCommand("git", ["pull", "origin", branch], {
        cwd: service.repoPath,
        onData: append,
      });
      if (pull.code !== 0) throw new Error("git pull falló");

      // git corre como root aquí dentro; sin esto, cualquier fichero que el pull toque en el
      // host queda con dueño root y el usuario real no puede editarlo luego a mano.
      await runCommand("chown", ["-R", `${HOST_UID}:${HOST_GID}`, service.repoPath]);

      const { output: sha } = await runCommand("git", ["rev-parse", "--short", "HEAD"], {
        cwd: service.repoPath,
      });
      await db.deployEvent.update({
        where: { id: deployEventId },
        data: { commitSha: sha.trim() },
      });
    }

    const composeArgs = [
      "compose",
      "-p",
      service.project.name,
      "-f",
      service.project.composeFile,
    ];
    if (service.project.envFile) composeArgs.push("--env-file", service.project.envFile);
    composeArgs.push("up", "-d", "--build", service.name);

    await append(`\n$ docker ${composeArgs.join(" ")}\n`);
    const buildUp = await runCommand("docker", composeArgs, { onData: append });
    if (buildUp.code !== 0) throw new Error("docker compose up falló");

    await db.service.update({ where: { id: service.id }, data: { branch } });
    await db.deployEvent.update({
      where: { id: deployEventId },
      data: { status: "success", finishedAt: new Date() },
    });
  } catch (err) {
    await append(`\nERROR: ${(err as Error).message}\n`);
    await db.deployEvent.update({
      where: { id: deployEventId },
      data: { status: "failed", finishedAt: new Date() },
    });
  }
}
