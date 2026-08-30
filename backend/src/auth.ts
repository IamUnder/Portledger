import type { FastifyRequest, FastifyReply } from "fastify";
import { resolveSession } from "./sessions.js";

const SESSION_COOKIE = "panel_session";

export async function attachIdentity(req: FastifyRequest) {
  req.accessEmail = (req.headers["cf-access-authenticated-user-email"] as string) || undefined;

  const token = req.cookies[SESSION_COOKIE];
  if (token) {
    const user = await resolveSession(token);
    if (user) req.user = user;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) reply.code(401).send({ error: "unauthorized" });
}

export function requireRole(role: "ADMIN") {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) return reply.code(401).send({ error: "unauthorized" });
    if (req.user.role !== role) return reply.code(403).send({ error: "forbidden" });
  };
}

export { SESSION_COOKIE };
