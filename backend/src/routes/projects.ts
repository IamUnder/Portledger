import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
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

  // registra un proyecto que YA tiene su propio docker-compose.yml escrito a mano (a diferencia
  // del asistente de scaffolding, que siempre genera uno desde cero) — para proyectos demasiado
  // específicos para el generador (múltiples Dockerfiles, contenedores de migración encadenados,
  // anclas YAML...). No copia nada ni toca el fichero: Portledger solo necesita saber dónde está
  // para poder ejecutar `docker compose -f <ruta> ...` sobre él. Los servicios a rastrear se dan
  // de alta después, uno a uno, con POST /api/projects/:id/services.
  app.post<{ Body: { name: string; composeFile: string; envFile?: string; hostname?: string } }>(
    "/api/projects",
    async (req, reply) => {
      const { name, composeFile, envFile, hostname } = req.body;
      if (!name?.trim() || !/^[a-z0-9-]+$/.test(name.trim())) {
        return reply.code(400).send({ error: "el nombre debe ser minúsculas, números y guiones" });
      }
      if (!composeFile?.trim()) return reply.code(400).send({ error: "falta la ruta al docker-compose.yml" });
      if (!existsSync(composeFile.trim())) {
        return reply.code(400).send({ error: `no se encuentra ese fichero en el servidor: ${composeFile}` });
      }
      if (envFile?.trim() && !existsSync(envFile.trim())) {
        return reply.code(400).send({ error: `no se encuentra ese fichero en el servidor: ${envFile}` });
      }

      try {
        return await db.project.create({
          data: {
            name: name.trim(),
            composeFile: composeFile.trim(),
            envFile: envFile?.trim() || undefined,
            hostname: hostname?.trim() || undefined,
          },
        });
      } catch {
        return reply.code(400).send({ error: "ya existe un proyecto con ese nombre" });
      }
    }
  );

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

  // alta manual de un servicio en un proyecto ya existente — para cuando su docker-compose.yml
  // gana un servicio nuevo por fuera del panel (ej. añadir la web de un proyecto que antes solo
  // tenía backend) y hace falta que el panel lo conozca para desplegarlo/ver sus logs.
  app.post<{
    Params: { id: string };
    Body: { name: string; containerName?: string; repoPath?: string; repoUrl?: string; branch?: string };
  }>("/api/projects/:id/services", async (req, reply) => {
    const project = await db.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "proyecto no encontrado" });
    if (!req.body.name?.trim()) return reply.code(400).send({ error: "el nombre es obligatorio" });

    try {
      return await db.service.create({
        data: {
          projectId: project.id,
          name: req.body.name.trim(),
          containerName: req.body.containerName || undefined,
          repoPath: req.body.repoPath || undefined,
          repoUrl: req.body.repoUrl || undefined,
          branch: req.body.branch || undefined,
        },
      });
    } catch {
      return reply.code(400).send({ error: "ya existe un servicio con ese nombre en este proyecto" });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/services/:id", async (req) => {
    await db.deployEvent.deleteMany({ where: { serviceId: req.params.id } });
    await db.service.delete({ where: { id: req.params.id } });
    return { ok: true };
  });
}
