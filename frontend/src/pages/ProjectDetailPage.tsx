import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Plus, Database as DatabaseIcon } from "lucide-react";
import { api, type Project, type DatabaseRecord } from "../api";
import { ServiceCard } from "../components/ServiceCard";
import { LogViewer } from "../components/LogViewer";
import { DatabaseFormModal } from "../components/DatabaseFormModal";
import { ServiceFormModal } from "../components/ServiceFormModal";
import { Button } from "../components/ui/button";
import { SkeletonCard } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [databases, setDatabases] = useState<DatabaseRecord[]>([]);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [addingDb, setAddingDb] = useState(false);
  const [addingService, setAddingService] = useState(false);

  const load = () => {
    if (!id) return;
    api.project(id).then(setProject);
    api.databases(id).then(setDatabases);
  };

  useEffect(load, [id]);

  if (!project) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <Link to="/proyectos" className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-300">
        <ArrowLeft className="h-3.5 w-3.5" /> proyectos
      </Link>
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">{project.name}</h1>
          {project.hostname && (
            <a
              href={`https://${project.hostname}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-indigo-400 transition-colors hover:text-indigo-300"
            >
              {project.hostname} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <span className="font-mono text-xs text-slate-600">{project.composeFile}</span>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-300">Servicios</h2>
        <Button size="sm" variant="secondary" onClick={() => setAddingService(true)}>
          <Plus className="h-4 w-4" /> Añadir servicio
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {project.services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onOpenLogs={() => setLogsFor(service.containerName ?? service.name)}
            onChanged={load}
          />
        ))}
      </div>

      <div className="mb-4 mt-8 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-300">Bases de datos</h2>
        <Button size="sm" onClick={() => setAddingDb(true)}>
          <Plus className="h-4 w-4" /> Añadir base de datos
        </Button>
      </div>
      {databases.length === 0 ? (
        <div className="mb-8">
          <EmptyState icon={DatabaseIcon} title="Sin bases de datos registradas" description="Añade una para poder monitorizar sus consultas y su rendimiento." />
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {databases.map((d) => (
            <Link
              key={d.id}
              to={`/databases/${d.id}`}
              className="card-glow rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all duration-200"
            >
              <div className="mb-1 text-sm font-medium text-slate-200">{d.label}</div>
              <div className="font-mono text-xs text-slate-600">
                {d.engine} · {d.containerName} · {d.databaseName}
              </div>
              <div className="mt-2 text-xs text-indigo-400">ver consultas →</div>
            </Link>
          ))}
        </div>
      )}

      {logsFor && <LogViewer containerName={logsFor} onClose={() => setLogsFor(null)} />}
      {addingDb && project && (
        <DatabaseFormModal projectId={project.id} onClose={() => setAddingDb(false)} onSaved={load} />
      )}
      {addingService && project && (
        <ServiceFormModal projectId={project.id} onClose={() => setAddingService(false)} onSaved={load} />
      )}
    </div>
  );
}
