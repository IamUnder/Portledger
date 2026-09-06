import path from "node:path";
import { promises as fs } from "node:fs";
import { runCommand } from "./exec.js";
import { HOST_HOME, PANEL_HOST_DIR } from "./config.js";

// Antes de `docker compose down`, cualquier contenedor ajeno al proyecto conectado a mano a su
// red (típicamente el túnel de Cloudflare reutilizado, ver scaffold/engine.ts) impide que Compose
// pueda borrar esa red — hay que desconectarlo primero, o el down falla o deja la red huérfana.
async function disconnectForeignContainers(projectName: string, append: (text: string) => Promise<void>) {
  const { output } = await runCommand("docker", [
    "network",
    "ls",
    "--filter",
    `label=com.docker.compose.project=${projectName}`,
    "--format",
    "{{.Name}}",
  ]);
  const networks = output.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const net of networks) {
    const inspect = await runCommand("docker", [
      "network",
      "inspect",
      net,
      "--format",
      "{{range .Containers}}{{.Name}}\n{{end}}",
    ]);
    const containers = inspect.output.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const containerName of containers) {
      if (containerName.startsWith(`${projectName}-`)) continue; // es del propio proyecto, compose lo gestiona
      await append(`\n$ desconectando "${containerName}" de la red "${net}" (no pertenece a este proyecto)\n`);
      await runCommand("docker", ["network", "disconnect", "-f", net, containerName]);
    }
  }
}

export async function wipeProjectFromServer(
  project: { name: string; composeFile: string; envFile: string | null },
  append: (text: string) => Promise<void>
) {
  await disconnectForeignContainers(project.name, append);

  const composeArgs = ["compose", "-p", project.name, "-f", project.composeFile];
  if (project.envFile) composeArgs.push("--env-file", project.envFile);
  composeArgs.push("down", "-v", "--remove-orphans");

  await append(`\n$ docker ${composeArgs.join(" ")}\n`);
  const down = await runCommand("docker", composeArgs, { onData: append });
  if (down.code !== 0) await append(`\naviso: "docker compose down" terminó con errores, continuando de todos modos\n`);

  const dir = path.resolve(path.dirname(project.composeFile));
  const forbidden = [path.resolve(HOST_HOME), path.resolve(PANEL_HOST_DIR), "/", "/home", "/root"];
  if (forbidden.includes(dir)) {
    await append(`\naviso: no se borra "${dir}" por seguridad (parece una carpeta raíz, no la del proyecto)\n`);
    return;
  }

  await append(`\n$ rm -rf ${dir}\n`);
  await fs.rm(dir, { recursive: true, force: true });
}

// Igual que arriba pero para UN solo servicio dentro de un proyecto que sigue existiendo — solo
// para el contenedor, nunca la carpeta del repo (puede estar compartida por otros servicios en un
// monorepo).
export async function wipeServiceFromServer(
  project: { name: string; composeFile: string; envFile: string | null },
  serviceName: string,
  append: (text: string) => Promise<void>
) {
  const composeArgs = ["compose", "-p", project.name, "-f", project.composeFile];
  if (project.envFile) composeArgs.push("--env-file", project.envFile);
  composeArgs.push("rm", "-sf", serviceName);

  await append(`\n$ docker ${composeArgs.join(" ")}\n`);
  await runCommand("docker", composeArgs, { onData: append });
}
