import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { requireRole } from "../auth.js";

export async function auditLogRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { userEmail?: string; from?: string; to?: string } }>(
    "/api/audit-logs",
    { preHandler: requireRole("ADMIN") },
    async (req) => {
      const { userEmail, from, to } = req.query;
      return db.auditLog.findMany({
        where: {
          userEmail,
          createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      });
    }
  );
}
