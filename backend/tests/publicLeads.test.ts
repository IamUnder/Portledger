import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { TEST_PUBLIC_LEADS_API_KEY } from "./testEnv.js";

let app: FastifyInstance;
const email = "smoke-lead@example.com";

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  const client = await db.client.findFirst({ where: { email } });
  if (client) {
    await db.task.deleteMany({ where: { clientId: client.id } });
    await db.client.delete({ where: { id: client.id } });
  }
  await app.close();
});

describe("public leads", () => {
  it("rejects requests without a valid API key", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/public/leads",
      payload: { name: "x", email: "x@example.com", message: "x" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a payload missing required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/public/leads",
      headers: { "x-api-key": TEST_PUBLIC_LEADS_API_KEY },
      payload: { name: "sin email ni mensaje" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("silently swallows a honeypot submission without creating anything", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/public/leads",
      headers: { "x-api-key": TEST_PUBLIC_LEADS_API_KEY },
      payload: { name: "bot", email, message: "hola", website: "http://spam.example" },
    });
    expect(res.statusCode).toBe(200);
    expect(await db.client.findFirst({ where: { email } })).toBeNull();
  });

  it("creates a LEAD client and a follow-up task from a valid submission", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/public/leads",
      headers: { "x-api-key": TEST_PUBLIC_LEADS_API_KEY },
      payload: {
        name: "Jorge Prueba",
        email,
        business: "Empresa de Prueba",
        message: "Necesito un presupuesto",
        source: "kaizogroup-web",
        locale: "es",
      },
    });
    expect(res.statusCode).toBe(200);

    const client = await db.client.findFirst({ where: { email } });
    expect(client?.status).toBe("LEAD");
    expect(client?.name).toBe("Empresa de Prueba");
    expect(client?.contactName).toBe("Jorge Prueba");

    const task = await db.task.findFirst({ where: { clientId: client!.id } });
    expect(task?.status).toBe("TODO");
    expect(task?.title).toContain("Empresa de Prueba");
    expect(task?.description).toContain("Necesito un presupuesto");
  });

  it("reuses an existing client by email instead of duplicating it", async () => {
    const before = await db.client.findFirst({ where: { email } });
    await app.inject({
      method: "POST",
      url: "/api/public/leads",
      headers: { "x-api-key": TEST_PUBLIC_LEADS_API_KEY },
      payload: { name: "Jorge Prueba", email, message: "segundo contacto" },
    });
    const clients = await db.client.findMany({ where: { email } });
    expect(clients).toHaveLength(1);
    expect(clients[0].id).toBe(before!.id);
    const tasks = await db.task.findMany({ where: { clientId: before!.id } });
    expect(tasks).toHaveLength(2);
  });
});
