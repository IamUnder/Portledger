import { useState } from "react";
import { api } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";

export function ResetPasswordModal({ userId, email, onClose }: { userId: string; email: string; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.setUserPassword(userId, password);
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={`Cambiar contraseña de ${email}`}
      size="sm"
      footer={
        done ? (
          <Button className="w-full" onClick={onClose}>
            Cerrar
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className="text-sm text-emerald-400">Contraseña actualizada.</p>
      ) : (
        <>
          <label className="mb-1 block text-xs font-medium text-slate-400">Nueva contraseña (mín. 8 caracteres)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
            autoFocus
          />
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </>
      )}
    </Modal>
  );
}
