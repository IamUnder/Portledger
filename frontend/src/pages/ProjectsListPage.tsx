import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Server, Globe } from "lucide-react";
import { api, type Project } from "../api";
import { StatusDot } from "../components/ui/status-dot";
import { Button } from "../components/ui/button";
import { SkeletonCard } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

function summarize(project: Project) {
  const total = project.services.length;
  const running = project.services.filter((s) => s.status === "running").length;
  return { total, running, healthy: running === total && total > 0 };
}

export function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    api.projects().then(setProjects);
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Proyectos</h1>
        <Button asChild size="sm">
          <Link to="/projects/new">
            <Plus className="h-4 w-4" /> Nuevo proyecto
          </Link>
        </Button>
      </div>

      {!projects && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {projects && projects.length === 0 && (
        <EmptyState
          icon={Server}
          title="Sin proyectos todavía"
          description="Crea el primero para empezar a desplegar y monitorizar servicios."
          action={
            <Button asChild size="sm">
              <Link to="/projects/new">
                <Plus className="h-4 w-4" /> Nuevo proyecto
              </Link>
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => {
          const { total, running, healthy } = summarize(project);
          return (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="card-glow rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition-all duration-200"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="text-base font-medium text-slate-100">{project.name}</div>
                  {project.hostname && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-600">
                      <Globe className="h-3 w-3" /> {project.hostname}
                    </div>
                  )}
                </div>
                <StatusDot status={healthy ? "running" : total === running ? "missing" : "exited"} className="mt-1 h-2.5 w-2.5" />
              </div>
              <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                <span className={running === total ? "text-emerald-400" : "text-amber-400"}>
                  {running}/{total} servicios activos
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${running === total ? "bg-emerald-500" : "bg-amber-500"}`}
                  style={{ width: total ? `${(running / total) * 100}%` : "0%" }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {project.services.map((s) => (
                  <span key={s.id} className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                    {s.name}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
