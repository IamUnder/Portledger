import type { FastifyInstance } from "fastify";
import { findContainer } from "../docker.js";

export async function containerRoutes(app: FastifyInstance) {
  for (const action of ["start", "stop", "restart"] as const) {
    app.post<{ Params: { name: string } }>(`/api/containers/:name/${action}`, async (req, reply) => {
      const container = await findContainer(req.params.name);
      if (!container) return reply.code(404).send({ error: "contenedor no encontrado" });
      if (action === "start") await container.start();
      else if (action === "stop") await container.stop();
      else await container.restart();
      return { ok: true };
    });
  }
}
