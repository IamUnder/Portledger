import cron from "node-cron";
import { db } from "../db.js";
import { runCronJob } from "./engine.js";
import { notify } from "../notifications/service.js";

const tasks = new Map<string, cron.ScheduledTask>();

// runCronJob ya notifica sus propios fallos de fetch; esto cubre que falle antes de eso
// (p.ej. el job ya no existe en BBDD).
function reportSchedulerFailure(cronJobId: string, err: unknown) {
  console.error(`[automations] fallo ejecutando ${cronJobId}:`, err);
  notify({
    type: "AUTOMATION_FAILED",
    title: "Automatización: fallo antes de arrancar",
    message: `No se pudo iniciar la automatización programada (${cronJobId}): ${(err as Error).message}`,
    link: "/automatizaciones",
  }).catch((notifyErr) => console.error("[automations] fallo notificando el error:", notifyErr));
}

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
    runCronJob(cronJobId, "scheduled").catch((err) => reportSchedulerFailure(cronJobId, err));
  });
  tasks.set(cronJobId, task);
}

export function unschedule(cronJobId: string) {
  tasks.get(cronJobId)?.stop();
  tasks.delete(cronJobId);
}
