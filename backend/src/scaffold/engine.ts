import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { db } from "../db.js";
import { runCommand } from "../exec.js";
import { generateCompose } from "./compose-generator.js";
import { createRemoteTunnel, getTunnelToken, getTunnelIngress, putTunnelIngress, ensureDnsRecord } from "../cloudflare/api.js";
import { ensureResticRepo } from "../backups/engine.js";
import { schedule } from "../backups/scheduler.js";
import { HOST_HOME, HOST_UID, HOST_GID } from "../config.js";
import type { ScaffoldSpec } from "./types.js";

function projectPath(name: string) {
  return path.join(HOST_HOME, name);
}

export async function startScaffold(spec: ScaffoldSpec): Promise<string> {
  const job = await db.scaffoldJob.create({ data: { name: spec.name, status: "running" } });
  runScaffoldWork(job.id, spec).catch((err) => console.error(`scaffold ${job.id} crashed:`, err));
  return job.id;
}

async function runScaffoldWork(jobId: string, spec: ScaffoldSpec) {
  let log = "";
  const append = async (text: string) => {
    log += text;
    await db.scaffoldJob.update({ where: { id: jobId }, data: { log } });
  };

  const root = projectPath(spec.name);

  try {
    if (existsSync(root)) {
      throw new Error(`${root} ya existe — elige otro nombre de proyecto`);
    }

    if (spec.composeSource) {
      // el repo entero ES la carpeta del proyecto (no una subcarpeta por servicio): así rutas
      // relativas tipo `context: .` dentro del compose que ya trae el repo siguen funcionando.
      await append(`\n$ git clone ${spec.composeSource.repoUrl} ${root}\n`);
      const args = ["clone", spec.composeSource.repoUrl, root];
      if (spec.composeSource.branch) args.push("-b", spec.composeSource.branch);
      const { code, output } = await runCommand("git", args);
      await append(output);
      if (code !== 0) throw new Error("git clone falló");
    } else {
      await append(`$ mkdir ${root}\n`);
      await fs.mkdir(root, { recursive: true });

      for (const svc of spec.services) {
        if (svc.kind !== "git" || !svc.repoUrl) continue;
        const dest = `${root}/${svc.key}`;
        await append(`\n$ git clone ${svc.repoUrl} ${dest}\n`);
        const args = ["clone", svc.repoUrl, dest];
        if (svc.branch) args.push("-b", svc.branch);
        const { code, output } = await runCommand("git", args);
        await append(output);
        if (code !== 0) throw new Error(`git clone falló para el servicio ${svc.key}`);
      }
    }

    let cloudflareAccount: { id: string; accountId: string; apiToken: string | null } | null = null;
    let tunnelToken: string | null = null;
    let tunnelRemoteId: string | null = null;
    // si se reutiliza un túnel ya existente, su contenedor ya está corriendo en otro proyecto:
    // no hace falta generar un bloque `tunnel:` propio ni un .env con token nuevo.
    let reusedTunnel: { id: string; tunnelId: string; name: string; containerName: string; account: { id: string; accountId: string; apiToken: string | null } } | null = null;

    if (spec.existingTunnelId) {
      const existing = await db.tunnel.findUnique({ where: { id: spec.existingTunnelId }, include: { account: true } });
      if (!existing) throw new Error("el túnel elegido para reutilizar ya no existe");
      reusedTunnel = existing;
      cloudflareAccount = existing.account;
      await append(`\n$ reutilizando túnel existente "${existing.name}"\n`);
    } else if (spec.cloudflareAccountId) {
      cloudflareAccount = await db.cloudflareAccount.findUnique({ where: { id: spec.cloudflareAccountId } });
      if (!cloudflareAccount?.apiToken) throw new Error("la cuenta de Cloudflare elegida no tiene API token");
      await append(`\n$ creando túnel de Cloudflare "${spec.name}-tunnel"...\n`);
      const remote = await createRemoteTunnel(cloudflareAccount.accountId, cloudflareAccount.apiToken, `${spec.name}-tunnel`);
      tunnelRemoteId = remote.id;
      tunnelToken = await getTunnelToken(cloudflareAccount.accountId, cloudflareAccount.apiToken, remote.id);
      await append(`  túnel creado: ${remote.id}\n`);
    }

    let composeFile: string;
    let envFile: string | null = null;
    if (spec.composeSource) {
      composeFile = path.join(root, spec.composeSource.composePath || "docker-compose.yml");
      if (!existsSync(composeFile)) {
        throw new Error(`el repo no tiene ningún fichero en ${spec.composeSource.composePath || "docker-compose.yml"}`);
      }
      // el contenido del .env viaja en el body de la petición como cualquier otro secreto que ya
      // maneja el panel (contraseñas de BBDD, tokens de túnel) — pero nunca se vuelca al log del
      // job (que sí queda guardado y visible), solo se dice cuántas líneas se escribieron.
      if (spec.composeSource.envContent?.trim()) {
        const lines = spec.composeSource.envContent.trim().split("\n").length;
        await append(`\n$ escribiendo .env (${lines} línea${lines === 1 ? "" : "s"})\n`);
        await fs.writeFile(path.join(root, ".env"), spec.composeSource.envContent.trim() + "\n", { mode: 0o600 });
      }
      // si no se dio contenido, puede que el repo ya traiga un .env comiteado (poco común pero
      // válido) — si tampoco hay eso, el siguiente paso (`docker compose up`) fallará con un
      // mensaje claro, y el repo ya clonado queda listo para retomarlo a mano.
      if (existsSync(path.join(root, ".env"))) envFile = path.join(root, ".env");
      if (tunnelToken) {
        await append(`\n$ añadiendo TUNNEL_TOKEN a .env\n`);
        await fs.appendFile(path.join(root, ".env"), `\nTUNNEL_TOKEN=${tunnelToken}\n`);
        envFile = path.join(root, ".env");
      }
    } else {
      const composeContent = generateCompose(spec, !!tunnelToken);
      composeFile = `${root}/docker-compose.yml`;
      await append(`\n$ escribiendo ${composeFile}\n`);
      await fs.writeFile(composeFile, composeContent, "utf-8");

      if (tunnelToken) {
        envFile = `${root}/.env`;
        await fs.writeFile(envFile, `TUNNEL_TOKEN=${tunnelToken}\n`, { mode: 0o600 });
      }
    }

    // todo lo anterior (mkdir, git clone, los ficheros escritos) corrió como root; sin esto,
    // el proyecto entero queda con dueño root en el host y el usuario no puede tocarlo a mano.
    await runCommand("chown", ["-R", `${HOST_UID}:${HOST_GID}`, root]);

    await append(`\n$ docker compose -p ${spec.name} up -d --build\n`);
    const composeArgs = ["compose", "-p", spec.name, "-f", composeFile];
    if (envFile) composeArgs.push("--env-file", envFile);
    composeArgs.push("up", "-d", "--build");
    const up = await runCommand("docker", composeArgs, { onData: append });
    if (up.code !== 0) throw new Error("docker compose up falló");

    // el compose generado por el propio asistente siempre declara una red `<nombre>-net`, así
    // que su nombre real (`<proyecto>_<nombre>-net`) es predecible — pero un compose traído de
    // fuera (composeSource) puede no declarar ninguna, y entonces Compose usa su red por
    // defecto (`<proyecto>_default`), o puede declarar varias con nombres cualquiera. En vez de
    // adivinar, se pregunta a Docker qué red(es) creó realmente para este proyecto.
    const projectNetworks = spec.composeSource
      ? (await runCommand("docker", ["network", "ls", "--filter", `label=com.docker.compose.project=${spec.name}`, "--format", "{{.Name}}"])).output
          .split("\n")
          .map((n) => n.trim())
          .filter(Boolean)
      : [`${spec.name}_${spec.name}-net`];
    if (projectNetworks.length === 0) {
      await append(`\n  aviso: no se encontró ninguna red creada para "${spec.name}" — el panel/túnel no se pudo conectar a ella\n`);
    }

    // conecta el propio panel a la(s) red(es) del proyecto nuevo, para poder llamar a sus
    // endpoints internos (logs, deploys y automatizaciones ya lo necesitan)
    for (const net of projectNetworks) {
      await append(`\n$ conectando el panel a la red ${net}\n`);
      const r = await runCommand("docker", ["network", "connect", net, "panel-backend"]);
      if (r.code !== 0) await append(`  aviso: no se pudo conectar (${r.output.trim()})\n`);
    }

    if (reusedTunnel) {
      for (const net of projectNetworks) {
        await append(`\n$ conectando el túnel reutilizado "${reusedTunnel.name}" a la red ${net}\n`);
        const r = await runCommand("docker", ["network", "connect", net, reusedTunnel.containerName]);
        if (r.code !== 0) await append(`  aviso: no se pudo conectar (${r.output.trim()})\n`);
      }
    }

    const project = await db.project.create({
      data: {
        name: spec.name,
        composeFile,
        envFile: envFile ?? undefined,
        hostname: spec.hostname,
      },
    });
    // se guarda ya aquí: si algo falla después (ingress, backups), el job no pierde la referencia
    await db.scaffoldJob.update({ where: { id: jobId }, data: { projectId: project.id } });

    for (const svc of spec.services) {
      await db.service.create({
        data: {
          projectId: project.id,
          name: svc.key,
          containerName: `${spec.name}-${svc.key}`,
          repoPath: svc.kind === "git" ? `${root}/${svc.key}` : undefined,
          repoUrl: svc.kind === "git" ? svc.repoUrl : undefined,
          branch: svc.kind === "git" ? svc.branch ?? "main" : undefined,
        },
      });

      if (svc.kind === "database") {
        await db.database.create({
          data: {
            projectId: project.id,
            label: "Base de datos principal",
            engine: svc.engine === "postgres" ? "POSTGRES" : "MYSQL",
            containerName: `${spec.name}-${svc.key}`,
            databaseName: svc.dbName!,
            username: svc.engine === "postgres" ? svc.dbUser! : "root",
            password: svc.dbPassword!,
          },
        });
      }
    }

    if (reusedTunnel || (cloudflareAccount && tunnelRemoteId)) {
      const tunnel =
        reusedTunnel ??
        (await db.tunnel.create({
          data: {
            cloudflareAccountId: cloudflareAccount!.id,
            name: `${spec.name}-tunnel`,
            tunnelId: tunnelRemoteId!,
            tunnelToken: tunnelToken!,
            containerName: `${spec.name}-tunnel`,
            dockerNetwork: `${spec.name}-net`,
          },
        }));

      const publicService = spec.composeSource
        ? spec.composeSource.publicServiceKey
          ? { key: spec.composeSource.publicServiceKey, port: spec.composeSource.publicServicePort ?? 80 }
          : undefined
        : spec.services.find((s) => s.isPublic);
      if (spec.hostname && publicService) {
        await append(`\n$ publicando ingress ${spec.hostname} -> ${publicService.key}:${publicService.port}\n`);
        const newRule = { hostname: spec.hostname, service: `http://${publicService.key}:${publicService.port}` };

        // si se reutiliza un túnel, ya puede tener otras reglas publicadas — se leen de Cloudflare
        // (no de la caché local) y se añade la nueva, en vez de machacarlas con putTunnelIngress.
        let existingRules: { hostname?: string; service: string }[] = [];
        if (reusedTunnel && cloudflareAccount?.apiToken) {
          try {
            existingRules = (
              await getTunnelIngress(cloudflareAccount.accountId, cloudflareAccount.apiToken, tunnel.tunnelId)
            ).filter((r) => r.hostname);
          } catch (err) {
            await append(`  aviso: no se pudo leer el ingress actual del túnel, se publicará solo la regla nueva (${(err as Error).message})\n`);
          }
        }
        const rules = [...existingRules, newRule, { service: "http_status:404" }];

        if (cloudflareAccount?.apiToken) {
          await putTunnelIngress(cloudflareAccount.accountId, cloudflareAccount.apiToken, tunnel.tunnelId, rules);
        }

        const basePosition = await db.ingressRule.count({ where: { tunnelId: tunnel.id, hostname: { not: null } } });
        await db.ingressRule.create({
          data: { tunnelId: tunnel.id, position: basePosition, hostname: spec.hostname, service: newRule.service },
        });
        const hasCatchAll = await db.ingressRule.findFirst({ where: { tunnelId: tunnel.id, hostname: null } });
        if (!hasCatchAll) {
          await db.ingressRule.create({
            data: { tunnelId: tunnel.id, position: basePosition + 1, hostname: null, service: "http_status:404" },
          });
        }

        if (cloudflareAccount?.apiToken) {
          try {
            await append(`\n$ creando registro DNS para ${spec.hostname}\n`);
            await ensureDnsRecord(cloudflareAccount.apiToken, spec.hostname, tunnel.tunnelId);
          } catch (err) {
            await append(`  aviso: no se pudo crear el DNS automáticamente (${(err as Error).message})\n`);
          }
        }
      }
    }

    if (spec.enableBackups) {
      const dbService = spec.services.find((s) => s.kind === "database");
      if (dbService) {
        await append(`\n$ configurando backups diarios para ${dbService.key}\n`);
        await ensureResticRepo(spec.name);
        const backupConfig = await db.backupConfig.create({
          data: {
            projectId: project.id,
            schedule: "0 3 * * *",
            resticPath: spec.name,
            targets: {
              create: [
                {
                  type: dbService.engine === "postgres" ? "POSTGRES" : "MYSQL",
                  containerName: `${spec.name}-${dbService.key}`,
                  database: dbService.dbName,
                  username: dbService.engine === "postgres" ? dbService.dbUser : "root",
                  password: dbService.dbPassword,
                },
              ],
            },
          },
        });
        schedule(backupConfig.id, backupConfig.schedule);
      }
    }

    await db.scaffoldJob.update({
      where: { id: jobId },
      data: { status: "success", projectId: project.id, finishedAt: new Date() },
    });
  } catch (err) {
    await append(`\nERROR: ${(err as Error).message}\n`);
    await db.scaffoldJob.update({ where: { id: jobId }, data: { status: "failed", finishedAt: new Date() } });
  }
}
