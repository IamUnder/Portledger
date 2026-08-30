import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { attachIdentity, requireAuth } from "./auth.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { projectRoutes } from "./routes/projects.js";
import { logRoutes } from "./routes/logs.js";
import { webhookRoutes } from "./routes/webhook.js";
import { containerRoutes } from "./routes/containers.js";
import { backupRoutes } from "./routes/backups.js";
import { loadAllSchedules } from "./backups/scheduler.js";
import { metricsRoutes } from "./routes/metrics.js";
import { startMetricsCollection } from "./metrics/collector.js";
import { cloudflareRoutes } from "./routes/cloudflare.js";
import { scaffoldRoutes } from "./routes/scaffold.js";
import { clientRoutes } from "./routes/clients.js";
import { proposalRoutes } from "./routes/proposals.js";
import { companySettingsRoutes } from "./routes/companySettings.js";
import { deliveryNoteRoutes } from "./routes/deliveryNotes.js";
import { invoiceRoutes } from "./routes/invoices.js";
import { cronJobRoutes } from "./routes/cronJobs.js";
import { loadAllCronSchedules } from "./automations/scheduler.js";
import { databaseRoutes } from "./routes/databases.js";
import { taskRoutes } from "./routes/tasks.js";
import { notificationRoutes } from "./routes/notifications.js";
import { startNotificationChecks } from "./notifications/scheduler.js";
import { timeEntryRoutes } from "./routes/timeEntries.js";
import { auditLogRoutes } from "./routes/auditLogs.js";
import { registerAuditHook, startAuditPruning } from "./audit/log.js";
import { configRoutes } from "./routes/config.js";

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

app.get("/health", async () => ({ ok: true }));

await loadAllSchedules();
await loadAllCronSchedules();
startMetricsCollection();
startNotificationChecks();
startAuditPruning();

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
