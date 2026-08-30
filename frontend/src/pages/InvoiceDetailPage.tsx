import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, MinusCircle, X, FileDown, Mail, Trash2, CheckCircle2 } from "lucide-react";
import { api, type Invoice, type InvoiceLineItem } from "../api";
import { useMe } from "../MeContext";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { SkeletonCard } from "../components/ui/skeleton";
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

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const load = () => {
    if (!id) return;
    api.invoice(id).then((inv) => {
      setInvoice(inv);
      setLineItems(inv.lineItems);
      setDirty(false);
    });
  };
  useEffect(load, [id]);

  if (!invoice) return <SkeletonCard />;

  const isDraft = invoice.status === "DRAFT";
  const canEdit = me.role === "ADMIN" && isDraft;

  const totals = lineItems.reduce(
    (acc, li) => {
      const base = li.quantity * li.unitPrice;
      acc.subtotal += base;
      acc.vat += base * (li.vatRate / 100);
      return acc;
    },
    { subtotal: 0, vat: 0 }
  );

  const updateLine = (i: number, patch: Partial<InvoiceLineItem>) => {
    setLineItems((arr) => arr.map((li, j) => (j === i ? { ...li, ...patch } : li)));
    setDirty(true);
  };

  const saveLines = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateInvoice(id, { lineItems });
      setInvoice(updated);
      setLineItems(updated.lineItems);
      setDirty(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const confirmInvoiceAction = async () => {
    if (!id) return;
    if (dirty) return setError("guarda los cambios antes de confirmar");
    if (!(await confirm({ title: "¿Confirmar factura?", description: "Se asigna número de factura definitivo y ya no se podrán editar las líneas." }))) return;
    try {
      const updated = await api.confirmInvoice(id);
      setInvoice(updated);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const markPaid = async () => {
    if (!id) return;
    const updated = await api.updateInvoice(id, { status: "PAID" });
    setInvoice(updated);
  };

  const remove = async () => {
    if (!id) return;
    if (!(await confirm({ title: "¿Eliminar esta factura en borrador?", destructive: true }))) return;
    await api.deleteInvoice(id);
    navigate("/facturas");
  };

  const sendEmail = async () => {
    if (!id) return;
    setSendingEmail(true);
    setError(null);
    try {
      const updated = await api.sendInvoiceEmail(id);
      setInvoice(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSendingEmail(false);
    }
  };

  const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/facturas" className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-300">
        <ArrowLeft className="h-3.5 w-3.5" /> facturas
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">{invoice.invoiceNumber ?? "Presupuesto (borrador)"}</h1>
          {invoice.client && (
            <Link to={`/clientes/${invoice.clientId}`} className="text-xs text-indigo-400 transition-colors hover:text-indigo-300">
              {invoice.client.name}
            </Link>
          )}
        </div>
        <div className="text-right">
          <Badge variant={STATUS_VARIANT[invoice.status]}>{STATUS_LABEL[invoice.status]}</Badge>
          {invoice.emailSentAt && <div className="mt-1 text-[11px] text-slate-600">enviada por email el {new Date(invoice.emailSentAt).toLocaleDateString("es-ES")}</div>}
        </div>
      </div>

      <Card className="mb-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">concepto</th>
              <th className="px-3 py-2 font-medium">cant.</th>
              <th className="px-3 py-2 font-medium">precio</th>
              <th className="px-3 py-2 font-medium">iva</th>
              <th className="px-3 py-2 font-medium">total</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, i) => (
              <tr key={i} className="border-b border-slate-800/60 transition-colors hover:bg-slate-800/20">
                <td className="px-3 py-2">
                  {canEdit ? (
                    <input value={li.concept} onChange={(e) => updateLine(i, { concept: e.target.value })} className={inputClass} />
                  ) : (
                    <span className="text-slate-300">{li.concept}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <input type="number" value={li.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} className={`${inputClass} w-16`} />
                  ) : (
                    li.quantity
                  )}
                </td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <input type="number" value={li.unitPrice} onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })} className={`${inputClass} w-20`} />
                  ) : (
                    `${li.unitPrice.toFixed(2)} €`
                  )}
                </td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <input type="number" value={li.vatRate} onChange={(e) => updateLine(i, { vatRate: Number(e.target.value) })} className={`${inputClass} w-14`} />
                  ) : (
                    `${li.vatRate}%`
                  )}
                </td>
                <td className="px-3 py-2 text-slate-300">{(li.quantity * li.unitPrice).toFixed(2)} €</td>
                {canEdit && (
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => {
                        setLineItems((arr) => arr.filter((_, j) => j !== i));
                        setDirty(true);
                      }}
                      className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {canEdit && (
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => {
              setLineItems((arr) => [...arr, { concept: "", quantity: 1, unitPrice: 0, vatRate: 21 }]);
              setDirty(true);
            }}
            className="flex items-center gap-1 text-xs text-indigo-300 transition-colors hover:text-indigo-200"
          >
            <Plus className="h-3.5 w-3.5" /> añadir línea
          </button>
          <button
            onClick={() => {
              setLineItems((arr) => [...arr, { concept: "Descuento", quantity: 1, unitPrice: 0, vatRate: 0 }]);
              setDirty(true);
            }}
            className="flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            <MinusCircle className="h-3.5 w-3.5" /> añadir descuento (importe negativo)
          </button>
        </div>
      )}

      <div className="mb-6 ml-auto w-56 space-y-1 text-sm">
        <div className="flex justify-between text-slate-500">
          <span>Base imponible</span>
          <span>{totals.subtotal.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>IVA</span>
          <span>{totals.vat.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between border-t border-slate-800 pt-1 font-semibold text-slate-200">
          <span>Total</span>
          <span>{(totals.subtotal + totals.vat).toFixed(2)} €</span>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {canEdit && dirty && (
          <Button onClick={saveLines} disabled={saving}>
            {saving ? "guardando…" : "Guardar cambios"}
          </Button>
        )}
        {canEdit && !dirty && (
          <Button variant="outline" className="border-emerald-800/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300" onClick={confirmInvoiceAction}>
            <CheckCircle2 className="h-4 w-4" /> Confirmar factura (asigna número)
          </Button>
        )}
        {me.role === "ADMIN" && invoice.status !== "PAID" && invoice.status !== "DRAFT" && (
          <Button variant="outline" className="border-emerald-800/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300" onClick={markPaid}>
            <CheckCircle2 className="h-4 w-4" /> Marcar pagada
          </Button>
        )}
        <Button variant="secondary" asChild>
          <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
            <FileDown className="h-4 w-4" /> Ver PDF
          </a>
        </Button>
        {me.role === "ADMIN" && (
          <Button variant="secondary" onClick={sendEmail} disabled={sendingEmail || !invoice.client?.email} title={!invoice.client?.email ? "el cliente no tiene email configurado" : undefined}>
            <Mail className="h-4 w-4" /> {sendingEmail ? "enviando…" : "Enviar por email"}
          </Button>
        )}
        {canEdit && (
          <Button variant="ghost" className="text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={remove}>
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        )}
      </div>
    </div>
  );
}
