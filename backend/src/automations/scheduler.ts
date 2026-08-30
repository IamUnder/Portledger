import cron from "node-cron";
import { db } from "../db.js";
import { runCronJob } from "./engine.js";

const tasks = new Map<string, cron.ScheduledTask>();

export async function loadAllCronSchedules() {
  const jobs = await db.cronJob.findMany({ where: { enabled: true } });
  for (const job of jobs) schedule(job.id, job.schedule);
}

export function schedule(cronJobId: string, cronExpr: string) {
  unschedule(cronJobId);
  if (!cron.validate(cronExpr)) {
    console.error(`[automations] expresión cron inválida para ${cronJobId}: ${cronExpr}`);
    return;
  }
  const task = cron.schedule(cronExpr, () => {
    runCronJob(cronJobId, "scheduled").catch((err) =>
      console.error(`[automations] fallo ejecutando ${cronJobId}:`, err)
    );
  });
  tasks.set(cronJobId, task);
}

export function unschedule(cronJobId: string) {
  tasks.get(cronJobId)?.stop();
  tasks.delete(cronJobId);
}
