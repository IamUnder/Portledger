import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { requireRole } from "../auth.js";

interface RecurringInvoiceInput {
  clientId: string;
  concept: string;
  quantity?: number;
  unitPrice: number;
  vatRate?: number;
  dayOfMonth?: number;
  active?: boolean;
  notes?: string;
}

export async function recurringInvoiceRoutes(app: FastifyInstance) {
  app.get("/api/recurring-invoices", async () => {
    return db.recurringInvoice.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } });
  });

  app.post<{ Body: RecurringInvoiceInput }>(
    "/api/recurring-invoices",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const { clientId, concept, unitPrice } = req.body;
      if (!clientId || !concept?.trim() || unitPrice === undefined) {
        return reply.code(400).send({ error: "cliente, concepto e importe son obligatorios" });
      }
      const dayOfMonth = req.body.dayOfMonth ?? 1;
      if (dayOfMonth < 1 || dayOfMonth > 28) {
        return reply.code(400).send({ error: "el día del mes debe estar entre 1 y 28 (para que exista en cualquier mes)" });
      }
      return db.recurringInvoice.create({ data: req.body, include: { client: true } });
    }
  );

  app.patch<{ Params: { id: string }; Body: Partial<RecurringInvoiceInput> }>(
    "/api/recurring-invoices/:id",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const existing = await db.recurringInvoice.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.code(404).send({ error: "no encontrada" });
      if (req.body.dayOfMonth !== undefined && (req.body.dayOfMonth < 1 || req.body.dayOfMonth > 28)) {
        return reply.code(400).send({ error: "el día del mes debe estar entre 1 y 28" });
      }
      return db.recurringInvoice.update({ where: { id: req.params.id }, data: req.body, include: { client: true } });
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/recurring-invoices/:id",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const existing = await db.recurringInvoice.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.code(404).send({ error: "no encontrada" });
      await db.recurringInvoice.delete({ where: { id: req.params.id } });
      return { ok: true };
    }
  );
}
