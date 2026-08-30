import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { getQueryStats, resetQueryStats } from "../databases/engine.js";

interface DatabaseInput {
  label: string;
  engine: "MYSQL" | "POSTGRES";
  containerName: string;
  databaseName: string;
  username: string;
  password: string;
}

export async function databaseRoutes(app: FastifyInstance) {
  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId/databases", async (req) => {
    return db.database.findMany({ where: { projectId: req.params.projectId } });
  });

  app.post<{ Params: { projectId: string }; Body: DatabaseInput }>(
    "/api/projects/:projectId/databases",
    async (req, reply) => {
      if (!req.body.label?.trim() || !req.body.containerName?.trim() || !req.body.databaseName?.trim()) {
        return reply.code(400).send({ error: "nombre, contenedor y base de datos son obligatorios" });
      }
      return db.database.create({ data: { ...req.body, projectId: req.params.projectId } });
    }
  );

  app.patch<{ Params: { id: string }; Body: Partial<DatabaseInput> }>("/api/databases/:id", async (req) => {
    return db.database.update({ where: { id: req.params.id }, data: req.body });
  });

  app.delete<{ Params: { id: string } }>("/api/databases/:id", async (req) => {
    await db.database.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/api/databases/:id", async (req, reply) => {
    const database = await db.database.findUnique({ where: { id: req.params.id }, include: { project: true } });
    if (!database) return reply.code(404).send({ error: "base de datos no encontrada" });
    return database;
  });

  app.get<{ Params: { id: string } }>("/api/databases/:id/stats", async (req, reply) => {
    const database = await db.database.findUnique({ where: { id: req.params.id } });
    if (!database) return reply.code(404).send({ error: "base de datos no encontrada" });
    try {
      return { stats: await getQueryStats(database) };
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });

  app.post<{ Params: { id: string } }>("/api/databases/:id/reset-stats", async (req, reply) => {
    const database = await db.database.findUnique({ where: { id: req.params.id } });
    if (!database) return reply.code(404).send({ error: "base de datos no encontrada" });
    await resetQueryStats(database);
    return { ok: true };
  });
}
