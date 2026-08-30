import { useState } from "react";
import { RefreshCw, Square, Play, Terminal, Rocket } from "lucide-react";
import { api, type Service } from "../api";
import { DeployHistory } from "./DeployHistory";
import { StatusDot } from "./ui/status-dot";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useConfirm } from "./ui/confirm-dialog";
import { cn } from "../lib/utils";

const STATUS_BADGE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  running: "success",
  exited: "danger",
  restarting: "warning",
  missing: "neutral",
};

export function ServiceCard({
  service,
  onOpenLogs,
  onChanged,
}: {
  service: Service;
  onOpenLogs: () => void;
  onChanged: () => void;
}) {
  const confirm = useConfirm();
  const [branches, setBranches] = useState<string[]>([]);
  const [selected, setSelected] = useState(service.branch ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const containerName = service.containerName ?? service.name;

  const loadBranches = async () => {
    if (!service.repoPath) return;
    const { branches } = await api.branches(service.id);
    setBranches(branches);
  };

  const deploy = async () => {
    if (!selected) return alert("elige una rama primero");
    setBusy("deploy");
    try {
      await api.deploy(service.id, selected);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(`Error lanzando el deploy: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const runAction = async (action: "start" | "stop" | "restart") => {
    if (action === "stop" || action === "restart") {
      const ok = await confirm({
        title: `¿${action === "stop" ? "Parar" : "Reiniciar"} ${containerName}?`,
        destructive: action === "stop",
      });
      if (!ok) return;
    }
    setBusy(action);
    try {
      await api.containerAction(containerName, action);
      await new Promise((r) => setTimeout(r, 800));
      onChanged();
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card-glow rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <StatusDot status={service.status} />
          <div>
            <div className="font-mono text-sm text-slate-200">{service.name}</div>
            <div className="text-xs text-slate-600">{containerName}</div>
          </div>
        </div>
        <Badge variant={STATUS_BADGE[service.status] ?? "neutral"}>{service.status}</Badge>
      </div>

      <div className="mb-3 flex items-center gap-2">
        {service.repoPath ? (
          <select
            value={selected}
            onFocus={loadBranches}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none"
          >
            <option value={service.branch ?? ""}>{service.branch ?? "(sin rama)"}</option>
            {branches
              .filter((b) => b !== service.branch)
              .map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
          </select>
        ) : (
          <span className="flex-1 text-xs text-slate-600">sin repositorio</span>
        )}
        {service.repoPath && (
          <Button size="sm" onClick={deploy} disabled={busy !== null}>
            <Rocket className={cn("h-3.5 w-3.5", busy === "deploy" && "animate-pulse")} />
            Deploy
          </Button>
        )}
      </div>

      <div className="mb-3 flex gap-1.5">
        {service.status === "running" ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-amber-700/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
              onClick={() => runAction("restart")}
              disabled={busy !== null}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", busy === "restart" && "animate-spin")} /> Restart
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-red-800/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={() => runAction("stop")}
              disabled={busy !== null}
            >
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-emerald-800/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
            onClick={() => runAction("start")}
            disabled={busy !== null}
          >
            <Play className="h-3.5 w-3.5" /> Start
          </Button>
        )}
        <Button size="sm" variant="secondary" className="flex-1" onClick={onOpenLogs}>
          <Terminal className="h-3.5 w-3.5" /> Logs
        </Button>
      </div>

      {service.repoPath && (
        <div className="border-t border-slate-800 pt-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-600">últimos despliegues</div>
          <DeployHistory serviceId={service.id} refreshKey={refreshKey} />
        </div>
      )}
    </div>
  );
}
