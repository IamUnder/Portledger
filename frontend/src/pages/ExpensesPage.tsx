import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Wallet, Download } from "lucide-react";
import { api, type Expense } from "../api";
import { ExpenseFormModal } from "../components/ExpenseFormModal";
import { Button } from "../components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { EmptyState } from "../components/ui/empty-state";
import { useConfirm } from "../components/ui/confirm-dialog";
import { downloadCsv } from "../lib/csv";

const CATEGORY_LABEL: Record<string, string> = {
  SOFTWARE: "Software",
  HOSTING: "Hosting / infra",
  MATERIALES: "Materiales",
  SERVICIOS: "Servicios",
  OTRO: "Otro",
};

export function ExpensesPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<Expense[] | null>(null);
  const [editing, setEditing] = useState<Expense | null | undefined>(undefined);

  const load = () => {
    api.expenses().then(setItems);
  };
  useEffect(load, []);

  const remove = async (e: Expense) => {
    if (!(await confirm({ title: `¿Eliminar el gasto "${e.concept}"?`, destructive: true }))) return;
    await api.deleteExpense(e.id);
    load();
  };

  const exportCsv = () => {
    if (!items) return;
    downloadCsv(
      "gastos.csv",
      ["fecha", "concepto", "categoria", "proyecto", "importe"],
      items.map((e) => [new Date(e.date).toLocaleDateString("es-ES"), e.concept, CATEGORY_LABEL[e.category] ?? e.category, e.project?.name ?? "", e.amount.toFixed(2)])
    );
  };

  const total = items?.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-100">Gastos</h1>
        <div className="flex items-center gap-2">
          {items && items.length > 0 && (
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          )}
          <Button size="sm" onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        </div>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Costes del negocio (hosting, software, materiales...) para calcular el margen real en{" "}
        <Link to="/informes" className="text-indigo-400 hover:text-indigo-300">
          Informes
        </Link>
        , no solo la facturación bruta.
      </p>

      {items?.length === 0 && (
        <EmptyState
          icon={Wallet}
          title="Sin gastos registrados"
          description="Añade aquí los costes del negocio para que Informes pueda calcular el margen, no solo lo facturado."
          action={
            <Button size="sm" onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4" /> Nuevo
            </Button>
          }
        />
      )}

      {items && items.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>fecha</TableHead>
                <TableHead>concepto</TableHead>
                <TableHead>categoría</TableHead>
                <TableHead>proyecto</TableHead>
                <TableHead className="text-right">importe</TableHead>
                <TableHead className="text-right">acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">{new Date(e.date).toLocaleDateString("es-ES")}</TableCell>
                  <TableCell>{e.concept}</TableCell>
                  <TableCell className="text-slate-400">{CATEGORY_LABEL[e.category] ?? e.category}</TableCell>
                  <TableCell className="text-slate-400">
                    {e.project ? (
                      <Link to={`/projects/${e.project.id}`} className="text-indigo-300 transition-colors hover:text-indigo-200">
                        {e.project.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-red-400">{e.amount.toFixed(2)} €</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(e)} className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-indigo-300">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove(e)} className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-right text-sm text-slate-400">
            Total: <span className="font-medium text-slate-200">{total.toFixed(2)} €</span>
          </p>
        </>
      )}

      {editing !== undefined && <ExpenseFormModal existing={editing} onClose={() => setEditing(undefined)} onSaved={load} />}
    </div>
  );
}
