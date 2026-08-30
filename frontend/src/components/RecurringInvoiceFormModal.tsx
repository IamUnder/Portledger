import { useEffect, useState } from "react";
import { api, type RecurringInvoice, type Client } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

export function RecurringInvoiceFormModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: RecurringInvoice | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState(existing?.clientId ?? "");
  const [concept, setConcept] = useState(existing?.concept ?? "");
  const [quantity, setQuantity] = useState(existing?.quantity ?? 1);
  const [unitPrice, setUnitPrice] = useState(existing?.unitPrice ?? 0);
  const [vatRate, setVatRate] = useState(existing?.vatRate ?? 21);
  const [dayOfMonth, setDayOfMonth] = useState(existing?.dayOfMonth ?? 1);
  const [active, setActive] = useState(existing?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.clients().then(setClients);
  }, []);

  const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  const save = async () => {
    if (!clientId) return setError("elige un cliente");
    if (!concept.trim()) return setError("el concepto es obligatorio");
    setSaving(true);
    setError(null);
    const data = { clientId, concept, quantity, unitPrice, vatRate, dayOfMonth, active };
    try {
      if (existing) await api.updateRecurringInvoice(existing.id, data);
      else await api.createRecurringInvoice(data);
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
      title={existing ? "Editar factura recurrente" : "Nueva factura recurrente"}
      description="Cada mes, a partir del día elegido, se genera un borrador con esta línea — nunca se confirma ni numera sola."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Cliente">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
            <option value="">elige un cliente…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Concepto">
          <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="ej. Mantenimiento mensual" className={inputClass} autoFocus />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Field label="Cantidad">
            <input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Precio unidad (€)">
            <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="IVA (%)">
            <input type="number" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} className={inputClass} />
          </Field>
        </div>
        <Field label="Día del mes en que se genera (1-28)">
          <input type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} className={inputClass} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-indigo-500" />
          activa
        </label>
        <p className="text-right text-xs text-slate-500">
          total con IVA: <span className="text-slate-300">{(quantity * unitPrice * (1 + vatRate / 100)).toFixed(2)} €</span>
        </p>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
