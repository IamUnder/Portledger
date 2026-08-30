import { useState } from "react";
import { api, type DeliveryNote } from "../api";
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

export function DeliveryNoteFormModal({
  clientId,
  existing,
  defaultVatRate,
  onClose,
  onSaved,
}: {
  clientId: string;
  existing?: DeliveryNote | null;
  defaultVatRate: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [concept, setConcept] = useState(existing?.concept ?? "");
  const [quantity, setQuantity] = useState(existing?.quantity ?? 1);
  const [unitPrice, setUnitPrice] = useState(existing?.unitPrice ?? 0);
  const [vatRate, setVatRate] = useState(existing?.vatRate ?? defaultVatRate);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!concept.trim()) return setError("el concepto es obligatorio");
    setSaving(true);
    try {
      if (existing) await api.updateDeliveryNote(existing.id, { concept, quantity, unitPrice, vatRate });
      else await api.createDeliveryNote({ clientId, concept, quantity, unitPrice, vatRate });
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
      title={existing ? "Editar albarán" : "Nuevo albarán"}
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
        <Field label="Concepto">
          <input
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="ej. Mantenimiento agosto"
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            autoFocus
          />
        </Field>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <Field label="Cantidad">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </Field>
          <Field label="Precio unidad (€)">
            <input
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </Field>
          <Field label="IVA (%)">
            <input
              type="number"
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </Field>
        </div>

        <p className="mb-2 mt-3 text-right text-xs text-slate-500">
          total con IVA: <span className="text-slate-300">{(quantity * unitPrice * (1 + vatRate / 100)).toFixed(2)} €</span>
        </p>

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
