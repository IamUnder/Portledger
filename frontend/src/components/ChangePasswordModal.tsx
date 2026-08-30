import { useState } from "react";
import { api } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.changeOwnPassword(currentPassword, newPassword);
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  return (
    <Modal
      onClose={onClose}
      title="Cambiar mi contraseña"
      size="sm"
      footer={
        done ? undefined : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form="change-password-form">
              Guardar
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div>
          <p className="mb-4 text-sm text-emerald-400">Contraseña actualizada.</p>
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      ) : (
        <form id="change-password-form" onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Contraseña actual</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Nueva contraseña</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
