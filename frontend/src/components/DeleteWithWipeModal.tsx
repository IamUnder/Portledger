import { useState } from "react";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";

// Confirmación de borrado compartida entre "eliminar proyecto" y "eliminar servicio": siempre dejar
// de rastrearlo en el panel, con la opción extra de borrar también lo real del servidor (contenedores,
// volúmenes, carpeta del repo según el caso) — por defecto sin marcar, para que "eliminar" nunca
// sea destructivo por accidente.
export function DeleteWithWipeModal({
  title,
  description,
  wipeLabel,
  wipeWarning,
  onClose,
  onConfirm,
}: {
  title: string;
  description?: string;
  wipeLabel: string;
  wipeWarning?: string;
  onClose: () => void;
  onConfirm: (wipeServer: boolean) => void | Promise<void>;
}) {
  const [wipeServer, setWipeServer] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(wipeServer);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy} autoFocus>
            {busy ? "Eliminando…" : "Eliminar"}
          </Button>
        </>
      }
    >
      <label className="flex items-start gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={wipeServer}
          onChange={(e) => setWipeServer(e.target.checked)}
          className="mt-0.5 accent-red-500"
        />
        <span>{wipeLabel}</span>
      </label>
      {wipeServer && wipeWarning && <p className="mt-2 text-xs text-red-400">{wipeWarning}</p>}
    </Modal>
  );
}
