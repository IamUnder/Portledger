import type { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db.js";
import { startDeploy } from "../deploy.js";

function verifySignature(secret: string, payload: string, signature?: string): boolean {
  if (!signature) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function webhookRoutes(app: FastifyInstance) {
  app.post<{ Params: { serviceId: string } }>(
    "/api/webhooks/github/:serviceId",
    async (req, reply) => {
      const service = await db.service.findUnique({
        where: { id: req.params.serviceId },
        include: { project: true },
      });
      if (!service?.repoPath) return reply.code(404).send({ error: "servicio no encontrado" });

      const raw = req.rawBody ?? "";
      if (service.webhookSecret) {
        const signature = req.headers["x-hub-signature-256"] as string | undefined;
        if (!verifySignature(service.webhookSecret, raw, signature)) {
          return reply.code(401).send({ error: "firma inválida" });
        }
      }

      const body = req.body as { ref?: string };
      const pushedBranch = body.ref?.replace("refs/heads/", "");
      if (!pushedBranch) return reply.code(400).send({ error: "payload sin ref" });

      // solo despliega si la rama que recibió el push es la que este servicio tiene configurada
      if (service.branch && pushedBranch !== service.branch) {
        return { skipped: true, reason: `rama desplegada es ${service.branch}, push fue a ${pushedBranch}` };
      }

      const deployId = await startDeploy(service, pushedBranch, "webhook");
      return { deployId };
    }
  );
}
