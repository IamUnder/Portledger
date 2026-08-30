import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Euro,
  AlertTriangle,
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  KanbanSquare,
  Archive,
  CheckCircle2,
  Bell,
  CalendarClock,
  Receipt,
  Repeat,
} from "lucide-react";
import { api, type CurrentMetrics, type Project, type Invoice, type Task, type BackupConfig, type AppNotification, type RecurringInvoice } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { OnboardingChecklist } from "../components/OnboardingChecklist";
import { cn } from "../lib/utils";

const SEVERITY_DOT: Record<string, string> = {
  INFO: "bg-indigo-400",
  WARNING: "bg-amber-500",
  CRITICAL: "bg-red-500",
};

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// misma lógica que el scheduler del backend (recurring/scheduler.ts): si ya se generó este
// mes, la próxima es el mes que viene; si no, es este mes en cuanto llegue el día.
function nextRecurringRun(r: RecurringInvoice, now: Date): Date {
  const day = r.dayOfMonth;
  const ranThisMonth = r.lastRunAt ? sameMonth(new Date(r.lastRunAt), now) : false;
  let candidate = new Date(now.getFullYear(), now.getMonth(), day);
  if (candidate < now || ranThisMonth) candidate = new Date(now.getFullYear(), now.getMonth() + 1, day);
  return candidate;
}

function MetricGauge({ icon: Icon, label, percent, to }: { icon: typeof Cpu; label: string; percent: number; to: string }) {
  const tone = percent >= 90 ? "text-red-400" : percent >= 75 ? "text-amber-400" : "text-indigo-300";
  return (
    <Link to={to} className="card-glow group rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all duration-200">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <span className={cn("text-lg font-semibold", tone)}>{Math.round(percent)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={cn("h-full rounded-full transition-all duration-500", percent >= 90 ? "bg-red-500" : percent >= 75 ? "bg-amber-500" : "bg-indigo-500")}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </Link>
  );
}

function KpiCard({ icon: Icon, label, value, sub, tone = "default" }: { icon: typeof Euro; label: string; value: string; sub?: string; tone?: "default" | "danger" | "success" }) {
  return (
    <Card glow className="p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={cn("text-2xl font-semibold", tone === "danger" ? "text-red-400" : tone === "success" ? "text-emerald-400" : "text-slate-100")}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

function WidgetCard({ title, to, toLabel, children }: { title: string; to: string; toLabel: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Link to={to} className="text-xs text-indigo-400 transition-colors hover:text-indigo-300">
          {toLabel}
        </Link>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<CurrentMetrics | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [backupConfigs, setBackupConfigs] = useState<(BackupConfig & { projectName: string })[]>([]);
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([]);

  useEffect(() => {
    api.currentMetrics().then(setMetrics);
    api.invoices().then(setInvoices);
    api.tasks().then(setTasks);
    api.notifications(true).then(setAlerts);
    api.recurringInvoices().then(setRecurringInvoices);
    api.projects().then((ps) => {
      setProjects(ps);
      Promise.all(
        ps.map((p) =>
          api
            .backupConfig(p.id)
            .then((c) => (c ? { ...c, projectName: p.name } : null))
            .catch(() => null)
        )
      ).then((configs) => setBackupConfigs(configs.filter((c): c is BackupConfig & { projectName: string } => !!c)));
    });
  }, []);

  const loading = projects === null;
  const safeProjects = projects ?? [];
  const projectsWithIssues = safeProjects.filter((p) => p.services.some((s) => s.status !== "running"));
  const now = new Date();
  const pendingInvoices = invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE");
  const overdueInvoices = invoices.filter((i) => i.dueDate && new Date(i.dueDate) < now && i.status !== "PAID" && i.status !== "CANCELLED");
  const pendingTotal = pendingInvoices.reduce((s, i) => s + i.total, 0);
  const paidThisMonth = invoices
    .filter((i) => i.paidAt && new Date(i.paidAt).getMonth() === now.getMonth() && new Date(i.paidAt).getFullYear() === now.getFullYear())
    .reduce((s, i) => s + i.total, 0);
  const activeTasks = tasks.filter((t) => t.status !== "DONE");
  const highPriorityTasks = activeTasks.filter((t) => t.priority === "HIGH");
  const failedBackups = backupConfigs.filter((c) => c.runs?.[0]?.status === "failed");

  const upcoming = [
    ...invoices
      .filter((i) => i.status === "SENT" && i.dueDate && new Date(i.dueDate) >= now)
      .map((i) => ({
        date: new Date(i.dueDate!),
        label: `Factura ${i.invoiceNumber ?? ""}`,
        sublabel: i.client?.name,
        link: `/facturas/${i.id}`,
        icon: Receipt,
      })),
    ...activeTasks
      .filter((t) => t.dueDate && new Date(t.dueDate) >= now)
      .map((t) => ({ date: new Date(t.dueDate!), label: t.title, sublabel: "tarea", link: "/tareas", icon: KanbanSquare })),
    ...recurringInvoices
      .filter((r) => r.active)
      .map((r) => ({
        date: nextRecurringRun(r, now),
        label: `Recurrente: ${r.concept}`,
        sublabel: r.client?.name,
        link: "/facturas/recurrentes",
        icon: Repeat,
      })),
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6);

  if (loading) {
    return (
      <div>
        <Skeleton className="mb-6 h-7 w-40" />
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Dashboard</h1>

      <OnboardingChecklist />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Euro} label="Cobrado este mes" value={`${paidThisMonth.toFixed(2)} €`} tone="success" />
        <KpiCard
          icon={AlertTriangle}
          label="Pendiente de cobro"
          value={`${pendingTotal.toFixed(2)} €`}
          sub={overdueInvoices.length > 0 ? `${overdueInvoices.length} vencida(s)` : undefined}
          tone={overdueInvoices.length > 0 ? "danger" : "default"}
        />
        <KpiCard icon={Server} label="Proyectos sanos" value={`${safeProjects.length - projectsWithIssues.length}/${safeProjects.length}`} tone={projectsWithIssues.length > 0 ? "danger" : "success"} />
        <KpiCard icon={KanbanSquare} label="Tareas activas" value={String(activeTasks.length)} sub={highPriorityTasks.length > 0 ? `${highPriorityTasks.length} de alta prioridad` : undefined} tone={highPriorityTasks.length > 0 ? "danger" : "default"} />
      </div>

      {metrics && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricGauge icon={Cpu} label="CPU" percent={metrics.cpuPercent} to="/servidor" />
          <MetricGauge icon={MemoryStick} label="RAM" percent={(metrics.memUsedMB / metrics.memTotalMB) * 100} to="/servidor" />
          <MetricGauge icon={HardDrive} label="Disco" percent={(metrics.diskUsedGB / metrics.diskTotalGB) * 100} to="/servidor" />
        </div>
      )}

      {alerts.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-400" /> Alertas sin leer
            </CardTitle>
            <Badge variant="warning">{alerts.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.slice(0, 6).map((a) => (
              <Link key={a.id} to={a.link ?? "#"} className="flex items-start gap-2 text-sm text-slate-300 transition-colors hover:text-slate-100">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[a.severity]}`} />
                <span>{a.title}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-indigo-400" /> Próximos vencimientos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">nada a la vista en los próximos días</p>
          ) : (
            upcoming.map((u, i) => (
              <Link key={i} to={u.link} className="flex items-center justify-between gap-2 text-sm text-slate-300 transition-colors hover:text-slate-100">
                <span className="flex min-w-0 items-center gap-2">
                  <u.icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">{u.label}</span>
                  {u.sublabel && <span className="shrink-0 text-xs text-slate-600">· {u.sublabel}</span>}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{u.date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title="Proyectos" to="/proyectos" toLabel="ver todos">
          {projectsWithIssues.length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> todos los servicios corriendo
            </p>
          ) : (
            <div className="space-y-1.5">
              {projectsWithIssues.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="block text-sm text-amber-400 transition-colors hover:text-amber-300">
                  {p.name}: {p.services.filter((s) => s.status !== "running").map((s) => s.name).join(", ")} parado
                </Link>
              ))}
            </div>
          )}
        </WidgetCard>

        <WidgetCard title="Tareas críticas" to="/tareas" toLabel="ver tablero">
          {highPriorityTasks.length > 0 ? (
            <div className="space-y-1.5">
              {highPriorityTasks.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm text-red-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  {t.title}
                </div>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> sin tareas de alta prioridad
            </p>
          )}
        </WidgetCard>

        <WidgetCard title="Facturas pendientes" to="/facturas" toLabel="ver todas">
          <p className="text-xs text-slate-500">
            {pendingInvoices.length} factura(s) pendiente(s)
            {overdueInvoices.length > 0 && <span className="text-red-400"> · {overdueInvoices.length} vencida(s)</span>}
          </p>
        </WidgetCard>

        <WidgetCard title="Backups" to="/backups" toLabel="ver todos">
          {failedBackups.length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> último backup de cada proyecto en orden
            </p>
          ) : (
            <div className="space-y-1.5">
              {failedBackups.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm text-red-400">
                  <Archive className="h-3.5 w-3.5" /> {c.projectName}: el último backup falló
                </div>
              ))}
            </div>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}
