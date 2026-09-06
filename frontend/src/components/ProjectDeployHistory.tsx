import { useEffect, useState } from "react";
import { api, type ProjectDeployEvent } from "../api";

const STATUS_STYLES: Record<string, string> = {
  success: "text-emerald-400",
  failed: "text-red-400",
  running: "text-amber-400",
};

export function ProjectDeployHistory({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const [deploys, setDeploys] = useState<ProjectDeployEvent[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    api.projectDeploys(projectId).then(setDeploys);
  };

  useEffect(load, [projectId, refreshKey]);

  useEffect(() => {
    if (!deploys.some((d) => d.status === "running")) return;
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [deploys, projectId]);

  if (deploys.length === 0) {
    return <p className="text-xs text-slate-600">sin despliegues completos todavía</p>;
  }

  return (
    <div className="space-y-1">
      {deploys.slice(0, 5).map((d) => (
        <div key={d.id}>
          <button
            onClick={() => d.log && setExpanded(expanded === d.id ? null : d.id)}
            className="flex w-full items-center justify-between text-xs disabled:cursor-default"
            disabled={!d.log}
          >
            <span className="text-slate-600">{new Date(d.startedAt).toLocaleString()}</span>
            <span className={STATUS_STYLES[d.status] ?? "text-slate-500"}>{d.status}</span>
          </button>
          {expanded === d.id && d.log && (
            <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border border-slate-800 bg-slate-950/60 p-2 font-mono text-[11px] text-slate-500">
              {d.log}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
