import { useEffect, useState } from "react";
import { Cpu, MemoryStick, HardDrive, Timer } from "lucide-react";
import { api, type CurrentMetrics, type MetricSample } from "../api";
import { MetricAreaChart } from "../components/MetricAreaChart";
import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";

const RANGES = [
  { label: "1 h", hours: 1 },
  { label: "6 h", hours: 6 },
  { label: "24 h", hours: 24 },
  { label: "7 días", hours: 24 * 7 },
];

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Cpu; label: string; value: string; sub?: string }) {
  return (
    <Card glow className="p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

export function ServerPage() {
  const [current, setCurrent] = useState<CurrentMetrics | null>(null);
  const [history, setHistory] = useState<MetricSample[]>([]);
  const [hours, setHours] = useState(6);

  useEffect(() => {
    const load = () => api.currentMetrics().then(setCurrent);
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    api.metricsHistory(hours).then(setHistory);
    const interval = setInterval(() => api.metricsHistory(hours).then(setHistory), 30000);
    return () => clearInterval(interval);
  }, [hours]);

  const chartData = history.map((s) => ({
    time: new Date(s.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    cpu: Math.round(s.cpuPercent),
    ramPercent: Math.round((s.memUsedMB / s.memTotalMB) * 100),
    diskPercent: Math.round((s.diskUsedGB / s.diskTotalGB) * 100),
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Servidor</h1>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.hours}
              onClick={() => setHours(r.hours)}
              className={cn(
                "rounded-md px-3 py-1 text-xs transition-colors",
                hours === r.hours ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {current && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon={Cpu} label="CPU" value={`${Math.round(current.cpuPercent)}%`} sub={`${current.cpuCount} núcleos`} />
          <StatCard
            icon={MemoryStick}
            label="RAM"
            value={`${Math.round((current.memUsedMB / current.memTotalMB) * 100)}%`}
            sub={`${(current.memUsedMB / 1024).toFixed(1)} / ${(current.memTotalMB / 1024).toFixed(1)} GB`}
          />
          <StatCard
            icon={HardDrive}
            label="Disco"
            value={`${Math.round((current.diskUsedGB / current.diskTotalGB) * 100)}%`}
            sub={`${current.diskUsedGB.toFixed(0)} / ${current.diskTotalGB.toFixed(0)} GB`}
          />
          <StatCard icon={Timer} label="Uptime" value={formatUptime(current.uptimeSeconds)} sub={`load ${current.loadAvg1.toFixed(2)}`} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">CPU</div>
          <MetricAreaChart data={chartData} dataKey="cpu" xKey="time" color="#818cf8" unit="%" domain={[0, 100]} gradientId="cpuGradient" />
        </Card>
        <Card className="p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">RAM</div>
          <MetricAreaChart data={chartData} dataKey="ramPercent" xKey="time" color="#34d399" unit="%" domain={[0, 100]} gradientId="ramGradient" />
        </Card>
        <Card className="p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Disco</div>
          <MetricAreaChart data={chartData} dataKey="diskPercent" xKey="time" color="#fbbf24" unit="%" domain={[0, 100]} gradientId="diskGradient" />
        </Card>
      </div>
    </div>
  );
}
