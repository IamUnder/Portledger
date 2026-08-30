import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { requireRole } from "../auth.js";
import { EMAIL_TEMPLATES } from "../mail/templates.js";

export async function emailTemplateRoutes(app: FastifyInstance) {
  // catálogo fusionado con los overrides guardados: cada entrada trae ya su default de código
  // más lo que el usuario haya personalizado (o null si nunca lo tocó).
  app.get("/api/email-templates", async () => {
    const overrides = await db.emailTemplate.findMany();
    const byKey = new Map(overrides.map((o) => [o.key, o]));
    return EMAIL_TEMPLATES.map((t) => ({
      key: t.key,
      label: t.label,
      description: t.description,
      variables: t.variables,
      defaultSubject: t.defaultSubject,
      defaultBody: t.defaultBody,
      subject: byKey.get(t.key)?.subject ?? null,
      body: byKey.get(t.key)?.body ?? null,
    }));
  });

  app.put<{ Params: { key: string }; Body: { subject: string; body: string } }>(
    "/api/email-templates/:key",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      if (!EMAIL_TEMPLATES.some((t) => t.key === req.params.key)) {
        return reply.code(400).send({ error: "plantilla desconocida" });
      }
      const { subject, body } = req.body;
      return db.emailTemplate.upsert({
        where: { key: req.params.key },
        create: { key: req.params.key, subject, body },
        update: { subject, body },
      });
    }
  );

  app.delete<{ Params: { key: string } }>(
    "/api/email-templates/:key",
    { preHandler: requireRole("ADMIN") },
    async (req) => {
      await db.emailTemplate.deleteMany({ where: { key: req.params.key } });
      return { ok: true };
    }
  );
}
