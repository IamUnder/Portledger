import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { startScaffold } from "../scaffold/engine.js";
import type { ScaffoldSpec } from "../scaffold/types.js";

export async function scaffoldRoutes(app: FastifyInstance) {
  app.post<{ Body: ScaffoldSpec }>("/api/scaffold", async (req, reply) => {
    if (!req.body.name || !/^[a-z0-9-]+$/.test(req.body.name)) {
      return reply.code(400).send({ error: "el nombre debe ser minúsculas, números y guiones" });
    }
    if (req.body.services.length === 0 && !req.body.composeSource) {
      return reply.code(400).send({ error: "añade al menos un servicio" });
    }
    if (req.body.composeSource && !req.body.composeSource.repoUrl?.trim()) {
      return reply.code(400).send({ error: "falta la URL del repositorio a clonar" });
    }
    const jobId = await startScaffold(req.body);
    return { jobId };
  });

  app.get<{ Params: { id: string } }>("/api/scaffold/:id", async (req, reply) => {
    const job = await db.scaffoldJob.findUnique({ where: { id: req.params.id } });
    if (!job) return reply.code(404).send({ error: "job no encontrado" });
    return job;
  });
}
