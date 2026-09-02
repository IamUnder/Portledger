import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";

let app: FastifyInstance;
let cookie: string;
let clientId: string;

const email = "smoke-demo@example.com";
const password = "smoke-test-password-789";
const clientName = "Smoke Demo Real Client";

beforeAll(async () => {
  app = await buildApp();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.create({ data: { email, passwordHash, role: "ADMIN" } });

  const loginRes = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
  cookie = loginRes.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  const clientRes = await app.inject({
    method: "POST",
    url: "/api/clients",
    headers: { cookie },
    payload: { name: clientName, taxId: "B12345678" },
  });
  clientId = clientRes.json().id;
});

afterAll(async () => {
  await db.client.deleteMany({ where: { name: clientName } });
  await db.companySettings.update({ where: { id: "singleton" }, data: { demoMode: false } }).catch(() => {});
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
  await app.close();
});

describe("demo mode", () => {
  it("shows real data when off", async () => {
    const res = await app.inject({ method: "GET", url: `/api/clients/${clientId}`, headers: { cookie } });
    expect(res.json().name).toBe(clientName);
  });

  it("redacts client identity when on, deterministically across requests", async () => {
    await app.inject({ method: "PATCH", url: "/api/company-settings", headers: { cookie }, payload: { demoMode: true } });

    const res1 = await app.inject({ method: "GET", url: `/api/clients/${clientId}`, headers: { cookie } });
    const res2 = await app.inject({ method: "GET", url: `/api/clients/${clientId}`, headers: { cookie } });

    expect(res1.json().name).not.toBe(clientName);
    expect(res1.json().taxId).not.toBe("B12345678");
    expect(res1.json().name).toBe(res2.json().name);
  });

  it("still returns clean 401s for unauthenticated requests while demo mode is on", async () => {
    // regresión: un hook async añadido para el modo demo llegó a chocar con las respuestas
    // cortadas en el hook onRequest (401 sin sesión), produciendo un "Reply was already sent".
    const res = await app.inject({ method: "GET", url: "/api/clients" });
    expect(res.statusCode).toBe(401);
  });
});
