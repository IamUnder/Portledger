import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Pencil, Plus, Rocket, Trash2, Database as DatabaseIcon } from "lucide-react";
import { api, type Project, type DatabaseRecord } from "../api";
import { ServiceCard } from "../components/ServiceCard";
import { LogViewer } from "../components/LogViewer";
import { DatabaseFormModal } from "../components/DatabaseFormModal";
import { ServiceFormModal } from "../components/ServiceFormModal";
import { ProjectDeployHistory } from "../components/ProjectDeployHistory";
import { DeleteWithWipeModal } from "../components/DeleteWithWipeModal";
import { Button } from "../components/ui/button";
import { SkeletonCard } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [databases, setDatabases] = useState<DatabaseRecord[]>([]);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [addingDb, setAddingDb] = useState(false);
  const [addingService, setAddingService] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deployingFull, setDeployingFull] = useState(false);
  const [deployRefreshKey, setDeployRefreshKey] = useState(0);
  const [editingHostname, setEditingHostname] = useState(false);
  const [hostnameInput, setHostnameInput] = useState("");
  const [savingHostname, setSavingHostname] = useState(false);

  const load = () => {
    if (!id) return;
    api.project(id).then(setProject);
    api.databases(id).then(setDatabases);
  };

  useEffect(load, [id]);

  const deployFull = async () => {
    if (!project) return;
    setDeployingFull(true);
    try {
      await api.deployProject(project.id);
      setDeployRefreshKey((k) => k + 1);
    } catch (err) {
      alert(`Error lanzando el despliegue completo: ${(err as Error).message}`);
    } finally {
      setDeployingFull(false);
    }
  };

  const startEditingHostname = () => {
    setHostnameInput(project?.hostname ?? "");
    setEditingHostname(true);
  };

  const saveHostname = async () => {
    if (!project) return;
    setSavingHostname(true);
    try {
      setProject(await api.updateProjectHostname(project.id, hostnameInput.trim() || null));
      setEditingHostname(false);
    } catch (err) {
      alert(`Error guardando el dominio: ${(err as Error).message}`);
    } finally {
      setSavingHostname(false);
    }
  };

  const deleteProject = async (wipeServer: boolean) => {
    if (!project) return;
    try {
      await api.deleteProject(project.id, wipeServer);
      navigate("/proyectos");
    } catch (err) {
      alert(`Error eliminando el proyecto: ${(err as Error).message}`);
    } finally {
      setDeletingProject(false);
    }
  };

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
          {editingHostname ? (
            <div className="mt-1 flex items-center gap-1.5">
              <input
                autoFocus
                value={hostnameInput}
                onChange={(e) => setHostnameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveHostname()}
                placeholder="ej. crm.tudominio.com"
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
              <button onClick={saveHostname} disabled={savingHostname} className="text-xs text-indigo-400 hover:text-indigo-300">
                {savingHostname ? "guardando…" : "guardar"}
              </button>
              <button onClick={() => setEditingHostname(false)} disabled={savingHostname} className="text-xs text-slate-500 hover:text-slate-300">
                cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {project.hostname ? (
                <a
                  href={`https://${project.hostname}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-indigo-400 transition-colors hover:text-indigo-300"
                >
                  {project.hostname} <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-sm text-slate-600">sin dominio configurado</span>
              )}
              <button
                title="editar dominio"
                onClick={startEditingHostname}
                className="rounded-md p-1 text-slate-600 transition-colors hover:bg-slate-800 hover:text-slate-300"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-600">{project.composeFile}</span>
          <Button size="sm" variant="secondary" onClick={deployFull} disabled={deployingFull} title="docker compose up -d --build sin restringir a un servicio: reconstruye todo y vuelve a ejecutar migraciones/seed si cambiaron">
            <Rocket className="h-4 w-4" /> {deployingFull ? "Desplegando…" : "Deploy completo"}
          </Button>
          <button
            title="eliminar proyecto"
            onClick={() => setDeletingProject(true)}
            className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-800 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-600">despliegues completos</div>
        <ProjectDeployHistory projectId={project.id} refreshKey={deployRefreshKey} />
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
      {deletingProject && project && (
        <DeleteWithWipeModal
          title={`¿Eliminar "${project.name}"?`}
          description="Deja de rastrearse en el panel. Las facturas, albaranes, tareas y horas ya registradas contra este proyecto se conservan, solo quedan desvinculadas."
          wipeLabel="Borrar también del servidor: contenedores, volúmenes (datos de las bases de datos incluidos) y la carpeta del proyecto"
          wipeWarning={`Esto ejecuta "docker compose down -v" y borra ${project.composeFile ? project.composeFile.replace(/\/[^/]+$/, "") : "la carpeta del proyecto"} — irreversible.`}
          onClose={() => setDeletingProject(false)}
          onConfirm={deleteProject}
        />
      )}
    </div>
  );
}
