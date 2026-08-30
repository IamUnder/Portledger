import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { requireRole } from "../auth.js";

interface DeliveryNoteInput {
  clientId: string;
  projectId?: string;
  date?: string;
  concept: string;
  quantity?: number;
  unitPrice: number;
  vatRate?: number;
}

export async function deliveryNoteRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { clientId?: string; status?: string } }>("/api/delivery-notes", async (req) => {
    return db.deliveryNote.findMany({
      where: { clientId: req.query.clientId, status: req.query.status },
      include: { client: true, project: true, invoice: true },
      orderBy: { date: "desc" },
    });
  });

  app.post<{ Body: DeliveryNoteInput }>(
    "/api/delivery-notes",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const { clientId, concept, unitPrice } = req.body;
      if (!clientId || !concept?.trim() || unitPrice === undefined) {
        return reply.code(400).send({ error: "cliente, concepto e importe son obligatorios" });
      }
      return db.deliveryNote.create({
        data: { ...req.body, date: req.body.date ? new Date(req.body.date) : undefined },
      });
    }
  );

  app.patch<{ Params: { id: string }; Body: Partial<DeliveryNoteInput> }>(
    "/api/delivery-notes/:id",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const existing = await db.deliveryNote.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.code(404).send({ error: "albarán no encontrado" });
      if (existing.status === "INVOICED") return reply.code(400).send({ error: "ya está facturado, no se puede editar" });
      return db.deliveryNote.update({
        where: { id: req.params.id },
        data: { ...req.body, date: req.body.date ? new Date(req.body.date) : undefined },
      });
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/delivery-notes/:id",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const existing = await db.deliveryNote.findUnique({ where: { id: req.params.id }, include: { timeEntries: true } });
      if (!existing) return reply.code(404).send({ error: "albarán no encontrado" });
      if (existing.status === "INVOICED") return reply.code(400).send({ error: "ya está facturado, no se puede eliminar" });
      if (existing.timeEntries.length > 0) {
        return reply.code(400).send({ error: "generado desde registros de horas, no se puede eliminar" });
      }
      await db.deliveryNote.delete({ where: { id: req.params.id } });
      return { ok: true };
    }
  );
}
