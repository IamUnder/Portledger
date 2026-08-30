import { db } from "../db.js";
import { containerStatus } from "../docker.js";
import { readCurrentMetrics } from "../metrics/collector.js";
import { getPreferencesForType, notifyUser } from "./service.js";

const CHECK_INTERVAL_MS = 5 * 60_000;

async function checkServices() {
  const prefs = await getPreferencesForType<{ excludedProjectIds: string[] }>("SERVICE_DOWN");
  const projects = await db.project.findMany({ include: { services: true } });

  for (const project of projects) {
    for (const service of project.services) {
      const status = await containerStatus(service.containerName ?? service.name);
      if (status === "running") continue;

      for (const [userId, pref] of prefs) {
        if (!pref.enabled || pref.config.excludedProjectIds?.includes(project.id)) continue;
        await notifyUser(userId, {
          type: "SERVICE_DOWN",
          title: `${project.name}: ${service.name} parado`,
          message: `El servicio "${service.name}" del proyecto "${project.name}" no está corriendo (estado: ${status}).`,
          link: `/projects/${project.id}`,
        });
      }
    }
  }
}

async function checkOverdueInvoices() {
  const prefs = await getPreferencesForType<{ graceDays: number }>("INVOICE_OVERDUE");
  const overdue = await db.invoice.findMany({
    where: { status: "SENT", dueDate: { lt: new Date() } },
    include: { client: true },
  });

  for (const invoice of overdue) {
    await db.invoice.update({ where: { id: invoice.id }, data: { status: "OVERDUE" } });
    const daysOverdue = (Date.now() - invoice.dueDate!.getTime()) / (24 * 60 * 60_000);

    for (const [userId, pref] of prefs) {
      if (!pref.enabled || daysOverdue < (pref.config.graceDays ?? 0)) continue;
      await notifyUser(userId, {
        type: "INVOICE_OVERDUE",
        title: `Factura ${invoice.invoiceNumber} vencida`,
        message: `La factura ${invoice.invoiceNumber} de ${invoice.client.name} (${invoice.total.toFixed(2)} €) ha vencido sin marcarse como pagada.`,
        link: `/facturas/${invoice.id}`,
      });
    }
  }
}

async function checkOverdueTasks() {
  const prefs = await getPreferencesForType<{ graceDays: number }>("TASK_OVERDUE");
  const overdue = await db.task.findMany({ where: { status: { not: "DONE" }, dueDate: { lt: new Date() } } });

  for (const task of overdue) {
    const daysOverdue = (Date.now() - task.dueDate!.getTime()) / (24 * 60 * 60_000);

    for (const [userId, pref] of prefs) {
      if (!pref.enabled || daysOverdue < (pref.config.graceDays ?? 0)) continue;
      await notifyUser(userId, {
        type: "TASK_OVERDUE",
        title: `Tarea vencida: ${task.title}`,
        message: `La tarea "${task.title}" venció el ${task.dueDate!.toLocaleDateString("es-ES")} y sigue sin completarse.`,
        link: "/tareas",
      });
    }
  }
}

async function checkStaleTimers() {
  const prefs = await getPreferencesForType<{ hoursThreshold: number }>("TIMER_STALE");
  const running = await db.timeEntry.findMany({ where: { endedAt: null }, include: { user: true } });

  for (const entry of running) {
    const hoursRunning = (Date.now() - entry.startedAt.getTime()) / (60 * 60_000);

    for (const [userId, pref] of prefs) {
      if (!pref.enabled || hoursRunning < (pref.config.hoursThreshold ?? 8)) continue;
      await notifyUser(userId, {
        type: "TIMER_STALE",
        title: `Cronómetro olvidado en marcha`,
        message: `El registro "${entry.description}" de ${entry.user.email} lleva más de ${Math.floor(hoursRunning)}h corriendo sin pararse.`,
        link: "/horas",
      });
    }
  }
}

async function checkResourceThresholds() {
  const metrics = await readCurrentMetrics();
  const usage = {
    CPU_HIGH: metrics.cpuPercent,
    MEMORY_HIGH: (metrics.memUsedMB / metrics.memTotalMB) * 100,
    DISK_HIGH: (metrics.diskUsedGB / metrics.diskTotalGB) * 100,
  } as const;
  const labels = { CPU_HIGH: "CPU", MEMORY_HIGH: "memoria", DISK_HIGH: "disco" } as const;

  for (const type of ["CPU_HIGH", "MEMORY_HIGH", "DISK_HIGH"] as const) {
    const prefs = await getPreferencesForType<{ thresholdPercent: number }>(type);
    const value = usage[type];
    for (const [userId, pref] of prefs) {
      if (!pref.enabled || value < (pref.config.thresholdPercent ?? 90)) continue;
      await notifyUser(userId, {
        type,
        title: `${labels[type]} por encima del umbral`,
        message: `El uso de ${labels[type]} del servidor está en ${value.toFixed(1)}%, por encima del umbral configurado (${pref.config.thresholdPercent}%).`,
        link: "/servidor",
      });
    }
  }
}

async function runChecks() {
  await checkServices().catch((err) => console.error("[notifications] fallo comprobando servicios:", err));
  await checkOverdueInvoices().catch((err) => console.error("[notifications] fallo comprobando facturas:", err));
  await checkOverdueTasks().catch((err) => console.error("[notifications] fallo comprobando tareas:", err));
  await checkStaleTimers().catch((err) => console.error("[notifications] fallo comprobando cronómetros:", err));
  await checkResourceThresholds().catch((err) => console.error("[notifications] fallo comprobando recursos:", err));
}

export function startNotificationChecks() {
  runChecks();
  setInterval(runChecks, CHECK_INTERVAL_MS);
}
