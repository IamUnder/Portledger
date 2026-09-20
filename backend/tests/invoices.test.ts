import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";

let app: FastifyInstance;
let cookie: string;
let clientId: string;
let invoiceId: string;

const email = "smoke-invoices@example.com";
const password = "smoke-test-password-456";
const clientName = "Smoke Test Client";

beforeAll(async () => {
  app = await buildApp();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.create({ data: { email, passwordHash, role: "ADMIN" } });

  const loginRes = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
  cookie = loginRes.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
});

afterAll(async () => {
  await db.invoiceLineItem.deleteMany({ where: { invoice: { client: { name: clientName } } } });
  await db.invoice.deleteMany({ where: { client: { name: clientName } } });
  await db.client.deleteMany({ where: { name: clientName } });
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
  await app.close();
});

describe("invoices", () => {
  it("creates a client", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/clients",
      headers: { cookie },
      payload: { name: clientName, email: "smoke@example.com" },
    });
    expect(res.statusCode).toBe(200);
    clientId = res.json().id;
  });

  it("creates a draft invoice with correct totals", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/invoices",
      headers: { cookie },
      payload: { clientId, lineItems: [{ concept: "Servicio de prueba", quantity: 2, unitPrice: 50, vatRate: 21 }] },
    });
    expect(res.statusCode).toBe(200);
    const invoice = res.json();
    invoiceId = invoice.id;
    expect(invoice.status).toBe("DRAFT");
    expect(invoice.subtotal).toBe(100);
    expect(invoice.vatAmount).toBeCloseTo(21);
    expect(invoice.total).toBeCloseTo(121);
  });

  it("generates a valid PDF for the draft", async () => {
    const res = await app.inject({ method: "GET", url: `/api/invoices/${invoiceId}/pdf`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.rawPayload.length).toBeGreaterThan(500);
    expect(res.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("confirms the invoice and assigns a definitive number", async () => {
    const res = await app.inject({ method: "POST", url: `/api/invoices/${invoiceId}/confirm`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const invoice = res.json();
    expect(invoice.status).toBe("SENT");
    expect(invoice.invoiceNumber).toBeTruthy();
  });

  it("assigns consecutive invoice numbers when two drafts are confirmed concurrently", async () => {
    const createDraft = async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/invoices",
        headers: { cookie },
        payload: { clientId, lineItems: [{ concept: "Concurrencia", quantity: 1, unitPrice: 10, vatRate: 21 }] },
      });
      expect(res.statusCode).toBe(200);
      return res.json().id as string;
    };

    const [draftAId, draftBId] = await Promise.all([createDraft(), createDraft()]);

    // ambas confirmaciones se disparan a la vez: antes del fix, las dos podían leer el mismo
    // valor de nextInvoiceNumber y acabar con el mismo número (o dejar uno sin usar).
    const [resA, resB] = await Promise.all([
      app.inject({ method: "POST", url: `/api/invoices/${draftAId}/confirm`, headers: { cookie } }),
      app.inject({ method: "POST", url: `/api/invoices/${draftBId}/confirm`, headers: { cookie } }),
    ]);

    expect(resA.statusCode).toBe(200);
    expect(resB.statusCode).toBe(200);

    const numberOf = (res: typeof resA) => {
      const invoiceNumber: string = res.json().invoiceNumber;
      const digits = invoiceNumber.match(/\d+$/)?.[0];
      expect(digits).toBeTruthy();
      return parseInt(digits as string, 10);
    };

    const numA = numberOf(resA);
    const numB = numberOf(resB);

    expect(numA).not.toBe(numB);
    expect(Math.abs(numA - numB)).toBe(1);
  });

  it("refuses to delete a non-draft invoice", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/invoices/${invoiceId}`, headers: { cookie } });
    expect(res.statusCode).toBe(400);
  });
});
