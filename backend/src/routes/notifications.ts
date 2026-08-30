import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { NOTIFICATION_TYPES, type NotificationType } from "../notifications/service.js";

export async function notificationRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { unreadOnly?: string } }>("/api/notifications", async (req) => {
    return db.notification.findMany({
      where: { userId: req.user!.id, read: req.query.unreadOnly === "true" ? false : undefined },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  app.get("/api/notifications/unread-count", async (req) => {
    const count = await db.notification.count({ where: { userId: req.user!.id, read: false } });
    return { count };
  });

  app.post<{ Params: { id: string } }>("/api/notifications/:id/read", async (req, reply) => {
    const notification = await db.notification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.userId !== req.user!.id) return reply.code(404).send({ error: "no encontrada" });
    return db.notification.update({ where: { id: req.params.id }, data: { read: true } });
  });

  app.post("/api/notifications/read-all", async (req) => {
    await db.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
    return { ok: true };
  });

  // catálogo estático de tipos fusionado con las preferencias guardadas del usuario actual
  app.get("/api/notification-preferences", async (req) => {
    const prefs = await db.notificationPreference.findMany({ where: { userId: req.user!.id } });
    const byType = new Map(prefs.map((p) => [p.type, p]));
    return NOTIFICATION_TYPES.map((t) => {
      const saved = byType.get(t.type);
      const defaultConfig = Object.fromEntries((t.configFields ?? []).map((f) => [f.key, f.default]));
      let config = defaultConfig;
      if (saved?.config) {
        try {
          config = { ...defaultConfig, ...JSON.parse(saved.config) };
        } catch {
          config = defaultConfig;
        }
      }
      return {
        type: t.type,
        label: t.label,
        description: t.description,
        severity: t.severity,
        configFields: t.configFields ?? [],
        enabled: saved?.enabled ?? t.defaultEnabled,
        emailEnabled: saved?.emailEnabled ?? t.defaultEmail,
        config,
      };
    });
  });

  app.put<{ Params: { type: string }; Body: { enabled: boolean; emailEnabled: boolean; config?: Record<string, unknown> } }>(
    "/api/notification-preferences/:type",
    async (req, reply) => {
      const catalogEntry = NOTIFICATION_TYPES.find((t) => t.type === req.params.type);
      if (!catalogEntry) return reply.code(400).send({ error: "tipo desconocido" });
      const { enabled, emailEnabled, config } = req.body;
      const configJson = config !== undefined ? JSON.stringify(config) : undefined;
      return db.notificationPreference.upsert({
        where: { userId_type: { userId: req.user!.id, type: req.params.type as NotificationType } },
        create: { userId: req.user!.id, type: req.params.type, enabled, emailEnabled, config: configJson },
        update: { enabled, emailEnabled, config: configJson },
      });
    }
  );
}
