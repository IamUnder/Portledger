import type { FastifyInstance } from "fastify";
import { db } from "../db.js";

const SENSITIVE_KEY = /password|token|secret/i;
const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const PRUNE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "••••••••" : redact(v);
    }
    return out;
  }
  return value;
}

// hook genérico: registra toda petición mutante autenticada a la API, sin tener que
// instrumentar cada ruta a mano. El body queda redactado y recortado, no es un diff completo,
// pero basta para saber "quién hizo qué y cuándo".
export function registerAuditHook(app: FastifyInstance) {
  app.addHook("onResponse", async (req, reply) => {
    if (!req.user) return;
    if (!MUTATING_METHODS.has(req.method)) return;
    if (!req.url.startsWith("/api/") || req.url.startsWith("/api/webhooks/")) return;

    let body: string | null = null;
    if (req.rawBody) {
      try {
        body = JSON.stringify(redact(JSON.parse(req.rawBody))).slice(0, 2000);
      } catch {
        body = null;
      }
    }

    await db.auditLog
      .create({
        data: {
          userEmail: req.user.email,
          userRole: req.user.role,
          method: req.method,
          path: req.url,
          statusCode: reply.statusCode,
          body,
        },
      })
      .catch((err) => console.error("[audit] fallo guardando log:", err));
  });
}

export async function pruneOldAuditLogs() {
  const cutoff = new Date(Date.now() - PRUNE_AFTER_MS);
  await db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

export function startAuditPruning() {
  pruneOldAuditLogs().catch((err) => console.error("[audit] fallo purgando logs antiguos:", err));
  setInterval(() => {
    pruneOldAuditLogs().catch((err) => console.error("[audit] fallo purgando logs antiguos:", err));
  }, 24 * 60 * 60_000);
}
