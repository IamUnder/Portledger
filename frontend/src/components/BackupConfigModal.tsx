import { useState } from "react";
import { Plus, X } from "lucide-react";
import { api, type BackupConfig, type BackupTarget, type TargetType } from "../api";
import { CRON_PRESETS } from "../cron";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";

const EMPTY_TARGET: BackupTarget = { type: "PATH", hostPath: "" };

function TargetEditor({
  target,
  onChange,
  onRemove,
}: {
  target: BackupTarget;
  onChange: (t: BackupTarget) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<BackupTarget>) => onChange({ ...target, ...patch });

  return (
    <div className="mb-2 rounded border border-slate-800 bg-slate-950/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <select
          value={target.type}
          onChange={(e) => set({ type: e.target.value as TargetType })}
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
        >
          <option value="MYSQL">Dump MySQL</option>
          <option value="POSTGRES">Dump Postgres</option>
          <option value="SQLITE">Base de datos SQLite (backup en caliente)</option>
          <option value="CONTAINER_PATH">Ruta dentro de un contenedor</option>
          <option value="PATH">Ruta del host</option>
        </select>
        <button onClick={onRemove} className="flex items-center gap-1 text-xs text-red-400 transition-colors hover:text-red-300">
          <X className="h-3 w-3" /> quitar
        </button>
      </div>

      {(target.type === "MYSQL" || target.type === "POSTGRES") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            placeholder="contenedor (ej. odoo-db)"
            value={target.containerName ?? ""}
            onChange={(e) => set({ containerName: e.target.value })}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
          />
          <input
            placeholder="base de datos"
            value={target.database ?? ""}
            onChange={(e) => set({ database: e.target.value })}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
          />
          <input
            placeholder="usuario"
            value={target.username ?? ""}
            onChange={(e) => set({ username: e.target.value })}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
          />
          <input
            placeholder="contraseña"
            type="password"
            value={target.password ?? ""}
            onChange={(e) => set({ password: e.target.value })}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
          />
        </div>
      )}

      {target.type === "CONTAINER_PATH" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            placeholder="contenedor (ej. odoo-web)"
            value={target.containerName ?? ""}
            onChange={(e) => set({ containerName: e.target.value })}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
          />
          <input
            placeholder="ruta dentro del contenedor"
            value={target.containerPath ?? ""}
            onChange={(e) => set({ containerPath: e.target.value })}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
          />
        </div>
      )}

      {target.type === "PATH" && (
        <input
          placeholder="/home/under/..."
          value={target.hostPath ?? ""}
          onChange={(e) => set({ hostPath: e.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
        />
      )}

      {target.type === "SQLITE" && (
        <input
          placeholder="/home/under/.../archivo.db"
          value={target.hostPath ?? ""}
          onChange={(e) => set({ hostPath: e.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
        />
      )}
    </div>
  );
}

export function BackupConfigModal({
  projectId,
  existing,
  onClose,
  onSaved,
}: {
  projectId: string;
  existing: BackupConfig | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [schedulePreset, setSchedulePreset] = useState<string>(
    CRON_PRESETS.find((p) => p.value === existing?.schedule)?.value ?? (existing ? "custom" : "0 3 * * *")
  );
  const [customCron, setCustomCron] = useState(existing?.schedule ?? "0 3 * * *");
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [keepDaily, setKeepDaily] = useState(existing?.keepDaily ?? 7);
  const [keepWeekly, setKeepWeekly] = useState(existing?.keepWeekly ?? 4);
  const [keepMonthly, setKeepMonthly] = useState(existing?.keepMonthly ?? 6);
  const [resticPath, setResticPath] = useState(existing?.resticPath ?? "");
  const [targets, setTargets] = useState<BackupTarget[]>(existing?.targets ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const schedule = schedulePreset === "custom" ? customCron : schedulePreset;

  const save = async () => {
    setError(null);
    if (!resticPath.trim()) return setError("indica un nombre para el repositorio (ej. nombre-cliente)");
    if (targets.length === 0) return setError("añade al menos una ruta o base de datos a respaldar");
    setSaving(true);
    try {
      await api.saveBackupConfig(projectId, {
        schedule,
        enabled,
        keepDaily,
        keepWeekly,
        keepMonthly,
        resticPath: resticPath.trim(),
        targets,
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
      title="Configurar backups"
      size="lg"
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
        <label className="mb-1 block text-xs font-medium text-slate-400">Frecuencia</label>
        <select
          value={schedulePreset}
          onChange={(e) => setSchedulePreset(e.target.value)}
          className="mb-2 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          {CRON_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {schedulePreset === "custom" && (
          <input
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            placeholder="expresión cron, ej. 30 2 * * *"
            className="mb-3 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-slate-100"
          />
        )}

        <label className="mb-1 mt-2 block text-xs font-medium text-slate-400">
          Nombre del repositorio en Drive
        </label>
        <input
          value={resticPath}
          onChange={(e) => setResticPath(e.target.value)}
          placeholder="ej. mi-proyecto"
          className="mb-3 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        />

        <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">diarios</label>
            <input
              type="number"
              value={keepDaily}
              onChange={(e) => setKeepDaily(Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">semanales</label>
            <input
              type="number"
              value={keepWeekly}
              onChange={(e) => setKeepWeekly(Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">mensuales</label>
            <input
              type="number"
              value={keepMonthly}
              onChange={(e) => setKeepMonthly(Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
            />
          </div>
        </div>

        <label className="mb-2 flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-indigo-400" />
          activo
        </label>

        <div className="mb-2 mt-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Qué respaldar</span>
          <button
            onClick={() => setTargets((t) => [...t, { ...EMPTY_TARGET }])}
            className="flex items-center gap-1 text-xs text-indigo-300 transition-colors hover:text-indigo-200"
          >
            <Plus className="h-3.5 w-3.5" /> añadir
          </button>
        </div>
        {targets.map((t, i) => (
          <TargetEditor
            key={i}
            target={t}
            onChange={(nt) => setTargets((arr) => arr.map((x, j) => (j === i ? nt : x)))}
            onRemove={() => setTargets((arr) => arr.filter((_, j) => j !== i))}
          />
        ))}
        {targets.length === 0 && <p className="mb-2 text-xs text-slate-600">nada configurado todavía</p>}

        {error && <p className="mb-3 mt-2 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
