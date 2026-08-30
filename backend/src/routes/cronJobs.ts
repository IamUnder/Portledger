import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { runCronJob } from "../automations/engine.js";
import { schedule, unschedule } from "../automations/scheduler.js";

interface CronJobInput {
  name: string;
  url: string;
  method?: "GET" | "POST" | "PUT";
  headers?: string;
  body?: string;
  schedule: string;
  enabled?: boolean;
}

export async function cronJobRoutes(app: FastifyInstance) {
  app.get("/api/cron-jobs", async () => {
    return db.cronJob.findMany({ orderBy: { createdAt: "desc" } });
  });

  app.get<{ Params: { id: string } }>("/api/cron-jobs/:id/runs", async (req) => {
    return db.cronJobRun.findMany({
      where: { cronJobId: req.params.id },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
  });

  app.post<{ Body: CronJobInput }>("/api/cron-jobs", async (req, reply) => {
    const { name, url, schedule: cronExpr } = req.body;
    if (!name?.trim() || !url?.trim() || !cronExpr?.trim()) {
      return reply.code(400).send({ error: "nombre, URL y calendario son obligatorios" });
    }
    const job = await db.cronJob.create({ data: req.body });
    if (job.enabled) schedule(job.id, job.schedule);
    return job;
  });

  app.patch<{ Params: { id: string }; Body: Partial<CronJobInput> }>("/api/cron-jobs/:id", async (req) => {
    const job = await db.cronJob.update({ where: { id: req.params.id }, data: req.body });
    if (job.enabled) schedule(job.id, job.schedule);
    else unschedule(job.id);
    return job;
  });

  app.delete<{ Params: { id: string } }>("/api/cron-jobs/:id", async (req) => {
    unschedule(req.params.id);
    await db.cronJobRun.deleteMany({ where: { cronJobId: req.params.id } });
    await db.cronJob.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/cron-jobs/:id/run", async (req, reply) => {
    const job = await db.cronJob.findUnique({ where: { id: req.params.id } });
    if (!job) return reply.code(404).send({ error: "tarea no encontrada" });
    const runId = await runCronJob(job.id, "manual");
    return { runId };
  });
}
