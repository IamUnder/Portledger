import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { runBackup, listSnapshots, ensureResticRepo, startRestore, type RestoreMode } from "../backups/engine.js";
import { schedule, unschedule } from "../backups/scheduler.js";

interface TargetInput {
  type: "MYSQL" | "POSTGRES" | "PATH" | "CONTAINER_PATH" | "SQLITE";
  containerName?: string;
  database?: string;
  username?: string;
  password?: string;
  containerPath?: string;
  hostPath?: string;
}

interface ConfigInput {
  schedule: string;
  enabled: boolean;
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
  resticPath: string;
  targets: TargetInput[];
}

export async function backupRoutes(app: FastifyInstance) {
  app.get<{ Params: { projectId: string } }>(
    "/api/projects/:projectId/backup-config",
    async (req, reply) => {
      const config = await db.backupConfig.findUnique({
        where: { projectId: req.params.projectId },
        include: { targets: true, runs: { orderBy: { startedAt: "desc" }, take: 10 } },
      });
      if (!config) return reply.code(404).send({ error: "sin configuración de backup" });
      return config;
    }
  );

  app.put<{ Params: { projectId: string }; Body: ConfigInput }>(
    "/api/projects/:projectId/backup-config",
    async (req) => {
      const { targets, ...rest } = req.body;
      const config = await db.backupConfig.upsert({
        where: { projectId: req.params.projectId },
        create: { projectId: req.params.projectId, ...rest },
        update: rest,
      });

      // reemplaza los targets enteros: más simple y suficiente para el volumen de datos que maneja esto
      await db.backupTarget.deleteMany({ where: { backupConfigId: config.id } });
      if (targets.length) {
        await db.backupTarget.createMany({
          data: targets.map((t) => ({ ...t, backupConfigId: config.id })),
        });
      }

      await ensureResticRepo(config.resticPath);
      if (config.enabled) schedule(config.id, config.schedule);
      else unschedule(config.id);

      return db.backupConfig.findUniqueOrThrow({ where: { id: config.id }, include: { targets: true } });
    }
  );

  app.delete<{ Params: { projectId: string } }>(
    "/api/projects/:projectId/backup-config",
    async (req, reply) => {
      const config = await db.backupConfig.findUnique({ where: { projectId: req.params.projectId } });
      if (!config) return reply.code(404).send({ error: "sin configuración de backup" });
      unschedule(config.id);
      await db.backupTarget.deleteMany({ where: { backupConfigId: config.id } });
      await db.backupRun.deleteMany({ where: { backupConfigId: config.id } });
      await db.restoreEvent.deleteMany({ where: { backupConfigId: config.id } });
      await db.backupConfig.delete({ where: { id: config.id } });
      return { ok: true };
    }
  );

  app.post<{ Params: { id: string } }>("/api/backup-configs/:id/run", async (req, reply) => {
    const config = await db.backupConfig.findUnique({ where: { id: req.params.id } });
    if (!config) return reply.code(404).send({ error: "configuración no encontrada" });
    runBackup(config.id, "manual").catch((err) => req.log.error(err));
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/api/backup-configs/:id/runs", async (req) => {
    return db.backupRun.findMany({
      where: { backupConfigId: req.params.id },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
  });

  app.get<{ Params: { id: string } }>("/api/backup-configs/:id/snapshots", async (req, reply) => {
    const config = await db.backupConfig.findUnique({ where: { id: req.params.id } });
    if (!config) return reply.code(404).send({ error: "configuración no encontrada" });
    try {
      const snapshots = await listSnapshots(config.resticPath);
      return { snapshots };
    } catch {
      return { snapshots: [] };
    }
  });

  app.post<{ Params: { id: string }; Body: { targetId: string; snapshotId: string; mode: RestoreMode } }>(
    "/api/backup-configs/:id/restore",
    async (req, reply) => {
      const config = await db.backupConfig.findUnique({ where: { id: req.params.id } });
      if (!config) return reply.code(404).send({ error: "configuración no encontrada" });
      const { targetId, snapshotId, mode } = req.body;
      const restoreId = await startRestore(config.id, targetId, snapshotId, mode);
      return { restoreId };
    }
  );

  app.get<{ Params: { id: string } }>("/api/backup-configs/:id/restores", async (req) => {
    return db.restoreEvent.findMany({
      where: { backupConfigId: req.params.id },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
  });
}
