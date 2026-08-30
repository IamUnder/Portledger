import { useState } from "react";
import { api } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";

export function UserFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "COLLABORATOR">("COLLABORATOR");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.createUser(email, password, role);
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
      title="Nuevo usuario"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Creando…" : "Crear usuario"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Contraseña (mín. 8 caracteres)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Rol</label>
          <select value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "COLLABORATOR")} className={inputClass}>
            <option value="COLLABORATOR">Colaborador</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>
      </div>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
