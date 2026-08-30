import { useEffect, useRef, useState } from "react";
import { api, type BackupTarget, type RestoreMode, type Snapshot } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";

function targetLabel(t: BackupTarget) {
  if (t.type === "MYSQL" || t.type === "POSTGRES") return `${t.type} · ${t.database} (${t.containerName})`;
  if (t.type === "CONTAINER_PATH") return `${t.containerName}:${t.containerPath}`;
  return t.hostPath ?? "";
}

export function RestoreModal({
  configId,
  snapshot,
  targets,
  onClose,
}: {
  configId: string;
  snapshot: Snapshot;
  targets: BackupTarget[];
  onClose: () => void;
}) {
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const target = targets.find((t) => t.id === targetId);
  const isDb = target?.type === "MYSQL" || target?.type === "POSTGRES";

  const [mode, setMode] = useState<RestoreMode>("new_database");
  const [confirmText, setConfirmText] = useState("");
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [log, setLog] = useState("");
  const [resultPath, setResultPath] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    setMode("new_database");
    setConfirmText("");
  }, [targetId]);

  useEffect(() => {
    if (!restoreId) return;
    const poll = async () => {
      const events = await api.restores(configId);
      const ev = events.find((e) => e.id === restoreId);
      if (!ev) return;
      setStatus(ev.status);
      setLog(ev.log);
      setResultPath(ev.resultPath);
      if (ev.status !== "running" && pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
    poll();
    pollRef.current = window.setInterval(poll, 2000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [restoreId, configId]);

  const canStart = target && (mode !== "overwrite" || confirmText === target.database);

  const start = async () => {
    if (!target?.id) return;
    const { restoreId: newId } = await api.restore(configId, target.id, snapshot.id, mode);
    setRestoreId(newId);
    setStatus("running");
  };

  return (
    <Modal
      onClose={onClose}
      title="Restaurar backup"
      description={
        <>
          snapshot <span className="font-mono">{snapshot.short_id}</span> · {new Date(snapshot.time).toLocaleString("es-ES")}
        </>
      }
      footer={
        !restoreId ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={start} disabled={!canStart}>
              Restaurar
            </Button>
          </>
        ) : (
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Cerrar
          </Button>
        )
      }
    >
      {!restoreId && (
        <>
          <label className="mb-1 block text-xs font-medium text-slate-400">Qué restaurar</label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="mb-3 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
          >
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {targetLabel(t)}
              </option>
            ))}
          </select>

          {isDb ? (
            <>
              <label className="mb-1 block text-xs font-medium text-slate-400">Modo</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as RestoreMode)}
                className="mb-3 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
              >
                <option value="new_database">Restaurar a una base de datos nueva (seguro)</option>
                <option value="overwrite">Sobrescribir la base de datos actual (destructivo)</option>
              </select>
              {mode === "overwrite" && (
                <div className="mb-3 rounded-lg border border-red-900 bg-red-950/40 p-3">
                  <p className="mb-2 text-xs text-red-300">
                    Esto borra los datos actuales de <strong>{target?.database}</strong> y los sustituye por los del snapshot. Escribe el nombre de la base de datos para confirmar:
                  </p>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={target?.database ?? ""}
                    className="w-full rounded-md border border-red-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 transition-colors focus:outline-none"
                  />
                </div>
              )}
            </>
          ) : (
            <p className="mb-3 text-xs text-slate-500">Se restaurará en una ruta nueva junto a la original (no sobrescribe nada automáticamente).</p>
          )}
        </>
      )}

      {restoreId && (
        <>
          <div className="mb-2 flex items-center gap-2 text-sm">
            <span className={status === "success" ? "text-emerald-400" : status === "failed" ? "text-red-400" : "text-amber-400"}>
              {status === "running" ? "restaurando…" : status}
            </span>
          </div>
          <pre className="mb-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-black p-3 font-mono text-xs text-emerald-400">{log || "…"}</pre>
          {status === "success" && resultPath && (
            <p className="mb-3 text-xs text-slate-400">
              Restaurado en: <span className="font-mono text-slate-200">{resultPath}</span>
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
