import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { attachIdentity, requireAuth } from "./auth.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { projectRoutes } from "./routes/projects.js";
import { logRoutes } from "./routes/logs.js";
import { webhookRoutes } from "./routes/webhook.js";
import { containerRoutes } from "./routes/containers.js";
import { backupRoutes } from "./routes/backups.js";
import { metricsRoutes } from "./routes/metrics.js";
import { cloudflareRoutes } from "./routes/cloudflare.js";
import { scaffoldRoutes } from "./routes/scaffold.js";
import { clientRoutes } from "./routes/clients.js";
import { proposalRoutes } from "./routes/proposals.js";
import { companySettingsRoutes } from "./routes/companySettings.js";
import { deliveryNoteRoutes } from "./routes/deliveryNotes.js";
import { invoiceRoutes } from "./routes/invoices.js";
import { cronJobRoutes } from "./routes/cronJobs.js";
import { databaseRoutes } from "./routes/databases.js";
import { taskRoutes } from "./routes/tasks.js";
import { notificationRoutes } from "./routes/notifications.js";
import { timeEntryRoutes } from "./routes/timeEntries.js";
import { auditLogRoutes } from "./routes/auditLogs.js";
import { registerAuditHook } from "./audit/log.js";
import { configRoutes } from "./routes/config.js";
import { reportRoutes } from "./routes/reports.js";
import { searchRoutes } from "./routes/search.js";
import { recurringInvoiceRoutes } from "./routes/recurringInvoices.js";
import { expenseRoutes } from "./routes/expenses.js";
import { emailTemplateRoutes } from "./routes/emailTemplates.js";
import { isDemoMode, redactForDemo } from "./demo/redact.js";

// separado de server.ts para poder testear con app.inject() sin abrir un puerto real
// ni arrancar los cron schedulers (backups, automatizaciones, métricas...).
export async function buildApp() {
  const app = Fastify({ logger: true });

  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    req.rawBody = body as string;
    try {
      done(null, body.length ? JSON.parse(body as string) : {});
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  // global: false → el límite solo se aplica en las rutas que lo declaren explícitamente
  // (de momento, solo /api/auth/login) en vez de frenar toda la API.
  await app.register(rateLimit, { global: false });

  // el webhook de GitHub se autentica por firma HMAC, no por sesión
  await app.register(webhookRoutes);

  app.addHook("onRequest", async (req, reply) => {
    if (req.url.startsWith("/api/webhooks/")) return;
    await attachIdentity(req);
    if (req.url.startsWith("/api/") && req.url !== "/api/auth/login") {
      await requireAuth(req, reply);
    }
  });

  registerAuditHook(app);

  // modo demo: sustituye datos identificativos reales por otros de mentira en toda respuesta
  // JSON de la API, si está activado en Datos fiscales. No toca binarios (PDFs) ni el stream de
  // logs — JSON.parse falla ahí y se deja el payload tal cual.
  app.addHook("onSend", async (req, reply, payload) => {
    // nunca debe poder romper una respuesta real: si algo falla aquí (incluso una carrera con
    // otro hook async, como se vio bajo el rate-limiter en pruebas), se devuelve el payload
    // original sin tocar en vez de arriesgarse a un envío duplicado o una petición rota.
    try {
      // los errores (401 de requireAuth en onRequest, 404, etc.) solo llevan {error: "..."},
      // nada que redactar — además evita una interacción rara con respuestas ya cortadas en
      // onRequest que producía "Reply was already sent" al mezclarlas con un hook async aquí.
      if (reply.statusCode >= 400) return payload;
      if (!req.url.startsWith("/api/") || req.url.startsWith("/api/webhooks/")) return payload;
      if (!(await isDemoMode())) return payload;

      if (typeof payload === "string") {
        try {
          return JSON.stringify(redactForDemo(JSON.parse(payload)));
        } catch {
          return payload;
        }
      }
      // Buffer (el PDF de factura) es `typeof "object"` en JS — sin este corte, redactForDemo lo
      // trataría como un objeto plano (iterando cada byte como si fuera una entrada) y lo dejaría
      // corrupto. Streams tampoco son JSON: se dejan pasar también.
      if (Buffer.isBuffer(payload) || (payload as { pipe?: unknown })?.pipe) return payload;
      if (payload && typeof payload === "object") return redactForDemo(payload);
      return payload;
    } catch (err) {
      console.error("[demo] fallo aplicando el modo demo, se devuelve la respuesta sin modificar:", err);
      return payload;
    }
  });

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(projectRoutes);
  await app.register(logRoutes);
  await app.register(containerRoutes);
  await app.register(backupRoutes);
  await app.register(metricsRoutes);
  await app.register(cloudflareRoutes);
  await app.register(scaffoldRoutes);
  await app.register(clientRoutes);
  await app.register(proposalRoutes);
  await app.register(companySettingsRoutes);
  await app.register(deliveryNoteRoutes);
  await app.register(invoiceRoutes);
  await app.register(cronJobRoutes);
  await app.register(databaseRoutes);
  await app.register(taskRoutes);
  await app.register(notificationRoutes);
  await app.register(timeEntryRoutes);
  await app.register(auditLogRoutes);
  await app.register(configRoutes);
  await app.register(reportRoutes);
  await app.register(searchRoutes);
  await app.register(recurringInvoiceRoutes);
  await app.register(expenseRoutes);
  await app.register(emailTemplateRoutes);

  app.get("/health", async () => ({ ok: true }));

  await app.ready();
  return app;
}
