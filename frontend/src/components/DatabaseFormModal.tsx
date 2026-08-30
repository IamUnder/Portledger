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

export function DatabaseFormModal({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("Base de datos principal");
  const [engine, setEngine] = useState<"MYSQL" | "POSTGRES">("MYSQL");
  const [containerName, setContainerName] = useState("");
  const [databaseName, setDatabaseName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  const save = async () => {
    if (!label.trim() || !containerName.trim() || !databaseName.trim()) {
      return setError("nombre, contenedor y base de datos son obligatorios");
    }
    setSaving(true);
    setError(null);
    try {
      await api.createDatabase(projectId, { label, engine, containerName, databaseName, username, password });
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
      title="Añadir base de datos"
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
          <Field label="Nombre (etiqueta)">
            <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} autoFocus />
          </Field>
          <Field label="Motor">
            <select value={engine} onChange={(e) => setEngine(e.target.value as "MYSQL" | "POSTGRES")} className={inputClass}>
              <option value="MYSQL">MySQL</option>
              <option value="POSTGRES">Postgres</option>
            </select>
          </Field>
          <Field label="Contenedor">
            <input
              value={containerName}
              onChange={(e) => setContainerName(e.target.value)}
              placeholder="ej. odoo-db"
              className={`${inputClass} font-mono text-xs`}
            />
          </Field>
          <Field label="Nombre de la base de datos">
            <input value={databaseName} onChange={(e) => setDatabaseName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Usuario">
            <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Contraseña">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </Field>
        </div>

        {error && <p className="mb-3 mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
