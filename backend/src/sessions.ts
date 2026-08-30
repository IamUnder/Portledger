import { randomBytes } from "node:crypto";
import { db } from "./db.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: { token, userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  return token;
}

export async function resolveSession(token: string) {
  const session = await db.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function destroySession(token: string) {
  await db.session.deleteMany({ where: { token } });
}
