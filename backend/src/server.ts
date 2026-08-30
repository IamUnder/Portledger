import { buildApp } from "./app.js";
import { loadAllSchedules } from "./backups/scheduler.js";
import { loadAllCronSchedules } from "./automations/scheduler.js";
import { startMetricsCollection } from "./metrics/collector.js";
import { startNotificationChecks } from "./notifications/scheduler.js";
import { startAuditPruning } from "./audit/log.js";
import { startRecurringInvoiceChecks } from "./recurring/scheduler.js";

const app = await buildApp();

await loadAllSchedules();
await loadAllCronSchedules();
startMetricsCollection();
startNotificationChecks();
startAuditPruning();
startRecurringInvoiceChecks();

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
