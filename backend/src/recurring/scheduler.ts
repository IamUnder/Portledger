import cron from "node-cron";
import { db } from "../db.js";
import { notify } from "../notifications/service.js";

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// genera el borrador cuando hoy >= dayOfMonth y no se ha generado ya este mes — así si el
// servidor estuvo caído justo ese día, se genera en el primer chequeo posterior, no se pierde.
async function runRecurringInvoices() {
  const now = new Date();
  const configs = await db.recurringInvoice.findMany({ where: { active: true }, include: { client: true } });

  for (const config of configs) {
    if (now.getDate() < config.dayOfMonth) continue;
    if (config.lastRunAt && sameMonth(config.lastRunAt, now)) continue;

    const subtotal = config.quantity * config.unitPrice;
    const vatAmount = subtotal * (config.vatRate / 100);
    const invoice = await db.invoice.create({
      data: {
        clientId: config.clientId,
        subtotal,
        vatAmount,
        total: subtotal + vatAmount,
        notes: config.notes,
        lineItems: {
          create: [{ concept: config.concept, quantity: config.quantity, unitPrice: config.unitPrice, vatRate: config.vatRate, position: 0 }],
        },
      },
    });
    await db.recurringInvoice.update({ where: { id: config.id }, data: { lastRunAt: now } });

    await notify({
      type: "RECURRING_INVOICE_GENERATED",
      title: `Borrador generado: ${config.client.name}`,
      message: `Factura recurrente "${config.concept}" (${invoice.total.toFixed(2)} €) creada como borrador para ${config.client.name}. Revísala antes de confirmarla.`,
      link: `/facturas/${invoice.id}`,
    });
  }
}

function reportFailure(err: unknown) {
  console.error("[recurring] fallo generando facturas:", err);
  notify({
    type: "AUTOMATION_FAILED",
    title: "Facturas recurrentes: fallo en la generación",
    message: `La comprobación diaria de facturas recurrentes ha fallado: ${(err as Error).message}`,
    link: "/facturas/recurrentes",
  }).catch((notifyErr) => console.error("[recurring] fallo notificando el error:", notifyErr));
}

export function startRecurringInvoiceChecks() {
  runRecurringInvoices().catch(reportFailure);
  // una vez al día basta: dayOfMonth no tiene granularidad horaria
  cron.schedule("0 6 * * *", () => {
    runRecurringInvoices().catch(reportFailure);
  });
}
