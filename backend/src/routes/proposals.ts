import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { requireRole } from "../auth.js";
import { publishProposal, isValidSlug } from "../proposals/engine.js";
import { sendMail } from "../mail/mailer.js";
import { PANEL_BASE_URL } from "../config.js";

interface LineItemInput {
  concept: string;
  quantity: number;
  unitPrice: number;
}

interface ProposalInput {
  clientId: string;
  title: string;
  status?: string;
  publicSlug?: string;
  sourceType?: "FOLDER" | "GITHUB";
  sourcePath?: string;
  sourceBranch?: string;
  validUntil?: string;
  notes?: string;
  lineItems?: LineItemInput[];
}

export async function proposalRoutes(app: FastifyInstance) {
  app.get("/api/proposals", async () => {
    return db.proposal.findMany({ include: { client: true, lineItems: true }, orderBy: { createdAt: "desc" } });
  });

  app.get<{ Params: { id: string } }>("/api/proposals/:id", async (req, reply) => {
    const proposal = await db.proposal.findUnique({
      where: { id: req.params.id },
      include: { client: true, lineItems: { orderBy: { position: "asc" } } },
    });
    if (!proposal) return reply.code(404).send({ error: "propuesta no encontrada" });
    return proposal;
  });

  app.post<{ Body: ProposalInput }>("/api/proposals", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const { lineItems, publicSlug, ...rest } = req.body;
    if (!rest.title?.trim() || !rest.clientId) return reply.code(400).send({ error: "título y cliente son obligatorios" });
    if (publicSlug && !isValidSlug(publicSlug)) {
      return reply.code(400).send({ error: "slug inválido o reservado (usa minúsculas, números y guiones)" });
    }
    const proposal = await db.proposal.create({
      data: {
        ...rest,
        publicSlug: publicSlug || undefined,
        validUntil: rest.validUntil ? new Date(rest.validUntil) : undefined,
        lineItems: lineItems ? { create: lineItems.map((li, i) => ({ ...li, position: i })) } : undefined,
      },
      include: { lineItems: true },
    });
    return proposal;
  });

  app.patch<{ Params: { id: string }; Body: ProposalInput }>(
    "/api/proposals/:id",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const { lineItems, publicSlug, ...rest } = req.body;
      if (publicSlug && !isValidSlug(publicSlug)) {
        return reply.code(400).send({ error: "slug inválido o reservado (usa minúsculas, números y guiones)" });
      }
      if (lineItems) {
        await db.proposalLineItem.deleteMany({ where: { proposalId: req.params.id } });
        await db.proposalLineItem.createMany({
          data: lineItems.map((li, i) => ({ ...li, proposalId: req.params.id, position: i })),
        });
      }
      return db.proposal.update({
        where: { id: req.params.id },
        data: {
          ...rest,
          publicSlug: publicSlug || undefined,
          validUntil: rest.validUntil ? new Date(rest.validUntil) : undefined,
        },
        include: { lineItems: true },
      });
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/proposals/:id",
    { preHandler: requireRole("ADMIN") },
    async (req) => {
      await db.proposalLineItem.deleteMany({ where: { proposalId: req.params.id } });
      await db.proposal.delete({ where: { id: req.params.id } });
      return { ok: true };
    }
  );

  app.post<{ Params: { id: string } }>(
    "/api/proposals/:id/send-email",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const proposal = await db.proposal.findUnique({ where: { id: req.params.id }, include: { client: true } });
      if (!proposal) return reply.code(404).send({ error: "propuesta no encontrada" });
      if (!proposal.client.email) return reply.code(400).send({ error: "el cliente no tiene email configurado" });
      if (!proposal.publicSlug || !proposal.servedAt) {
        return reply.code(400).send({ error: "la propuesta debe estar publicada antes de enviarla" });
      }
      if (!PANEL_BASE_URL) return reply.code(400).send({ error: "PANEL_BASE_URL no está configurado" });

      const url = `${PANEL_BASE_URL}/${proposal.publicSlug}`;
      await sendMail({
        to: proposal.client.email,
        subject: `Propuesta: ${proposal.title}`,
        html: `<p>Hola${proposal.client.contactName ? ` ${proposal.client.contactName}` : ""},</p><p>Aquí tienes la propuesta "${proposal.title}":</p><p><a href="${url}">${url}</a></p>`,
      });

      return db.proposal.update({ where: { id: proposal.id }, data: { emailSentAt: new Date() } });
    }
  );

  app.post<{ Params: { id: string } }>(
    "/api/proposals/:id/publish",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      try {
        await publishProposal(req.params.id);
        return { ok: true };
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    }
  );
}
