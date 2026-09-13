import { useEffect, useState } from "react";
import { api, type BackupRun } from "../api";

const STATUS_STYLES: Record<string, string> = {
  success: "text-emerald-400",
  failed: "text-red-400",
  running: "text-amber-400",
};

export function BackupRunHistory({ configId, refreshKey }: { configId: string; refreshKey: number }) {
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    api.backupRuns(configId).then(setRuns);
  };

  useEffect(load, [configId, refreshKey]);

  useEffect(() => {
    if (!runs.some((r) => r.status === "running")) return;
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [runs, configId]);

  if (runs.length === 0) {
    return <p className="text-xs text-slate-600">sin ejecuciones todavía</p>;
  }

  return (
    <div className="space-y-1">
      {runs.slice(0, 5).map((r) => (
        <div key={r.id}>
          <button
            onClick={() => r.log && setExpanded(expanded === r.id ? null : r.id)}
            className="flex w-full items-center justify-between text-xs disabled:cursor-default"
            disabled={!r.log}
          >
            <span className="text-slate-600">
              {new Date(r.startedAt).toLocaleString("es-ES")} · {r.trigger === "scheduled" ? "programado" : "manual"}
            </span>
            <span className={STATUS_STYLES[r.status] ?? "text-slate-500"}>{r.status}</span>
          </button>
          {expanded === r.id && r.log && (
            <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border border-slate-800 bg-slate-950/60 p-2 font-mono text-[11px] text-slate-500">
              {r.log}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
