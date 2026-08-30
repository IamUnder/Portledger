import { useEffect, useMemo, useState } from "react";
import { api, type TimeEntry, type Client } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function GenerateDeliveryNoteFromTimeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.clients().then(setClients);
  }, []);

  useEffect(() => {
    setSelected(new Set());
    if (!clientId) {
      setEntries([]);
      return;
    }
    api.timeEntries({ clientId }).then((all) => setEntries(all.filter((e) => !e.deliveryNoteId && e.minutes)));
  }, [clientId]);

  const rates = new Set(entries.filter((e) => selected.has(e.id)).map((e) => e.hourlyRate));
  const selectedEntries = entries.filter((e) => selected.has(e.id));
  const canGenerate = selectedEntries.length > 0 && rates.size === 1 && selectedEntries[0].hourlyRate != null;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalHours = selectedEntries.reduce((s, e) => s + (e.minutes ?? 0), 0) / 60;
  const rate = selectedEntries[0]?.hourlyRate ?? 0;

  const generate = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.generateDeliveryNoteFromTime([...selected]);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  return (
    <Modal
      onClose={onClose}
      title="Añadir registros de horas a una factura"
      description="Se agrupan en un albarán que luego puedes convertir en factura desde la ficha del cliente."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={generate} disabled={!canGenerate || saving}>
            {saving ? "Generando…" : `Generar albarán${selectedEntries.length > 0 ? ` (${selectedEntries.length})` : ""}`}
          </Button>
        </>
      }
    >
      <label className="mb-1 block text-xs font-medium text-slate-400">Cliente</label>
      <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${selectClass} mb-4`}>
        <option value="">elige un cliente…</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {clientId && entries.length === 0 && <p className="text-sm text-slate-600">este cliente no tiene registros de horas pendientes de facturar.</p>}

      {entries.length > 0 && (
        <div className="max-h-72 space-y-1.5 overflow-auto">
          {entries.map((e) => (
            <label key={e.id} className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-2 text-xs transition-colors hover:border-slate-700">
              <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="accent-indigo-500" />
              <span className="flex-1 text-slate-300">{e.description}</span>
              <span className="text-slate-600">{new Date(e.startedAt).toLocaleDateString("es-ES")}</span>
              <span className="text-slate-500">{formatHours(e.minutes ?? 0)}</span>
              <span className={e.hourlyRate ? "text-slate-400" : "text-amber-400"}>{e.hourlyRate ? `${e.hourlyRate}€/h` : "sin tarifa"}</span>
            </label>
          ))}
        </div>
      )}

      {selectedEntries.length > 0 && rates.size > 1 && (
        <p className="mt-3 text-xs text-amber-400">Los registros seleccionados tienen tarifas distintas — selecciona solo los que compartan la misma.</p>
      )}
      {selectedEntries.length > 0 && rates.size === 1 && selectedEntries[0].hourlyRate == null && (
        <p className="mt-3 text-xs text-amber-400">Estos registros no tienen tarifa por hora asignada — edítalos primero para poder facturarlos.</p>
      )}
      {canGenerate && (
        <p className="mt-3 text-right text-xs text-slate-400">
          {totalHours.toFixed(2)}h × {rate}€/h = <span className="text-slate-200">{(totalHours * rate).toFixed(2)} €</span>
        </p>
      )}

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
