import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { requireRole } from "../auth.js";
import { nextInvoiceNumber, generateInvoicePdf, getCompanySettings } from "../invoices/engine.js";
import { sendMail } from "../mail/mailer.js";

interface LineItemInput {
  concept: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

function computeTotals(lineItems: LineItemInput[]) {
  const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const vatAmount = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice * (li.vatRate / 100), 0);
  return { subtotal, vatAmount, total: subtotal + vatAmount };
}

export async function invoiceRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { clientId?: string } }>("/api/invoices", async (req) => {
    return db.invoice.findMany({
      where: { clientId: req.query.clientId },
      include: { client: true, lineItems: true },
      orderBy: { issueDate: "desc" },
    });
  });

  app.get<{ Params: { id: string } }>("/api/invoices/:id", async (req, reply) => {
    const invoice = await db.invoice.findUnique({
      where: { id: req.params.id },
      include: { client: true, lineItems: { orderBy: { position: "asc" } }, deliveryNotes: true },
    });
    if (!invoice) return reply.code(404).send({ error: "factura no encontrada" });
    return invoice;
  });

  // se crea siempre en borrador, sin número: mientras no se confirme funciona como un
  // presupuesto editable (el PDF la muestra como "PRESUPUESTO" hasta que tiene número).
  app.post<{ Body: { clientId: string; dueDate?: string; notes?: string; lineItems: LineItemInput[] } }>(
    "/api/invoices",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const { clientId, dueDate, notes, lineItems } = req.body;
      if (!clientId || !lineItems?.length) return reply.code(400).send({ error: "cliente y al menos una línea son obligatorios" });
      const totals = computeTotals(lineItems);
      return db.invoice.create({
        data: {
          clientId,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          notes,
          ...totals,
          lineItems: { create: lineItems.map((li, i) => ({ ...li, position: i })) },
        },
        include: { lineItems: true },
      });
    }
  );

  app.post<{ Body: { clientId: string; deliveryNoteIds: string[]; dueDate?: string; notes?: string } }>(
    "/api/invoices/from-delivery-notes",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const { clientId, deliveryNoteIds, dueDate, notes } = req.body;
      const notesToInvoice = await db.deliveryNote.findMany({
        where: { id: { in: deliveryNoteIds }, clientId, status: "PENDING" },
      });
      if (notesToInvoice.length === 0) {
        return reply.code(400).send({ error: "no hay albaranes pendientes válidos para agrupar" });
      }
      const lineItems: LineItemInput[] = notesToInvoice.map((n) => ({
        concept: n.concept,
        quantity: n.quantity,
        unitPrice: n.unitPrice,
        vatRate: n.vatRate,
      }));
      const totals = computeTotals(lineItems);
      const invoice = await db.invoice.create({
        data: {
          clientId,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          notes,
          ...totals,
          lineItems: { create: lineItems.map((li, i) => ({ ...li, position: i })) },
        },
        include: { lineItems: true },
      });
      await db.deliveryNote.updateMany({
        where: { id: { in: notesToInvoice.map((n) => n.id) } },
        data: { status: "INVOICED", invoiceId: invoice.id },
      });
      return invoice;
    }
  );

  // mientras esté en borrador se pueden reescribir las líneas (añadir, quitar, aplicar un
  // descuento como línea negativa, cambiar precios...); una vez confirmada, queda fija.
  app.patch<{
    Params: { id: string };
    Body: { status?: string; dueDate?: string; notes?: string; lineItems?: LineItemInput[] };
  }>("/api/invoices/:id", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const existing = await db.invoice.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ error: "factura no encontrada" });

    const { status, dueDate, notes, lineItems } = req.body;

    if (lineItems) {
      if (existing.status !== "DRAFT") {
        return reply.code(400).send({ error: "solo se pueden editar las líneas de una factura en borrador" });
      }
      if (lineItems.length === 0) return reply.code(400).send({ error: "la factura necesita al menos una línea" });
      await db.invoiceLineItem.deleteMany({ where: { invoiceId: req.params.id } });
      await db.invoiceLineItem.createMany({
        data: lineItems.map((li, i) => ({ ...li, invoiceId: req.params.id, position: i })),
      });
    }

    const totals = lineItems ? computeTotals(lineItems) : {};
    // salvaguarda: si algo mueve el estado fuera de borrador/cancelada sin pasar por /confirm,
    // igualmente se asigna número aquí para que nunca quede una factura "real" sin numerar.
    const needsNumber = status && status !== "DRAFT" && status !== "CANCELLED" && !existing.invoiceNumber;
    const invoiceNumber = needsNumber ? await nextInvoiceNumber() : undefined;

    return db.invoice.update({
      where: { id: req.params.id },
      data: {
        status,
        invoiceNumber,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        notes,
        ...totals,
        paidAt: status === "PAID" ? new Date() : undefined,
      },
      include: { lineItems: { orderBy: { position: "asc" } } },
    });
  });

  app.post<{ Params: { id: string } }>(
    "/api/invoices/:id/confirm",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const invoice = await db.invoice.findUnique({ where: { id: req.params.id } });
      if (!invoice) return reply.code(404).send({ error: "factura no encontrada" });
      if (invoice.status !== "DRAFT") return reply.code(400).send({ error: "ya no está en borrador" });
      if (invoice.invoiceNumber) return reply.code(400).send({ error: "ya tiene número asignado" });
      const invoiceNumber = await nextInvoiceNumber();
      return db.invoice.update({
        where: { id: req.params.id },
        data: { invoiceNumber, status: "SENT" },
        include: { lineItems: { orderBy: { position: "asc" } } },
      });
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/invoices/:id",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const invoice = await db.invoice.findUnique({ where: { id: req.params.id } });
      if (!invoice) return reply.code(404).send({ error: "factura no encontrada" });
      if (invoice.status !== "DRAFT") return reply.code(400).send({ error: "solo se pueden borrar facturas en borrador" });
      await db.deliveryNote.updateMany({
        where: { invoiceId: invoice.id },
        data: { status: "PENDING", invoiceId: null },
      });
      await db.invoiceLineItem.deleteMany({ where: { invoiceId: invoice.id } });
      await db.invoice.delete({ where: { id: invoice.id } });
      return { ok: true };
    }
  );

  app.post<{ Params: { id: string } }>(
    "/api/invoices/:id/send-email",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const invoice = await db.invoice.findUnique({ where: { id: req.params.id }, include: { client: true } });
      if (!invoice) return reply.code(404).send({ error: "factura no encontrada" });
      if (!invoice.client.email) return reply.code(400).send({ error: "el cliente no tiene email configurado" });

      const isDraft = !invoice.invoiceNumber;
      const label = invoice.invoiceNumber ?? `presupuesto-${invoice.id.slice(0, 8)}`;
      const buffer = await generateInvoicePdf(invoice.id);
      const company = await getCompanySettings();

      await sendMail({
        to: invoice.client.email,
        subject: isDraft ? `Presupuesto de ${company.businessName || "tu proveedor"}` : `Factura ${invoice.invoiceNumber}`,
        html: `<p>Hola${invoice.client.contactName ? ` ${invoice.client.contactName}` : ""},</p><p>Adjunto encontrarás ${
          isDraft ? "el presupuesto" : `la factura ${invoice.invoiceNumber}`
        } solicitado.</p>`,
        attachments: [{ filename: `${label}.pdf`, content: buffer, contentType: "application/pdf" }],
      });

      return db.invoice.update({ where: { id: invoice.id }, data: { emailSentAt: new Date() } });
    }
  );

  app.get<{ Params: { id: string } }>("/api/invoices/:id/pdf", async (req, reply) => {
    const invoice = await db.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return reply.code(404).send({ error: "factura no encontrada" });
    const buffer = await generateInvoicePdf(req.params.id);
    const filename = invoice.invoiceNumber ?? `presupuesto-${invoice.id.slice(0, 8)}`;
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="${filename}.pdf"`);
    return reply.send(buffer);
  });
}
