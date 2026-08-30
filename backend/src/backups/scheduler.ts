import cron from "node-cron";
import { db } from "../db.js";
import { runBackup } from "./engine.js";
import { notify } from "../notifications/service.js";

const tasks = new Map<string, cron.ScheduledTask>();

// red de seguridad: runBackup ya notifica sus propios fallos, pero si revienta ANTES de
// llegar a su try/catch interno (p.ej. el config ya no existe en BBDD), aquí no se pierde.
function reportSchedulerFailure(configId: string, err: unknown) {
  console.error(`[backups] fallo ejecutando backup ${configId}:`, err);
  notify({
    type: "BACKUP_FAILED",
    title: "Backup: fallo antes de arrancar",
    message: `No se pudo iniciar el backup programado (${configId}): ${(err as Error).message}`,
    link: "/backups",
  }).catch((notifyErr) => console.error("[backups] fallo notificando el error:", notifyErr));
}

export async function loadAllSchedules() {
  const configs = await db.backupConfig.findMany({ where: { enabled: true } });
  for (const config of configs) schedule(config.id, config.schedule);
}

export function schedule(configId: string, cronExpr: string) {
  unschedule(configId);
  if (!cron.validate(cronExpr)) {
    console.error(`[backups] expresión cron inválida para ${configId}: ${cronExpr}`);
    return;
  }
  const task = cron.schedule(cronExpr, () => {
    runBackup(configId, "scheduled").catch((err) => reportSchedulerFailure(configId, err));
  });
  tasks.set(configId, task);
}

export function unschedule(configId: string) {
  tasks.get(configId)?.stop();
  tasks.delete(configId);
}
