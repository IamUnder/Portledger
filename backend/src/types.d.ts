import "fastify";
import type { User } from "@prisma/client";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
    user?: User;
    accessEmail?: string; // email autenticado por Cloudflare Access, si la petición vino por ahí
  }
}
