import { useEffect, useState } from "react";
import { Play, Pause, Pencil, History, Trash2, Plus, Zap } from "lucide-react";
import { api, type CronJob, type CronJobRun } from "../api";
import { CronJobFormModal } from "../components/CronJobFormModal";
import { describeCron } from "../cron";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { useConfirm } from "../components/ui/confirm-dialog";

const RUN_STATUS_STYLES: Record<string, string> = {
  running: "text-amber-400",
  success: "text-emerald-400",
  failed: "text-red-400",
};

function CronJobCard({ job, onChanged }: { job: CronJob; onChanged: () => void }) {
  const confirm = useConfirm();
  const [running, setRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [runs, setRuns] = useState<CronJobRun[]>([]);
  const [editing, setEditing] = useState(false);

  const loadRuns = () => api.cronJobRuns(job.id).then(setRuns);

  useEffect(() => {
    if (showHistory) loadRuns();
  }, [showHistory]);

  const runNow = async () => {
    setRunning(true);
    try {
      await api.runCronJobNow(job.id);
      setTimeout(() => {
        if (showHistory) loadRuns();
        setRunning(false);
      }, 1500);
    } catch (err) {
      alert((err as Error).message);
      setRunning(false);
    }
  };

  const toggleEnabled = async () => {
    await api.updateCronJob(job.id, { enabled: !job.enabled });
    onChanged();
  };

  const remove = async () => {
    if (!(await confirm({ title: `¿Eliminar la automatización "${job.name}"?`, destructive: true }))) return;
    await api.deleteCronJob(job.id);
    onChanged();
  };

  return (
    <Card glow className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-200">{job.name}</div>
          <div className="font-mono text-xs text-slate-600">
            {job.method} {job.url}
          </div>
        </div>
        <Badge variant={job.enabled ? "success" : "neutral"}>{job.enabled ? "activa" : "pausada"}</Badge>
      </div>

      <p className="mb-3 text-xs text-slate-500">{describeCron(job.schedule)}</p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <Button size="sm" onClick={runNow} disabled={running}>
          <Play className="h-3.5 w-3.5" /> {running ? "ejecutando…" : "Ejecutar ahora"}
        </Button>
        <Button size="sm" variant="secondary" onClick={toggleEnabled}>
          {job.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {job.enabled ? "pausar" : "activar"}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" /> editar
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowHistory((s) => !s)}>
          <History className="h-3.5 w-3.5" /> {showHistory ? "ocultar historial" : "ver historial"}
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={remove}>
          <Trash2 className="h-3.5 w-3.5" /> eliminar
        </Button>
      </div>

      {showHistory && (
        <div className="border-t border-slate-800 pt-3">
          {runs.length === 0 && <p className="text-xs text-slate-600">sin ejecuciones todavía</p>}
          <div className="space-y-1">
            {runs.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs">
                <span className={RUN_STATUS_STYLES[r.status]}>
                  {r.status}
                  {r.httpStatus ? ` (HTTP ${r.httpStatus})` : ""}
                </span>
                <span className="text-slate-600">
                  {r.trigger} · {new Date(r.startedAt).toLocaleString("es-ES")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && <CronJobFormModal existing={job} onClose={() => setEditing(false)} onSaved={onChanged} />}
    </Card>
  );
}

export function AutomationsPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [adding, setAdding] = useState(false);

  const load = () => {
    api.cronJobs().then(setJobs);
  };
  useEffect(load, []);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Automatizaciones</h1>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Nueva automatización
        </Button>
      </div>
      <p className="mb-6 text-sm text-slate-500">Llama a un endpoint de cualquiera de tus proyectos según un calendario — el panel ya está conectado a sus redes internas.</p>

      {jobs.length === 0 && (
        <EmptyState
          icon={Zap}
          title="Sin automatizaciones todavía"
          description="Crea la primera para llamar periódicamente a un endpoint de tus proyectos."
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Nueva automatización
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {jobs.map((job) => (
          <CronJobCard key={job.id} job={job} onChanged={load} />
        ))}
      </div>

      {adding && <CronJobFormModal existing={null} onClose={() => setAdding(false)} onSaved={load} />}
    </div>
  );
}
