import { useState } from "react";
import { api } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";

export function AccountFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !accountId.trim()) return setError("nombre y account_id son obligatorios");
    setSaving(true);
    setError(null);
    try {
      await api.createCfAccount(name.trim(), accountId.trim(), apiToken.trim() || undefined);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  return (
    <Modal
      onClose={onClose}
      title="Añadir cuenta de Cloudflare"
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
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Cliente XYZ" className={inputClass} autoFocus />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Account ID de Cloudflare</label>
          <input
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="visible en el dashboard, sidebar derecho"
            className={`${inputClass} font-mono text-xs`}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">API Token (opcional — sin él, los túneles de esta cuenta solo quedan documentados)</label>
          <input
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="permiso: Cloudflare Tunnel: Edit"
            type="password"
            className={`${inputClass} font-mono text-xs`}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
