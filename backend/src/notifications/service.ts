import { db } from "../db.js";
import { sendMail } from "../mail/mailer.js";
import { renderEmailTemplate } from "../mail/templates.js";
import { PANEL_BASE_URL } from "../config.js";

export type NotificationType =
  | "BACKUP_FAILED"
  | "SERVICE_DOWN"
  | "INVOICE_OVERDUE"
  | "TASK_OVERDUE"
  | "TIMER_STALE"
  | "DNS_WARNING"
  | "CPU_HIGH"
  | "MEMORY_HIGH"
  | "DISK_HIGH"
  | "RECURRING_INVOICE_GENERATED"
  | "AUTOMATION_FAILED";

export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";

export type ConfigField =
  | { key: string; kind: "number"; label: string; unit?: string; default: number; min?: number; max?: number }
  | { key: string; kind: "projectMultiSelect"; label: string; default: string[] };

// Catálogo estático de tipos de notificación: los tipos en sí están fijos en código (no se
// crean tipos nuevos desde la web), pero cada usuario puede activar/desactivar cada uno,
// decidir si además quiere email, y ajustar sus "configFields" (umbral, margen de días,
// proyectos excluidos...) para adaptar cuándo salta exactamente. Así se personaliza el
// comportamiento sin necesitar un constructor de reglas genérico.
export const NOTIFICATION_TYPES: {
  type: NotificationType;
  label: string;
  description: string;
  severity: NotificationSeverity;
  defaultEnabled: boolean;
  defaultEmail: boolean;
  configFields?: ConfigField[];
}[] = [
  {
    type: "BACKUP_FAILED",
    label: "Backup fallido",
    description: "Un backup programado ha terminado en error",
    severity: "CRITICAL",
    defaultEnabled: true,
    defaultEmail: true,
  },
  {
    type: "SERVICE_DOWN",
    label: "Servicio caído",
    description: "Un contenedor de un proyecto no está corriendo",
    severity: "CRITICAL",
    defaultEnabled: true,
    defaultEmail: true,
    configFields: [
      { key: "excludedProjectIds", kind: "projectMultiSelect", label: "No avisar de estos proyectos", default: [] },
    ],
  },
  {
    type: "INVOICE_OVERDUE",
    label: "Factura vencida",
    description: "Una factura enviada ha superado su fecha de vencimiento sin cobrarse",
    severity: "WARNING",
    defaultEnabled: true,
    defaultEmail: false,
    configFields: [
      { key: "graceDays", kind: "number", label: "Días de margen antes de avisar", unit: "días", default: 0, min: 0, max: 60 },
    ],
  },
  {
    type: "TASK_OVERDUE",
    label: "Tarea vencida",
    description: "Una tarea ha superado su fecha límite sin completarse",
    severity: "WARNING",
    defaultEnabled: true,
    defaultEmail: false,
    configFields: [
      { key: "graceDays", kind: "number", label: "Días de margen antes de avisar", unit: "días", default: 0, min: 0, max: 60 },
    ],
  },
  {
    type: "TIMER_STALE",
    label: "Cronómetro olvidado",
    description: "Un registro de horas lleva demasiado tiempo en marcha sin pararse",
    severity: "WARNING",
    defaultEnabled: true,
    defaultEmail: false,
    configFields: [
      { key: "hoursThreshold", kind: "number", label: "Horas en marcha antes de avisar", unit: "h", default: 8, min: 1, max: 48 },
    ],
  },
  {
    type: "DNS_WARNING",
    label: "Aviso DNS en túnel",
    description: "Al publicar un túnel, no se pudo crear/actualizar el registro DNS de algún hostname",
    severity: "WARNING",
    defaultEnabled: true,
    defaultEmail: false,
  },
  {
    type: "CPU_HIGH",
    label: "CPU alta",
    description: "El uso de CPU del servidor supera el umbral configurado",
    severity: "WARNING",
    defaultEnabled: false,
    defaultEmail: false,
    configFields: [{ key: "thresholdPercent", kind: "number", label: "Umbral", unit: "%", default: 90, min: 1, max: 100 }],
  },
  {
    type: "MEMORY_HIGH",
    label: "Memoria alta",
    description: "El uso de RAM del servidor supera el umbral configurado",
    severity: "WARNING",
    defaultEnabled: false,
    defaultEmail: false,
    configFields: [{ key: "thresholdPercent", kind: "number", label: "Umbral", unit: "%", default: 90, min: 1, max: 100 }],
  },
  {
    type: "DISK_HIGH",
    label: "Disco alto",
    description: "El uso de disco del servidor supera el umbral configurado",
    severity: "WARNING",
    defaultEnabled: false,
    defaultEmail: false,
    configFields: [{ key: "thresholdPercent", kind: "number", label: "Umbral", unit: "%", default: 85, min: 1, max: 100 }],
  },
  {
    type: "RECURRING_INVOICE_GENERATED",
    label: "Factura recurrente generada",
    description: "Se ha creado automáticamente el borrador de una factura recurrente, pendiente de revisar y confirmar",
    severity: "INFO",
    defaultEnabled: true,
    defaultEmail: false,
  },
  {
    type: "AUTOMATION_FAILED",
    label: "Automatización fallida",
    description: "Una automatización programada (cron job) ha terminado en error, o la generación de una factura recurrente ha fallado",
    severity: "CRITICAL",
    defaultEnabled: true,
    defaultEmail: true,
  },
];

const CATALOG = new Map(NOTIFICATION_TYPES.map((t) => [t.type, t]));

function defaultConfig(type: NotificationType): Record<string, unknown> {
  const def = CATALOG.get(type)!;
  const config: Record<string, unknown> = {};
  for (const field of def.configFields ?? []) config[field.key] = field.default;
  return config;
}

export interface EffectivePreference<T = Record<string, unknown>> {
  enabled: boolean;
  emailEnabled: boolean;
  config: T;
}

// Preferencias efectivas de TODOS los usuarios para un tipo, fusionadas con sus valores por
// defecto. Pensado para que un chequeo periódico recorra usuarios x entidades sin N+1 queries.
export async function getPreferencesForType<T = Record<string, unknown>>(
  type: NotificationType
): Promise<Map<string, EffectivePreference<T>>> {
  const def = CATALOG.get(type)!;
  const users = await db.user.findMany();
  const prefs = await db.notificationPreference.findMany({ where: { type } });
  const byUser = new Map(prefs.map((p) => [p.userId, p]));
  const result = new Map<string, EffectivePreference<T>>();
  for (const user of users) {
    const pref = byUser.get(user.id);
    let config = defaultConfig(type);
    if (pref?.config) {
      try {
        config = { ...config, ...JSON.parse(pref.config) };
      } catch {
        // config corrupta: se ignora y se usan los valores por defecto
      }
    }
    result.set(user.id, {
      enabled: pref?.enabled ?? def.defaultEnabled,
      emailEnabled: pref?.emailEnabled ?? def.defaultEmail,
      config: config as T,
    });
  }
  return result;
}

async function deliver(userId: string, type: NotificationType, title: string, message: string, link?: string) {
  const def = CATALOG.get(type)!;
  const existing = await db.notification.findFirst({
    where: { userId, type, link: link ?? null, read: false },
  });
  if (existing) return;

  const notification = await db.notification.create({
    data: { userId, type, severity: def.severity, title, message, link },
  });

  const pref = await db.notificationPreference.findUnique({ where: { userId_type: { userId, type } } });
  const emailEnabled = pref?.emailEnabled ?? def.defaultEmail;
  if (!emailEnabled) return;

  try {
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const url = link && PANEL_BASE_URL ? `${PANEL_BASE_URL}${link}` : undefined;
    const { subject, html } = await renderEmailTemplate("notification", {
      titulo: title,
      mensaje: message,
      enlace_html: url ? `<p><a href="${url}">Ver en el panel</a></p>` : "",
    });
    await sendMail({ to: user.email, subject, html });
    await db.notification.update({ where: { id: notification.id }, data: { emailedAt: new Date() } });
  } catch (err) {
    console.error("[notifications] fallo enviando email:", err);
  }
}

// Notifica a un usuario concreto ya elegido por el chequeo (porque su configuración
// personalizada — umbral, margen, exclusiones — hizo que aplicara para él).
export async function notifyUser(userId: string, input: { type: NotificationType; title: string; message: string; link?: string }) {
  await deliver(userId, input.type, input.title, input.message, input.link);
}

// Notifica a todos los usuarios que tengan el tipo activado, con el mismo mensaje para todos.
// Válido para eventos que no dependen de configuración personalizada (backup fallido, aviso DNS).
export async function notify(input: { type: NotificationType; title: string; message: string; link?: string }) {
  const def = CATALOG.get(input.type)!;
  const users = await db.user.findMany();
  const prefs = await db.notificationPreference.findMany({ where: { type: input.type } });
  const prefByUser = new Map(prefs.map((p) => [p.userId, p]));

  for (const user of users) {
    const enabled = prefByUser.get(user.id)?.enabled ?? def.defaultEnabled;
    if (!enabled) continue;
    await deliver(user.id, input.type, input.title, input.message, input.link);
  }
}
