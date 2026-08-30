import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { requireRole } from "../auth.js";

export async function clientRoutes(app: FastifyInstance) {
  app.get("/api/clients", async () => {
    return db.client.findMany({
      include: { proposals: true, project: true },
      orderBy: { createdAt: "desc" },
    });
  });

  app.get<{ Params: { id: string } }>("/api/clients/:id", async (req, reply) => {
    const client = await db.client.findUnique({
      where: { id: req.params.id },
      include: { proposals: { include: { lineItems: true } }, project: true },
    });
    if (!client) return reply.code(404).send({ error: "cliente no encontrado" });
    return client;
  });

  app.post<{
    Body: {
      name: string;
      contactName?: string;
      email?: string;
      phone?: string;
      taxId?: string;
      address?: string;
      city?: string;
      postalCode?: string;
      province?: string;
      country?: string;
      status?: string;
      notes?: string;
      defaultHourlyRate?: number;
      projectId?: string;
    };
  }>("/api/clients", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    if (!req.body.name?.trim()) return reply.code(400).send({ error: "el nombre es obligatorio" });
    return db.client.create({ data: req.body });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/api/clients/:id",
    { preHandler: requireRole("ADMIN") },
    async (req) => {
      return db.client.update({ where: { id: req.params.id }, data: req.body });
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/clients/:id",
    { preHandler: requireRole("ADMIN") },
    async (req) => {
      const proposalIds = (await db.proposal.findMany({ where: { clientId: req.params.id }, select: { id: true } })).map(
        (p) => p.id
      );
      await db.proposalLineItem.deleteMany({ where: { proposalId: { in: proposalIds } } });
      await db.proposal.deleteMany({ where: { clientId: req.params.id } });

      const invoiceIds = (await db.invoice.findMany({ where: { clientId: req.params.id }, select: { id: true } })).map(
        (i) => i.id
      );
      await db.timeEntry.updateMany({ where: { clientId: req.params.id }, data: { deliveryNoteId: null } });
      await db.deliveryNote.deleteMany({ where: { clientId: req.params.id } });
      await db.invoiceLineItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await db.invoice.deleteMany({ where: { clientId: req.params.id } });
      await db.timeEntry.deleteMany({ where: { clientId: req.params.id } });

      await db.client.delete({ where: { id: req.params.id } });
      return { ok: true };
    }
  );
}
