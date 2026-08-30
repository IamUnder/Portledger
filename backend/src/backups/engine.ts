import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../db.js";
import { runCommand, runCommandToFile, runCommandFromFile } from "../exec.js";
import { notify } from "../notifications/service.js";
import { RESTIC_BIN, RCLONE_BIN, RCLONE_CONFIG_PATH, RESTIC_PASSPHRASE_FILE, PANEL_HOST_DIR } from "../config.js";
import type { BackupTarget } from "@prisma/client";

const RESTIC_BASE = "rclone:gdrive:homelab-backups";
const TMP_ROOT = path.join(PANEL_HOST_DIR, "backup-tmp");

function resticEnv() {
  return {
    ...process.env,
    RESTIC_PASSWORD_FILE: RESTIC_PASSPHRASE_FILE,
    RCLONE_CONFIG: RCLONE_CONFIG_PATH,
  };
}

function resticRepo(resticPath: string) {
  return `${RESTIC_BASE}/${resticPath}`;
}

// identificador estable del target: NO se basa en su id de fila, porque guardar la
// configuración borra y recrea los targets (nuevos ids) aunque el usuario no cambie nada.
// Si se basara en el id, cada edición dejaría inaccesibles los snapshots anteriores.
function targetSlug(target: BackupTarget): string {
  const raw =
    target.type === "CONTAINER_PATH"
      ? `${target.containerName}-${target.containerPath}`
      : target.type === "SQLITE"
        ? target.hostPath!
        : `${target.database}`;
  return raw.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

// misma ruta que se usó al respaldar; hace falta reconstruirla igual para poder
// pedirle a restic justo ese fichero/carpeta de dentro del snapshot.
function targetBackupPath(configId: string, target: BackupTarget): string {
  const tmpDir = path.join(TMP_ROOT, configId);
  if (target.type === "MYSQL") return path.join(tmpDir, `mysql-${targetSlug(target)}.sql`);
  if (target.type === "POSTGRES") return path.join(tmpDir, `postgres-${targetSlug(target)}.dump`);
  if (target.type === "CONTAINER_PATH") return path.join(tmpDir, `containerpath-${targetSlug(target)}`);
  if (target.type === "SQLITE") return path.join(tmpDir, `sqlite-${targetSlug(target)}.sqlite`);
  return target.hostPath!;
}

export async function runBackup(configId: string, trigger: "scheduled" | "manual") {
  const config = await db.backupConfig.findUniqueOrThrow({
    where: { id: configId },
    include: { targets: true, project: true },
  });

  const run = await db.backupRun.create({
    data: { backupConfigId: config.id, status: "running", trigger },
  });

  let log = "";
  const append = async (text: string) => {
    log += text;
    await db.backupRun.update({ where: { id: run.id }, data: { log } });
  };

  const tmpDir = path.join(TMP_ROOT, config.id);
  await fs.mkdir(tmpDir, { recursive: true });
  const backupPaths: string[] = [];

  try {
    for (const target of config.targets) {
      if (target.type === "MYSQL") {
        const file = targetBackupPath(config.id, target);
        await append(`\n$ mysqldump ${target.database} (${target.containerName})\n`);
        const { code } = await runCommandToFile(
          "docker",
          [
            "exec",
            "-e",
            `MYSQL_PWD=${target.password}`,
            target.containerName!,
            "mysqldump",
            `-u${target.username}`,
            "--single-transaction",
            target.database!,
          ],
          file,
          { onStderr: append }
        );
        if (code !== 0) throw new Error(`mysqldump falló para ${target.database}`);
        backupPaths.push(file);
      } else if (target.type === "POSTGRES") {
        const file = targetBackupPath(config.id, target);
        await append(`\n$ pg_dump ${target.database} (${target.containerName})\n`);
        const { code } = await runCommandToFile(
          "docker",
          [
            "exec",
            "-e",
            `PGPASSWORD=${target.password}`,
            target.containerName!,
            "pg_dump",
            "-U",
            target.username!,
            "-Fc",
            target.database!,
          ],
          file,
          { onStderr: append }
        );
        if (code !== 0) throw new Error(`pg_dump falló para ${target.database}`);
        backupPaths.push(file);
      } else if (target.type === "SQLITE") {
        // usa la API de backup en caliente de sqlite (segura con escrituras concurrentes),
        // nunca una copia cruda del fichero que podría capturarlo a medio escribir.
        const file = targetBackupPath(config.id, target);
        await append(`\n$ sqlite3 ${target.hostPath} .backup\n`);
        const { code, output } = await runCommand("sqlite3", [target.hostPath!, `.backup ${file}`]);
        await append(output);
        if (code !== 0) throw new Error(`backup sqlite falló para ${target.hostPath}`);
        backupPaths.push(file);
      } else if (target.type === "CONTAINER_PATH") {
        const dest = targetBackupPath(config.id, target);
        await append(`\n$ docker cp ${target.containerName}:${target.containerPath} ...\n`);
        const { code } = await runCommand("docker", [
          "cp",
          `${target.containerName}:${target.containerPath}`,
          dest,
        ]);
        if (code !== 0) {
          await append("  (no se pudo copiar, se omite: puede que la ruta aún no exista)\n");
          continue;
        }
        backupPaths.push(dest);
      } else if (target.type === "PATH") {
        backupPaths.push(target.hostPath!);
      }
    }

    if (backupPaths.length === 0) {
      throw new Error("no hay nada que respaldar (0 rutas resueltas)");
    }

    const repo = resticRepo(config.resticPath);
    await append(`\n$ restic backup -> ${repo}\n`);
    const backupResult = await runCommand(
      RESTIC_BIN,
      ["-r", repo, "-o", `rclone.program=${RCLONE_BIN}`, "backup", ...backupPaths, "--tag", trigger],
      { env: resticEnv(), onData: append }
    );
    if (backupResult.code !== 0) throw new Error("restic backup falló");

    await append(`\n$ restic forget --prune\n`);
    await runCommand(
      RESTIC_BIN,
      [
        "-r",
        repo,
        "-o",
        `rclone.program=${RCLONE_BIN}`,
        "forget",
        "--keep-daily",
        String(config.keepDaily),
        "--keep-weekly",
        String(config.keepWeekly),
        "--keep-monthly",
        String(config.keepMonthly),
        "--prune",
      ],
      { env: resticEnv(), onData: append }
    );

    await db.backupRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date() },
    });
  } catch (err) {
    await append(`\nERROR: ${(err as Error).message}\n`);
    await db.backupRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date() },
    });
    await notify({
      type: "BACKUP_FAILED",
      title: `Backup fallido: ${config.project.name}`,
      message: `El backup programado de "${config.project.name}" ha fallado: ${(err as Error).message}`,
      link: "/backups",
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

export async function listSnapshots(resticPath: string) {
  const { code, output } = await runCommand(
    RESTIC_BIN,
    ["-r", resticRepo(resticPath), "-o", `rclone.program=${RCLONE_BIN}`, "snapshots", "--json"],
    { env: resticEnv() }
  );
  if (code !== 0) throw new Error("no se pudo leer el repositorio de backups");
  const jsonLine = output.split("\n").find((l) => l.trim().startsWith("["));
  return jsonLine ? JSON.parse(jsonLine) : [];
}

export async function ensureResticRepo(resticPath: string) {
  await runCommand(RESTIC_BIN, ["-r", resticRepo(resticPath), "-o", `rclone.program=${RCLONE_BIN}`, "init"], {
    env: resticEnv(),
  });
}

export type RestoreMode = "new_database" | "overwrite" | "sibling";

export async function startRestore(
  configId: string,
  targetId: string,
  snapshotId: string,
  mode: RestoreMode
): Promise<string> {
  const event = await db.restoreEvent.create({
    data: { backupConfigId: configId, targetId, snapshotId, mode, status: "running" },
  });
  runRestoreWork(event.id, configId, targetId, snapshotId, mode).catch((err) =>
    console.error(`restore ${event.id} crashed:`, err)
  );
  return event.id;
}

async function runRestoreWork(
  eventId: string,
  configId: string,
  targetId: string,
  snapshotId: string,
  mode: RestoreMode
) {
  const config = await db.backupConfig.findUniqueOrThrow({ where: { id: configId } });
  const target = await db.backupTarget.findUniqueOrThrow({ where: { id: targetId } });

  let log = "";
  const append = async (text: string) => {
    log += text;
    await db.restoreEvent.update({ where: { id: eventId }, data: { log } });
  };

  const extractDir = path.join(TMP_ROOT, `restore-${eventId}`);
  await fs.mkdir(extractDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  let resultPath = "";

  try {
    const originalPath = targetBackupPath(config.id, target);
    const repo = resticRepo(config.resticPath);

    await append(`\n$ restic restore ${snapshotId} --include ${originalPath}\n`);
    const restoreResult = await runCommand(
      RESTIC_BIN,
      [
        "-r",
        repo,
        "-o",
        `rclone.program=${RCLONE_BIN}`,
        "restore",
        snapshotId,
        "--target",
        extractDir,
        "--include",
        originalPath,
      ],
      { env: resticEnv(), onData: append }
    );
    if (restoreResult.code !== 0) throw new Error("restic restore falló");

    const extractedPath = path.join(extractDir, originalPath);

    if (target.type === "MYSQL") {
      const dbName = mode === "overwrite" ? target.database! : `${target.database}_restore_${timestamp}`;
      if (mode !== "overwrite") {
        await append(`\n$ CREATE DATABASE ${dbName}\n`);
        await runCommand(
          "docker",
          [
            "exec",
            "-e",
            `MYSQL_PWD=${target.password}`,
            target.containerName!,
            "mysql",
            `-u${target.username}`,
            "-e",
            `CREATE DATABASE IF NOT EXISTS \`${dbName}\``,
          ],
          { onData: append }
        );
      }
      await append(`\n$ mysql ${dbName} < ${originalPath}\n`);
      const { code } = await runCommandFromFile(
        "docker",
        ["exec", "-i", "-e", `MYSQL_PWD=${target.password}`, target.containerName!, "mysql", `-u${target.username}`, dbName],
        extractedPath,
        { onData: append }
      );
      if (code !== 0) throw new Error("mysql restore falló");
      resultPath = dbName;
    } else if (target.type === "POSTGRES") {
      const dbName = mode === "overwrite" ? target.database! : `${target.database}_restore_${timestamp}`;
      if (mode !== "overwrite") {
        await append(`\n$ createdb ${dbName}\n`);
        await runCommand(
          "docker",
          ["exec", "-e", `PGPASSWORD=${target.password}`, target.containerName!, "createdb", "-U", target.username!, dbName],
          { onData: append }
        );
      }
      await append(`\n$ pg_restore -d ${dbName} < ${originalPath}\n`);
      const { code } = await runCommandFromFile(
        "docker",
        [
          "exec",
          "-i",
          "-e",
          `PGPASSWORD=${target.password}`,
          target.containerName!,
          "pg_restore",
          "-U",
          target.username!,
          "-d",
          dbName,
          "--clean",
          "--if-exists",
        ],
        extractedPath,
        { onData: append }
      );
      if (code !== 0) throw new Error("pg_restore falló");
      resultPath = dbName;
    } else if (target.type === "CONTAINER_PATH") {
      const dest = `${target.containerPath}-restored-${timestamp}`;
      await append(`\n$ docker cp -> ${target.containerName}:${dest}\n`);
      const { code } = await runCommand("docker", ["cp", extractedPath, `${target.containerName}:${dest}`]);
      if (code !== 0) throw new Error("docker cp de restauración falló");
      resultPath = `${target.containerName}:${dest}`;
    } else if (target.type === "PATH") {
      resultPath = `${target.hostPath}-restored-${timestamp}`;
      await append(`\n$ cp -r -> ${resultPath}\n`);
      await fs.cp(extractedPath, resultPath, { recursive: true });
    }

    await db.restoreEvent.update({
      where: { id: eventId },
      data: { status: "success", resultPath, finishedAt: new Date() },
    });
  } catch (err) {
    await append(`\nERROR: ${(err as Error).message}\n`);
    await db.restoreEvent.update({ where: { id: eventId }, data: { status: "failed", finishedAt: new Date() } });
  } finally {
    await fs.rm(extractDir, { recursive: true, force: true });
  }
}
