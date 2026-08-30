import { useEffect, useState } from "react";
import { api, type DeliveryNote } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";

export function GenerateInvoiceModal({
  clientId,
  onClose,
  onSaved,
}: {
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState<DeliveryNote[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.deliveryNotes(clientId).then((notes) => setPending(notes.filter((n) => n.status === "PENDING")));
  }, [clientId]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const total = pending.filter((n) => selected.has(n.id)).reduce((s, n) => s + n.quantity * n.unitPrice * (1 + n.vatRate / 100), 0);

  const generate = async () => {
    if (selected.size === 0) return setError("elige al menos un albarán");
    setSaving(true);
    setError(null);
    try {
      await api.createInvoiceFromDeliveryNotes(clientId, [...selected]);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Generar factura desde albaranes"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            className="border-emerald-800/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
            onClick={generate}
            disabled={saving || pending.length === 0}
          >
            {saving ? "Generando…" : "Generar factura"}
          </Button>
        </>
      }
    >
      {pending.length === 0 && <p className="mb-4 text-sm text-slate-600">no hay albaranes pendientes para este cliente</p>}

      <div className="mb-4 max-h-64 space-y-1.5 overflow-auto">
        {pending.map((n) => (
          <label key={n.id} className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-2 text-xs transition-colors hover:border-slate-700">
            <input type="checkbox" checked={selected.has(n.id)} onChange={() => toggle(n.id)} className="accent-indigo-500" />
            <span className="flex-1 text-slate-300">{n.concept}</span>
            <span className="text-slate-500">
              {n.quantity} × {n.unitPrice}€ (+{n.vatRate}%)
            </span>
          </label>
        ))}
      </div>

      {selected.size > 0 && (
        <p className="mb-3 text-right text-xs text-slate-400">
          total con IVA: <span className="text-slate-200">{total.toFixed(2)} €</span>
        </p>
      )}

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
