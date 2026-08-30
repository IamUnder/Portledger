import type { FastifyInstance } from "fastify";
import { findContainer } from "../docker.js";

export async function logRoutes(app: FastifyInstance) {
  app.get<{ Params: { name: string } }>("/api/containers/:name/logs", async (req, reply) => {
    const container = await findContainer(req.params.name);
    if (!container) return reply.code(404).send({ error: "contenedor no encontrado" });

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const stream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: 200,
    });

    stream.on("data", (chunk: Buffer) => {
      // los primeros 8 bytes de cada frame son cabecera multiplexada de Docker
      const text = chunk.subarray(8).toString("utf-8");
      for (const line of text.split("\n")) {
        if (line.length) reply.raw.write(`data: ${line}\n\n`);
      }
    });

    req.raw.on("close", () => {
      // @ts-expect-error dockerode stream expone destroy en runtime aunque no esté tipado
      stream.destroy?.();
    });
  });
}
