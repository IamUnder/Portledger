import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";

let app: FastifyInstance;
const email = "smoke-auth@example.com";
const password = "smoke-test-password-123";

beforeAll(async () => {
  app = await buildApp();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.create({ data: { email, passwordHash, role: "ADMIN" } });
});

afterAll(async () => {
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
  await app.close();
});

describe("auth", () => {
  it("rejects wrong credentials and audits the attempt", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);

    const log = await db.auditLog.findFirst({
      where: { userEmail: email, statusCode: 401 },
      orderBy: { createdAt: "desc" },
    });
    expect(log).not.toBeNull();
  });

  it("logs in with correct credentials and sets a session cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ email, role: "ADMIN" });
    expect(res.cookies.some((c) => c.name === "panel_session")).toBe(true);
  });

  it("rejects requests to protected routes without a session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/clients" });
    expect(res.statusCode).toBe(401);
  });

  it("rate-limits repeated failed logins from the same IP", async () => {
    let last;
    for (let i = 0; i < 9; i++) {
      last = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "still-wrong" },
      });
    }
    expect(last!.statusCode).toBe(429);
  });
});
