import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { requireRole } from "../auth.js";

interface ExpenseInput {
  concept: string;
  amount: number;
  date?: string;
  category?: string;
  projectId?: string | null;
  notes?: string;
}

export async function expenseRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { from?: string; to?: string; projectId?: string } }>("/api/expenses", async (req) => {
    const { from, to, projectId } = req.query;
    return db.expense.findMany({
      where: {
        projectId: projectId || undefined,
        date: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined },
      },
      include: { project: true },
      orderBy: { date: "desc" },
    });
  });

  app.post<{ Body: ExpenseInput }>("/api/expenses", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const { concept, amount, date, category, projectId, notes } = req.body;
    if (!concept?.trim() || !amount) return reply.code(400).send({ error: "concepto e importe son obligatorios" });
    return db.expense.create({
      data: { concept, amount, date: date ? new Date(date) : undefined, category, projectId: projectId || undefined, notes },
      include: { project: true },
    });
  });

  app.patch<{ Params: { id: string }; Body: Partial<ExpenseInput> }>(
    "/api/expenses/:id",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const { concept, amount, date, category, projectId, notes } = req.body;
      const existing = await db.expense.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.code(404).send({ error: "gasto no encontrado" });
      return db.expense.update({
        where: { id: req.params.id },
        data: { concept, amount, date: date ? new Date(date) : undefined, category, projectId: projectId ?? undefined, notes },
        include: { project: true },
      });
    }
  );

  app.delete<{ Params: { id: string } }>("/api/expenses/:id", { preHandler: requireRole("ADMIN") }, async (req) => {
    await db.expense.delete({ where: { id: req.params.id } });
    return { ok: true };
  });
}
