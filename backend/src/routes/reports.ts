import type { FastifyInstance } from "fastify";
import { db } from "../db.js";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function reportRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { months?: string } }>("/api/reports/monthly-revenue", async (req) => {
    const months = Math.min(24, Math.max(1, Number(req.query.months ?? 12)));
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const invoices = await db.invoice.findMany({
      where: {
        status: { notIn: ["DRAFT", "CANCELLED"] },
        OR: [{ issueDate: { gte: from } }, { paidAt: { gte: from } }],
      },
      select: { issueDate: true, paidAt: true, total: true },
    });
    const expenses = await db.expense.findMany({
      where: { date: { gte: from } },
      select: { date: true, amount: true },
    });

    const buckets = new Map<string, { month: string; invoiced: number; paid: number; expenses: number }>();
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
      buckets.set(monthKey(d), { month: monthKey(d), invoiced: 0, paid: 0, expenses: 0 });
    }
    for (const inv of invoices) {
      const issuedKey = monthKey(new Date(inv.issueDate));
      if (buckets.has(issuedKey)) buckets.get(issuedKey)!.invoiced += inv.total;
      if (inv.paidAt) {
        const paidKey = monthKey(new Date(inv.paidAt));
        if (buckets.has(paidKey)) buckets.get(paidKey)!.paid += inv.total;
      }
    }
    for (const exp of expenses) {
      const key = monthKey(new Date(exp.date));
      if (buckets.has(key)) buckets.get(key)!.expenses += exp.amount;
    }
    return [...buckets.values()];
  });

  app.get("/api/reports/by-client", async () => {
    const invoices = await db.invoice.findMany({
      where: { status: { notIn: ["DRAFT", "CANCELLED"] } },
      include: { client: true },
    });
    const byClient = new Map<string, { clientId: string; clientName: string; paidTotal: number; pendingTotal: number; invoiceCount: number }>();
    for (const inv of invoices) {
      const entry = byClient.get(inv.clientId) ?? {
        clientId: inv.clientId,
        clientName: inv.client.name,
        paidTotal: 0,
        pendingTotal: 0,
        invoiceCount: 0,
      };
      entry.invoiceCount += 1;
      if (inv.status === "PAID") entry.paidTotal += inv.total;
      else entry.pendingTotal += inv.total;
      byClient.set(inv.clientId, entry);
    }
    return [...byClient.values()].sort((a, b) => b.paidTotal + b.pendingTotal - (a.paidTotal + a.pendingTotal));
  });
}
