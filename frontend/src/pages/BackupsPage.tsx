import { useEffect, useState } from "react";
import { Play, Pencil, RotateCcw, Archive } from "lucide-react";
import { api, type Project, type BackupConfig, type Snapshot } from "../api";
import { BackupConfigModal } from "../components/BackupConfigModal";
import { RestoreModal } from "../components/RestoreModal";
import { describeCron } from "../cron";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { SkeletonCard } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

function ProjectBackupCard({ project }: { project: Project }) {
  const [config, setConfig] = useState<BackupConfig | null | undefined>(undefined);
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  const [restoring, setRestoring] = useState<Snapshot | null>(null);

  const load = () => {
    api.backupConfig(project.id).then((c) => {
      setConfig(c);
      if (c) api.backupSnapshots(c.id).then((r) => setSnapshots(r.snapshots.reverse()));
    });
  };

  useEffect(load, [project.id]);

  const runNow = async () => {
    if (!config) return;
    setRunning(true);
    try {
      await api.runBackupNow(config.id);
      alert("Backup lanzado, tardará un rato en aparecer como snapshot nuevo");
    } finally {
      setRunning(false);
    }
  };

  if (config === undefined) return <SkeletonCard />;

  return (
    <Card glow className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200">{project.name}</h3>
        {config ? <Badge variant={config.enabled ? "success" : "neutral"}>{config.enabled ? "activo" : "pausado"}</Badge> : <Badge>sin configurar</Badge>}
      </div>

      {config ? (
        <>
          <p className="mb-1 text-xs text-slate-400">
            {describeCron(config.schedule)} · retención {config.keepDaily}d/{config.keepWeekly}s/{config.keepMonthly}m
          </p>
          <p className="mb-3 text-xs text-slate-600">
            {config.targets.length} elemento(s) · repo <span className="font-mono">homelab-backups/{config.resticPath}</span>
          </p>

          <div className="mb-3 flex gap-2">
            <Button size="sm" onClick={runNow} disabled={running}>
              <Play className="h-3.5 w-3.5" /> {running ? "…" : "Ejecutar ahora"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-600">snapshots</div>
            {snapshots === null && <p className="text-xs text-slate-600">cargando…</p>}
            {snapshots?.length === 0 && <p className="text-xs text-slate-600">aún no hay snapshots</p>}
            <div className="space-y-1">
              {snapshots?.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400">{s.short_id}</span>
                  <span className="text-slate-600">{new Date(s.time).toLocaleString("es-ES")}</span>
                  <button onClick={() => setRestoring(s)} className="flex items-center gap-1 text-indigo-300 transition-colors hover:text-indigo-200">
                    <RotateCcw className="h-3 w-3" /> restaurar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <Button className="w-full" onClick={() => setEditing(true)}>
          Configurar backups
        </Button>
      )}

      {editing && <BackupConfigModal projectId={project.id} existing={config ?? null} onClose={() => setEditing(false)} onSaved={load} />}
      {restoring && config && <RestoreModal configId={config.id} snapshot={restoring} targets={config.targets} onClose={() => setRestoring(null)} />}
    </Card>
  );
}

export function BackupsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    api.projects().then(setProjects);
  }, []);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-100">Backups</h1>
      <p className="mb-6 text-sm text-slate-500">Cada proyecto tiene su propio calendario, retención y repositorio en Google Drive — no comparten cadencia.</p>

      {!projects && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {projects?.length === 0 && <EmptyState icon={Archive} title="Sin proyectos" description="Crea un proyecto primero para poder configurar sus backups." />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects?.map((p) => (
          <ProjectBackupCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
}
