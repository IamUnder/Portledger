import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { db } from "../db.js";
import { PUBLIC_LEADS_API_KEY } from "../config.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validKey(provided: unknown): boolean {
  if (!PUBLIC_LEADS_API_KEY || typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(PUBLIC_LEADS_API_KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

// recorta a una longitud razonable y colapsa espacios — nunca hay que fiarse del tamaño de un
// payload que viene de un formulario público sin autenticar.
function clean(value: unknown, maxLen: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLen) : "";
}

interface LeadBody {
  name?: string;
  email?: string;
  business?: string;
  message?: string;
  source?: string;
  locale?: string;
  website?: string; // honeypot: un visitante real nunca rellena este campo oculto
}

export async function publicLeadRoutes(app: FastifyInstance) {
  app.post<{ Body: LeadBody }>(
    "/api/public/leads",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "10 minutes",
          errorResponseBuilder: () => ({ statusCode: 429, error: "demasiadas peticiones" }),
        },
      },
    },
    async (req, reply) => {
      if (!validKey(req.headers["x-api-key"])) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      // el bot cayó en la trampa: se acepta en silencio para no delatar el honeypot, pero no se
      // crea nada.
      if (clean(req.body?.website, 200)) return { ok: true };

      const name = clean(req.body?.name, 200);
      const email = clean(req.body?.email, 200).toLowerCase();
      const business = clean(req.body?.business, 200);
      const message = clean(req.body?.message, 5000);
      const source = clean(req.body?.source, 100) || "web";
      const locale = clean(req.body?.locale, 10) || "es";

      if (!name || !email || !message) {
        return reply.code(400).send({ error: "faltan campos obligatorios (name, email, message)" });
      }
      if (!EMAIL_RE.test(email)) {
        return reply.code(400).send({ error: "email inválido" });
      }

      let client = await db.client.findFirst({ where: { email } });
      if (!client) {
        client = await db.client.create({
          data: { name: business || name, contactName: name, email, status: "LEAD" },
        });
      }

      await db.task.create({
        data: {
          title: `Nuevo lead: ${business || name}`,
          description: `${message}\n\n— vía ${source} (${locale})`,
          status: "TODO",
          priority: "MEDIUM",
          clientId: client.id,
        },
      });

      return { ok: true };
    }
  );
}
