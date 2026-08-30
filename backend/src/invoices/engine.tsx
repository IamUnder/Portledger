import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "../db.js";
import { InvoicePdf } from "./InvoicePdf.js";

export async function getCompanySettings() {
  return db.companySettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

export async function nextInvoiceNumber(): Promise<string> {
  const settings = await getCompanySettings();
  const number = settings.nextInvoiceNumber;
  await db.companySettings.update({ where: { id: "singleton" }, data: { nextInvoiceNumber: number + 1 } });
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
