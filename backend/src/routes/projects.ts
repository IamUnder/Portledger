import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { containerStatus } from "../docker.js";
import { listRemoteBranches, startDeploy } from "../deploy.js";

async function withServiceStatus<T extends { services: { containerName: string | null; name: string }[] }>(
  project: T
) {
  return {
    ...project,
    services: await Promise.all(
      project.services.map(async (s) => ({ ...s, status: await containerStatus(s.containerName ?? s.name) }))
    ),
  };
}

export async function projectRoutes(app: FastifyInstance) {
  app.get("/api/projects", async () => {
    const projects = await db.project.findMany({ include: { services: true } });
    return Promise.all(projects.map(withServiceStatus));
  });

  app.get<{ Params: { id: string } }>("/api/projects/:id", async (req, reply) => {
    const project = await db.project.findUnique({
      where: { id: req.params.id },
      include: { services: true },
    });
    if (!project) return reply.code(404).send({ error: "proyecto no encontrado" });
    return withServiceStatus(project);
  });

  app.get<{ Params: { serviceId: string } }>(
    "/api/services/:serviceId/branches",
    async (req, reply) => {
      const service = await db.service.findUnique({ where: { id: req.params.serviceId } });
      if (!service?.repoPath) return reply.code(400).send({ error: "servicio sin repo" });
      return listRemoteBranches(service.repoPath);
    }
  );

  app.get<{ Params: { serviceId: string } }>(
    "/api/services/:serviceId/deploys",
    async (req) => {
      return db.deployEvent.findMany({
        where: { serviceId: req.params.serviceId },
        orderBy: { startedAt: "desc" },
        take: 20,
      });
    }
  );

  app.post<{ Params: { serviceId: string }; Body: { branch: string } }>(
    "/api/services/:serviceId/deploy",
    async (req, reply) => {
      const service = await db.service.findUnique({
        where: { id: req.params.serviceId },
        include: { project: true },
      });
      if (!service) return reply.code(404).send({ error: "servicio no encontrado" });

      const branch = req.body.branch || service.branch;
      if (!branch) return reply.code(400).send({ error: "falta la rama a desplegar" });

      // se ejecuta en background; el cliente sigue el progreso via /api/services/:id/deploys
      const deployId = await startDeploy(service, branch, "manual");
      return { deployId };
    }
  );
}
