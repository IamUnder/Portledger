import { useEffect, useState } from "react";
import { api, type DeployEvent } from "../api";

const STATUS_STYLES: Record<string, string> = {
  success: "text-emerald-400",
  failed: "text-red-400",
  running: "text-amber-400",
};

export function DeployHistory({ serviceId, refreshKey }: { serviceId: string; refreshKey: number }) {
  const [deploys, setDeploys] = useState<DeployEvent[]>([]);

  useEffect(() => {
    api.deploys(serviceId).then(setDeploys);
  }, [serviceId, refreshKey]);

  if (deploys.length === 0) {
    return <p className="text-xs text-slate-600">sin despliegues todavía</p>;
  }

  return (
    <div className="space-y-1">
      {deploys.slice(0, 5).map((d) => (
        <div key={d.id} className="flex items-center justify-between text-xs">
          <span className="font-mono text-slate-400">
            {d.branch} {d.commitSha && <span className="text-slate-600">@{d.commitSha}</span>}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-slate-600">{new Date(d.startedAt).toLocaleString()}</span>
            <span className={STATUS_STYLES[d.status] ?? "text-slate-500"}>{d.status}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
