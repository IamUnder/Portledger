import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Rocket, FolderInput, Github } from "lucide-react";
import { api, type CloudflareAccount, type ScaffoldSpec, type ServiceSpec, type Tunnel } from "../api";
import { ServiceSpecEditor } from "../components/ServiceSpecEditor";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";

const EMPTY_SERVICE: ServiceSpec = { key: "", kind: "git" };
const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

function ImportExistingForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [composeFile, setComposeFile] = useState("");
  const [envFile, setEnvFile] = useState("");
  const [hostname, setHostname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const importProject = async () => {
    setError(null);
    if (!/^[a-z0-9-]+$/.test(name)) return setError("el nombre debe ser minúsculas, números y guiones");
    if (!composeFile.trim()) return setError("falta la ruta al docker-compose.yml");
    setSaving(true);
    try {
      const project = await api.createProject({ name, composeFile: composeFile.trim(), envFile: envFile.trim() || undefined, hostname: hostname || undefined });
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Card className="mb-6 p-4">
        <label className="mb-1 block text-xs font-medium text-slate-400">Nombre del proyecto</label>
        <input value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder="ej. crm-interno" className={`${inputClass} mb-3`} />

        <label className="mb-1 block text-xs font-medium text-slate-400">Ruta al docker-compose.yml (ya escrito, en este servidor)</label>
        <input value={composeFile} onChange={(e) => setComposeFile(e.target.value)} placeholder="/home/under/crm/docker-compose.yml" className={`${inputClass} mb-3 font-mono text-xs`} />

        <label className="mb-1 block text-xs font-medium text-slate-400">Ruta al .env (opcional)</label>
        <input value={envFile} onChange={(e) => setEnvFile(e.target.value)} placeholder="/home/under/crm/.env" className={`${inputClass} mb-3 font-mono text-xs`} />

        <label className="mb-1 block text-xs font-medium text-slate-400">Dominio público (opcional)</label>
        <input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="ej. crm.tudominio.com" className={inputClass} />
      </Card>

      <p className="mb-6 text-xs text-slate-600">
        Esto no toca el proyecto en el servidor ni crea nada — solo le dice al panel dónde está para poder gestionarlo. Una vez creado, añade
        cada servicio a rastrear (para logs, estado y despliegue) desde su página con "Añadir servicio".
      </p>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <Button className="w-full" size="lg" onClick={importProject} disabled={saving}>
        <FolderInput className="h-4 w-4" /> {saving ? "Importando…" : "Importar proyecto"}
      </Button>
    </div>
  );
}

export function NewProjectPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"scaffold" | "clone" | "existing">("scaffold");
  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [services, setServices] = useState<ServiceSpec[]>([{ ...EMPTY_SERVICE }]);

  // solo para el modo "clone": el repo ya trae su propio docker-compose.yml, así que en vez de
  // la lista de servicios se piden estos datos para clonarlo y saber a qué servicio (ya definido
  // en ESE compose) apuntar la regla de ingress.
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [composePath, setComposePath] = useState("docker-compose.yml");
  const [publicServiceKey, setPublicServiceKey] = useState("");
  const [publicServicePort, setPublicServicePort] = useState(80);

  const [accounts, setAccounts] = useState<CloudflareAccount[]>([]);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [tunnelMode, setTunnelMode] = useState<"none" | "new" | "existing">("none");
  const [cloudflareAccountId, setCloudflareAccountId] = useState("");
  const [existingTunnelId, setExistingTunnelId] = useState("");
  const [enableBackups, setEnableBackups] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobLog, setJobLog] = useState("");
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    api.cfAccounts().then((accs) => setAccounts(accs.filter((a) => a.hasApiToken)));
    api.tunnels().then(setTunnels);
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const poll = async () => {
      const job = await api.scaffoldJob(jobId);
      setJobStatus(job.status);
      setJobLog(job.log);
      if (job.status !== "running") {
        if (pollRef.current) window.clearInterval(pollRef.current);
        if (job.status === "success" && job.projectId) {
          setTimeout(() => navigate(`/projects/${job.projectId}`), 1500);
        }
      }
    };
    poll();
    pollRef.current = window.setInterval(poll, 1500);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [jobId, navigate]);

  const hasDatabase = services.some((s) => s.kind === "database");

  const runJob = async (spec: ScaffoldSpec) => {
    try {
      const { jobId } = await api.scaffold(spec);
      setJobId(jobId);
      setJobStatus("running");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const create = () => {
    setError(null);
    if (!/^[a-z0-9-]+$/.test(name)) return setError("el nombre debe ser minúsculas, números y guiones");
    if (services.some((s) => !s.key)) return setError("todos los servicios necesitan un nombre");
    runJob({
      name,
      hostname: hostname || undefined,
      services,
      cloudflareAccountId: tunnelMode === "new" ? cloudflareAccountId || undefined : undefined,
      existingTunnelId: tunnelMode === "existing" ? existingTunnelId || undefined : undefined,
      enableBackups: enableBackups && hasDatabase,
    });
  };

  const cloneFromGitHub = () => {
    setError(null);
    if (!/^[a-z0-9-]+$/.test(name)) return setError("el nombre debe ser minúsculas, números y guiones");
    if (!repoUrl.trim()) return setError("falta la URL del repositorio");
    runJob({
      name,
      hostname: hostname || undefined,
      services: [],
      composeSource: {
        repoUrl: repoUrl.trim(),
        branch: branch.trim() || undefined,
        composePath: composePath.trim() || undefined,
        publicServiceKey: publicServiceKey.trim() || undefined,
        publicServicePort: publicServiceKey.trim() ? publicServicePort : undefined,
      },
      cloudflareAccountId: tunnelMode === "new" ? cloudflareAccountId || undefined : undefined,
      existingTunnelId: tunnelMode === "existing" ? existingTunnelId || undefined : undefined,
    });
  };

  if (jobId) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-xl font-semibold text-slate-100">Creando "{name}"…</h1>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className={jobStatus === "success" ? "text-emerald-400" : jobStatus === "failed" ? "text-red-400" : "text-amber-400"}>
            {jobStatus === "running" ? "en progreso…" : jobStatus === "success" ? "completado" : "falló"}
          </span>
          {jobStatus === "success" && <span className="text-slate-500">redirigiendo al proyecto…</span>}
        </div>
        <pre className="h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-black p-4 font-mono text-xs text-emerald-400">{jobLog || "iniciando…"}</pre>
        {jobStatus === "failed" && mode === "clone" && (
          <p className="mt-3 text-xs text-slate-500">
            Si falló en el "docker compose up" porque falta el .env con secretos reales: el repo ya quedó clonado en el servidor tal cual —
            entra por SSH, crea el .env, levántalo a mano (<code className="text-slate-400">docker compose up -d --build</code>), y luego usa
            "Importar proyecto ya existente" para registrarlo con lo que ya está corriendo.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-slate-100">Nuevo proyecto</h1>

      <div className="mb-6 flex gap-1 rounded-md bg-slate-800 p-1 text-xs">
        <button
          onClick={() => setMode("scaffold")}
          className={`flex-1 rounded px-2 py-1.5 transition-colors ${mode === "scaffold" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
        >
          Crear con el asistente
        </button>
        <button
          onClick={() => setMode("clone")}
          className={`flex-1 rounded px-2 py-1.5 transition-colors ${mode === "clone" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
        >
          Clonar desde GitHub
        </button>
        <button
          onClick={() => setMode("existing")}
          className={`flex-1 rounded px-2 py-1.5 transition-colors ${mode === "existing" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
        >
          Ya está en el servidor
        </button>
      </div>

      {mode === "existing" && <ImportExistingForm />}

      {mode !== "existing" && (
        <>
          <Card className="mb-6 p-4">
            <label className="mb-1 block text-xs font-medium text-slate-400">Nombre del proyecto</label>
            <input value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder="ej. cliente-xyz" className={`${inputClass} mb-3`} />
            <label className="mb-1 block text-xs font-medium text-slate-400">Dominio público (opcional)</label>
            <input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="ej. clientexyz.com" className={inputClass} />
          </Card>

          {mode === "scaffold" && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-300">Servicios</h2>
                <button onClick={() => setServices((s) => [...s, { ...EMPTY_SERVICE }])} className="flex items-center gap-1 text-xs text-indigo-300 transition-colors hover:text-indigo-200">
                  <Plus className="h-3.5 w-3.5" /> añadir servicio
                </button>
              </div>
              {services.map((svc, i) => (
                <ServiceSpecEditor
                  key={i}
                  service={svc}
                  onChange={(s) => setServices((arr) => arr.map((x, j) => (j === i ? s : x)))}
                  onRemove={() => setServices((arr) => arr.filter((_, j) => j !== i))}
                />
              ))}
            </>
          )}

          {mode === "clone" && (
            <Card className="mb-6 p-4">
              <label className="mb-1 block text-xs font-medium text-slate-400">URL del repositorio</label>
              <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/usuario/repo.git" className={`${inputClass} mb-3 font-mono text-xs`} />

              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Rama (opcional)</label>
                  <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Ruta al compose dentro del repo</label>
                  <input value={composePath} onChange={(e) => setComposePath(e.target.value)} className={`${inputClass} font-mono text-xs`} />
                </div>
              </div>

              <p className="mb-2 text-xs text-slate-600">
                Se clona el repo tal cual y se usa el docker-compose.yml que ya trae — el panel no lo genera ni lo toca.
              </p>

              {hostname && (
                <div className="grid grid-cols-1 gap-2 border-t border-slate-800 pt-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-400">Servicio del compose al que apunta el dominio</label>
                    <input value={publicServiceKey} onChange={(e) => setPublicServiceKey(e.target.value)} placeholder="ej. web" className={`${inputClass} font-mono text-xs`} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-400">Puerto interno de ese servicio</label>
                    <input type="number" value={publicServicePort} onChange={(e) => setPublicServicePort(Number(e.target.value))} className={inputClass} />
                  </div>
                </div>
              )}
            </Card>
          )}

          <Card className="mb-6 mt-6 p-4">
            <label className="mb-1 block text-xs font-medium text-slate-400">Túnel de Cloudflare (opcional)</label>
            <select
              value={tunnelMode}
              onChange={(e) => setTunnelMode(e.target.value as typeof tunnelMode)}
              className={`${inputClass} mb-2`}
            >
              <option value="none">No crear túnel ahora</option>
              <option value="new">Crear túnel nuevo</option>
              <option value="existing">Reutilizar un túnel ya existente</option>
            </select>

            {tunnelMode === "new" && (
              <>
                <select value={cloudflareAccountId} onChange={(e) => setCloudflareAccountId(e.target.value)} className={`${inputClass} mb-1`}>
                  <option value="">elige una cuenta…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-600">Se creará un túnel nuevo en la cuenta elegida y se publicará la regla hacia el servicio marcado como público.</p>
              </>
            )}

            {tunnelMode === "existing" && (
              <>
                <select value={existingTunnelId} onChange={(e) => setExistingTunnelId(e.target.value)} className={`${inputClass} mb-1`}>
                  <option value="">elige un túnel…</option>
                  {tunnels.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.containerName})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-600">
                  Se conecta el contenedor de ese túnel a la red de este proyecto nuevo y se añade la regla ahí, sin tocar las que ya tuviera publicadas.
                </p>
              </>
            )}

            {mode === "scaffold" && hasDatabase && (
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={enableBackups} onChange={(e) => setEnableBackups(e.target.checked)} className="accent-indigo-500" />
                activar backups diarios de la base de datos
              </label>
            )}
          </Card>

          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

          {mode === "scaffold" ? (
            <Button className="w-full" size="lg" onClick={create}>
              <Rocket className="h-4 w-4" /> Crear proyecto
            </Button>
          ) : (
            <Button className="w-full" size="lg" onClick={cloneFromGitHub}>
              <Github className="h-4 w-4" /> Clonar y levantar
            </Button>
          )}
        </>
      )}
    </div>
  );
}
