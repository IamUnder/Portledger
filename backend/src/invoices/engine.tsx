import type { Prisma } from "@prisma/client";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "../db.js";
import { InvoicePdf } from "./InvoicePdf.js";

type DbClient = typeof db | Prisma.TransactionClient;

export async function getCompanySettings(client: DbClient = db) {
  return client.companySettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

// Lee el contador y lo incrementa: para que dos llamadas concurrentes nunca obtengan el mismo
// número hace falta que ambos pasos ocurran dentro de la MISMA transacción serializable que
// use el llamador (ver invoices.ts) — llamar a esta función suelta, fuera de una transacción,
// reintroduce la condición de carrera.
export async function nextInvoiceNumber(client: DbClient = db): Promise<string> {
  const settings = await getCompanySettings(client);
  const number = settings.nextInvoiceNumber;
  await client.companySettings.update({ where: { id: "singleton" }, data: { nextInvoiceNumber: number + 1 } });
  return `${settings.invoiceNumberPrefix}${String(number).padStart(4, "0")}`;
}

export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { client: true, lineItems: { orderBy: { position: "asc" } } },
  });
  const company = await getCompanySettings();
  return renderToBuffer(
    <InvoicePdf company={company} client={invoice.client} invoice={invoice} lineItems={invoice.lineItems} />
  );
}
