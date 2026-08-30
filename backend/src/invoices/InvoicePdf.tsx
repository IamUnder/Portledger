import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { CompanySettings, Client, Invoice, InvoiceLineItem } from "@prisma/client";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  companyName: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  small: { fontSize: 9, color: "#555", marginBottom: 2 },
  invoiceTitle: { fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: "right" },
  label: { fontSize: 9, color: "#888" },
  clientBox: { marginBottom: 24, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 4 },
  clientName: { fontSize: 11, fontWeight: 700, marginBottom: 3 },
  table: { marginBottom: 20 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#1a1a1a", paddingVertical: 6, paddingHorizontal: 8 },
  tableHeaderCell: { color: "#fff", fontSize: 9, fontWeight: 700 },
  tableRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  cellConcept: { flex: 4 },
  cellQty: { flex: 1, textAlign: "right" },
  cellPrice: { flex: 1.3, textAlign: "right" },
  cellVat: { flex: 1, textAlign: "right" },
  cellTotal: { flex: 1.3, textAlign: "right" },
  totalsBox: { alignSelf: "flex-end", width: 220, marginTop: 8 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    marginTop: 4,
  },
  totalsFinalLabel: { fontSize: 12, fontWeight: 700 },
  totalsFinalValue: { fontSize: 12, fontWeight: 700 },
  footer: { marginTop: 40, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#eee" },
});

function money(n: number) {
  return `${n.toFixed(2)} €`;
}

export function InvoicePdf({
  company,
  client,
  invoice,
  lineItems,
}: {
  company: CompanySettings;
  client: Client;
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{company.businessName || "(sin nombre configurado)"}</Text>
            {company.taxId ? <Text style={styles.small}>NIF: {company.taxId}</Text> : null}
            {company.address ? <Text style={styles.small}>{company.address}</Text> : null}
            {company.postalCode || company.city ? (
              <Text style={styles.small}>
                {company.postalCode} {company.city}
                {company.province ? `, ${company.province}` : ""}
              </Text>
            ) : null}
            {company.email ? <Text style={styles.small}>{company.email}</Text> : null}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>{invoice.invoiceNumber ? "FACTURA" : "PRESUPUESTO"}</Text>
            {invoice.invoiceNumber && (
              <>
                <Text style={styles.label}>Número</Text>
                <Text style={{ marginBottom: 6 }}>{invoice.invoiceNumber}</Text>
              </>
            )}
            <Text style={styles.label}>Fecha de emisión</Text>
            <Text style={{ marginBottom: 6 }}>{new Date(invoice.issueDate).toLocaleDateString("es-ES")}</Text>
            {invoice.dueDate && (
              <>
                <Text style={styles.label}>Vencimiento</Text>
                <Text>{new Date(invoice.dueDate).toLocaleDateString("es-ES")}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.clientBox}>
          <Text style={styles.clientName}>{client.name}</Text>
          {client.taxId ? <Text style={styles.small}>NIF: {client.taxId}</Text> : null}
          {client.address ? <Text style={styles.small}>{client.address}</Text> : null}
          {client.postalCode || client.city ? (
            <Text style={styles.small}>
              {client.postalCode} {client.city}
              {client.province ? `, ${client.province}` : ""}
            </Text>
          ) : null}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.cellConcept]}>Concepto</Text>
            <Text style={[styles.tableHeaderCell, styles.cellQty]}>Cant.</Text>
            <Text style={[styles.tableHeaderCell, styles.cellPrice]}>Precio</Text>
            <Text style={[styles.tableHeaderCell, styles.cellVat]}>IVA</Text>
            <Text style={[styles.tableHeaderCell, styles.cellTotal]}>Total</Text>
          </View>
          {lineItems.map((li) => (
            <View style={styles.tableRow} key={li.id}>
              <Text style={styles.cellConcept}>{li.concept}</Text>
              <Text style={styles.cellQty}>{li.quantity}</Text>
              <Text style={styles.cellPrice}>{money(li.unitPrice)}</Text>
              <Text style={styles.cellVat}>{li.vatRate}%</Text>
              <Text style={styles.cellTotal}>{money(li.quantity * li.unitPrice)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text>Base imponible</Text>
            <Text>{money(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>IVA</Text>
            <Text>{money(invoice.vatAmount)}</Text>
          </View>
          <View style={styles.totalsFinalRow}>
            <Text style={styles.totalsFinalLabel}>Total</Text>
            <Text style={styles.totalsFinalValue}>{money(invoice.total)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {company.bankAccount ? <Text style={styles.small}>Forma de pago — transferencia a: {company.bankAccount}</Text> : null}
          {invoice.notes ? <Text style={styles.small}>{invoice.notes}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}
