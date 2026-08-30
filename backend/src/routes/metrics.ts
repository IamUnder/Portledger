import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { readCurrentMetrics } from "../metrics/collector.js";

export async function metricsRoutes(app: FastifyInstance) {
  app.get("/api/metrics/current", async () => {
    return readCurrentMetrics();
  });

  app.get<{ Querystring: { hours?: string } }>("/api/metrics/history", async (req) => {
    const hours = Number(req.query.hours ?? 6);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return db.metricSample.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
    });
  });
}
