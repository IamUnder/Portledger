import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Settings, FileDown, CheckCircle2, Trash2, Receipt, Repeat } from "lucide-react";
import { api, type Invoice } from "../api";
import { CompanySettingsModal } from "../components/CompanySettingsModal";
import { useMe } from "../MeContext";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { SkeletonTable } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { useConfirm } from "../components/ui/confirm-dialog";

const STATUS_VARIANT: Record<string, "neutral" | "info" | "success" | "danger"> = {
  DRAFT: "neutral",
  SENT: "info",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "borrador",
  SENT: "enviada",
  PAID: "pagada",
  OVERDUE: "vencida",
  CANCELLED: "cancelada",
};

export function InvoicesPage() {
  const me = useMe();
  const confirm = useConfirm();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const load = () => {
    api.invoices().then(setInvoices);
  };
  useEffect(load, []);

  const markPaid = async (inv: Invoice) => {
    await api.updateInvoice(inv.id, { status: "PAID" });
    load();
  };

  const remove = async (inv: Invoice) => {
    if (!(await confirm({ title: `¿Eliminar la factura ${inv.invoiceNumber}?`, description: "Solo es posible en borrador.", destructive: true }))) return;
    try {
      await api.deleteInvoice(inv.id);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const pendingTotal = invoices?.filter((i) => i.status === "SENT" || i.status === "OVERDUE").reduce((s, i) => s + i.total, 0) ?? 0;
  const overdueCount = invoices?.filter((i) => i.status === "OVERDUE").length ?? 0;
  const paidTotal = invoices?.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0) ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Facturas</h1>
        {me.role === "ADMIN" && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" asChild>
              <Link to="/facturas/recurrentes">
                <Repeat className="h-4 w-4" /> Recurrentes
              </Link>
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowSettings(true)}>
              <Settings className="h-4 w-4" /> Datos fiscales
            </Button>
          </div>
        )}
      </div>

      {invoices && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Pendiente de cobro</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{pendingTotal.toFixed(2)} €</div>
            {overdueCount > 0 && <div className="mt-0.5 text-xs text-red-400">{overdueCount} vencida(s)</div>}
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Cobrado (histórico)</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-400">{paidTotal.toFixed(2)} €</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total facturas</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{invoices.length}</div>
          </Card>
        </div>
      )}

      {!invoices && <SkeletonTable cols={6} />}

      {invoices?.length === 0 && <EmptyState icon={Receipt} title="Sin facturas todavía" description="Genera la primera desde un albarán o desde la ficha de un cliente." />}

      {invoices && invoices.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>número</TableHead>
              <TableHead>cliente</TableHead>
              <TableHead>fecha</TableHead>
              <TableHead>total</TableHead>
              <TableHead>estado</TableHead>
              <TableHead className="text-right">acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono">
                  <Link to={`/facturas/${inv.id}`} className="text-indigo-300 transition-colors hover:text-indigo-200">
                    {inv.invoiceNumber ?? "(borrador)"}
                  </Link>
                </TableCell>
                <TableCell>
                  {inv.client && (
                    <Link to={`/clientes/${inv.clientId}`} className="text-indigo-400 transition-colors hover:text-indigo-300">
                      {inv.client.name}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="text-slate-500">{new Date(inv.issueDate).toLocaleDateString("es-ES")}</TableCell>
                <TableCell>{inv.total.toFixed(2)} €</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <a
                      href={`/api/invoices/${inv.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      title="ver PDF"
                      className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-indigo-300"
                    >
                      <FileDown className="h-4 w-4" />
                    </a>
                    {me.role === "ADMIN" && inv.status !== "PAID" && (
                      <button
                        onClick={() => markPaid(inv)}
                        title="marcar pagada"
                        className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-emerald-400"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                    {me.role === "ADMIN" && inv.status === "DRAFT" && (
                      <button
                        onClick={() => remove(inv)}
                        title="eliminar"
                        className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {showSettings && <CompanySettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
