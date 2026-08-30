import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Repeat } from "lucide-react";
import { api, type RecurringInvoice } from "../api";
import { RecurringInvoiceFormModal } from "../components/RecurringInvoiceFormModal";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { EmptyState } from "../components/ui/empty-state";
import { useConfirm } from "../components/ui/confirm-dialog";

export function RecurringInvoicesPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<RecurringInvoice[] | null>(null);
  const [editing, setEditing] = useState<RecurringInvoice | null | undefined>(undefined);

  const load = () => {
    api.recurringInvoices().then(setItems);
  };
  useEffect(load, []);

  const toggleActive = async (r: RecurringInvoice) => {
    await api.updateRecurringInvoice(r.id, { active: !r.active });
    load();
  };

  const remove = async (r: RecurringInvoice) => {
    if (!(await confirm({ title: `¿Eliminar la factura recurrente de "${r.client?.name}"?`, description: r.concept, destructive: true }))) return;
    await api.deleteRecurringInvoice(r.id);
    load();
  };

  return (
    <div>
      <Link to="/facturas" className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-300">
        <ArrowLeft className="h-3.5 w-3.5" /> facturas
      </Link>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Facturas recurrentes</h1>
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" /> Nueva
        </Button>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Cada mes se genera un borrador automáticamente — revísalo y confírmalo desde Facturas cuando quieras.
      </p>

      {items?.length === 0 && (
        <EmptyState
          icon={Repeat}
          title="Sin facturas recurrentes"
          description="Úsalo para clientes con una cuota fija (mantenimiento, hosting...) que facturas todos los meses."
          action={
            <Button size="sm" onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4" /> Nueva
            </Button>
          }
        />
      )}

      {items && items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>cliente</TableHead>
              <TableHead>concepto</TableHead>
              <TableHead>importe</TableHead>
              <TableHead>día</TableHead>
              <TableHead>última generada</TableHead>
              <TableHead>estado</TableHead>
              <TableHead className="text-right">acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link to={`/clientes/${r.clientId}`} className="text-indigo-300 transition-colors hover:text-indigo-200">
                    {r.client?.name}
                  </Link>
                </TableCell>
                <TableCell>{r.concept}</TableCell>
                <TableCell className="text-slate-400">
                  {r.quantity} × {r.unitPrice}€ (+{r.vatRate}%)
                </TableCell>
                <TableCell className="text-slate-400">día {r.dayOfMonth}</TableCell>
                <TableCell className="text-xs text-slate-500">{r.lastRunAt ? new Date(r.lastRunAt).toLocaleDateString("es-ES") : "nunca"}</TableCell>
                <TableCell>
                  <button onClick={() => toggleActive(r)}>
                    <Badge variant={r.active ? "success" : "neutral"}>{r.active ? "activa" : "pausada"}</Badge>
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditing(r)} className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-indigo-300">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => remove(r)} className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editing !== undefined && <RecurringInvoiceFormModal existing={editing} onClose={() => setEditing(undefined)} onSaved={load} />}
    </div>
  );
}
