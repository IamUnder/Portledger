import cron from "node-cron";
import { db } from "../db.js";
import { runBackup } from "./engine.js";

const tasks = new Map<string, cron.ScheduledTask>();

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
    runBackup(configId, "scheduled").catch((err) =>
      console.error(`[backups] fallo ejecutando backup ${configId}:`, err)
    );
  });
  tasks.set(configId, task);
}

export function unschedule(configId: string) {
  tasks.get(configId)?.stop();
  tasks.delete(configId);
}
