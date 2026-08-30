import { useState } from "react";
import { api, type Client } from "../api";

export function ClientFormModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: Client | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    contactName: existing?.contactName ?? "",
    email: existing?.email ?? "",
    phone: existing?.phone ?? "",
    taxId: existing?.taxId ?? "",
    address: existing?.address ?? "",
    city: existing?.city ?? "",
    postalCode: existing?.postalCode ?? "",
    province: existing?.province ?? "",
    country: existing?.country ?? "España",
    status: existing?.status ?? "LEAD",
    notes: existing?.notes ?? "",
    defaultHourlyRate: existing?.defaultHourlyRate ?? ("" as number | ""),
    autoPaymentReminders: existing?.autoPaymentReminders ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.name.trim()) return setError("el nombre es obligatorio");
    setSaving(true);
    setError(null);
    const data = { ...form, defaultHourlyRate: form.defaultHourlyRate === "" ? undefined : form.defaultHourlyRate };
    try {
      if (existing) await api.updateClient(existing.id, data);
      else await api.createClient(data);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-[28rem] overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-5"
      >
        <h2 className="mb-4 text-sm font-semibold text-slate-100">{existing ? "Editar cliente" : "Nuevo cliente"}</h2>

        <input
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Nombre / razón social"
          className="mb-2 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          autoFocus
        />
        <div className="mb-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={form.contactName}
            onChange={(e) => set({ contactName: e.target.value })}
            placeholder="persona de contacto"
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
          <select
            value={form.status}
            onChange={(e) => set({ status: e.target.value })}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          >
            <option value="LEAD">Lead</option>
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
          </select>
        </div>
        <div className="mb-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="email"
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
          <input
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
            placeholder="teléfono"
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>

        <input
          type="number"
          value={form.defaultHourlyRate}
          onChange={(e) => set({ defaultHourlyRate: e.target.value === "" ? "" : Number(e.target.value) })}
          placeholder="tarifa por hora por defecto (€/h)"
          className="mb-2 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        />

        <div className="mb-2 border-t border-slate-800 pt-3 text-xs text-slate-500">Datos fiscales (para facturas)</div>
        <input
          value={form.taxId}
          onChange={(e) => set({ taxId: e.target.value })}
          placeholder="NIF / CIF"
          className="mb-2 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        />
        <input
          value={form.address}
          onChange={(e) => set({ address: e.target.value })}
          placeholder="dirección"
          className="mb-2 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        />
        <div className="mb-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            value={form.postalCode}
            onChange={(e) => set({ postalCode: e.target.value })}
            placeholder="CP"
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
          <input
            value={form.city}
            onChange={(e) => set({ city: e.target.value })}
            placeholder="ciudad"
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
          <input
            value={form.province}
            onChange={(e) => set({ province: e.target.value })}
            placeholder="provincia"
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>

        <textarea
          value={form.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="notas"
          className="mb-2 h-16 w-full resize-none rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        />

        <label className="mb-4 flex items-start gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={form.autoPaymentReminders}
            onChange={(e) => set({ autoPaymentReminders: e.target.checked })}
            className="mt-0.5 accent-indigo-500"
          />
          <span>Enviarle un recordatorio de pago automático por email si una factura suya vence sin cobrarse</span>
        </label>

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
            cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {saving ? "guardando…" : "guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
