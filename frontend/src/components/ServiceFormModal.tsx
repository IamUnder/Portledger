import { useState } from "react";
import { api } from "../api";
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

export function ServiceFormModal({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [containerName, setContainerName] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  const save = async () => {
    if (!name.trim()) return setError("el nombre es obligatorio (debe coincidir con el del docker-compose.yml)");
    setSaving(true);
    setError(null);
    try {
      await api.createService(projectId, {
        name: name.trim(),
        containerName: containerName.trim() || undefined,
        repoPath: repoPath.trim() || undefined,
        repoUrl: repoUrl.trim() || undefined,
        branch: branch.trim() || undefined,
      });
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
      title="Añadir servicio"
      description="Para un servicio que ya añadiste al docker-compose.yml del proyecto por fuera del panel."
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
        <Field label="Nombre (debe coincidir con el del compose, ej. 'web')">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="web" className={`${inputClass} font-mono text-xs`} autoFocus />
        </Field>
        <Field label="Nombre del contenedor (si difiere del anterior)">
          <input value={containerName} onChange={(e) => setContainerName(e.target.value)} placeholder="ej. aquacontract-web" className={`${inputClass} font-mono text-xs`} />
        </Field>
        <Field label="Repositorio git (opcional, para poder desplegar desde el panel)">
          <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/usuario/repo.git" className={`${inputClass} font-mono text-xs`} />
        </Field>
        {repoUrl && (
          <>
            <Field label="Ruta local del checkout">
              <input value={repoPath} onChange={(e) => setRepoPath(e.target.value)} placeholder="/home/under/proyecto/web" className={`${inputClass} font-mono text-xs`} />
            </Field>
            <Field label="Rama">
              <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" className={inputClass} />
            </Field>
          </>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
