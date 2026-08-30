import { cn } from "../../lib/utils";

const STATUS_COLOR: Record<string, string> = {
  running: "bg-emerald-500 text-emerald-500",
  healthy: "bg-emerald-500 text-emerald-500",
  restarting: "bg-amber-500 text-amber-500",
  exited: "bg-red-500 text-red-500",
  missing: "bg-slate-600 text-slate-600",
  paused: "bg-amber-500 text-amber-500",
};

// punto de estado "vivo": late (pulso) cuando algo está corriendo, fijo en cualquier otro caso
export function StatusDot({ status, className }: { status: string; className?: string }) {
  const color = STATUS_COLOR[status] ?? "bg-slate-600 text-slate-600";
  const alive = status === "running" || status === "healthy";
  return (
    <span className={cn("relative inline-flex h-2 w-2 shrink-0 rounded-full", color, className)}>
      {alive && <span className={cn("status-dot-live absolute inset-0 rounded-full", color)} />}
    </span>
  );
}
