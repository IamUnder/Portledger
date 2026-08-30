import { X } from "lucide-react";
import type { ServiceSpec } from "../api";

function parseEnvText(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const [k, ...rest] = line.split("=");
    if (k && rest.length) env[k.trim()] = rest.join("=").trim();
  }
  return env;
}

function envToText(env?: Record<string, string>): string {
  return Object.entries(env ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

export function ServiceSpecEditor({
  service,
  onChange,
  onRemove,
}: {
  service: ServiceSpec;
  onChange: (s: ServiceSpec) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<ServiceSpec>) => onChange({ ...service, ...patch });

  return (
    <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <input
          value={service.key}
          onChange={(e) => set({ key: e.target.value.replace(/[^a-z0-9]/g, "") })}
          placeholder="nombre del servicio (ej. backend)"
          className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
        />
        <select
          value={service.kind}
          onChange={(e) => set({ kind: e.target.value as ServiceSpec["kind"] })}
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
        >
          <option value="git">Repo de Git (build)</option>
          <option value="database">Base de datos</option>
          <option value="image">Imagen Docker</option>
        </select>
        <button onClick={onRemove} className="flex items-center gap-1 text-xs text-red-400 transition-colors hover:text-red-300">
          <X className="h-3 w-3" /> quitar
        </button>
      </div>

      {service.kind === "git" && (
        <div className="grid grid-cols-2 gap-2">
          <input
            value={service.repoUrl ?? ""}
            onChange={(e) => set({ repoUrl: e.target.value })}
            placeholder="https://github.com/usuario/repo.git"
            className="col-span-2 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
          />
          <input
            value={service.branch ?? ""}
            onChange={(e) => set({ branch: e.target.value })}
            placeholder="rama (main)"
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
          />
          <input
            type="number"
            value={service.port ?? ""}
            onChange={(e) => set({ port: Number(e.target.value) })}
            placeholder="puerto interno (ej. 3000)"
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
          />
          <textarea
            value={envToText(service.env)}
            onChange={(e) => set({ env: parseEnvText(e.target.value) })}
            placeholder={"variables de entorno, una por línea\nCLAVE=valor"}
            className="col-span-2 h-16 resize-none rounded border border-slate-700 bg-slate-800 px-2 py-1.5 font-mono text-xs text-slate-200"
          />
        </div>
      )}

      {service.kind === "database" && (
        <div className="grid grid-cols-2 gap-2">
          <select
            value={service.engine ?? "mysql"}
            onChange={(e) => set({ engine: e.target.value as "mysql" | "postgres" })}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="mysql">MySQL</option>
            <option value="postgres">Postgres</option>
          </select>
          <input
            value={service.dbName ?? ""}
            onChange={(e) => set({ dbName: e.target.value })}
            placeholder="nombre de la base de datos"
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
          />
          {service.engine === "postgres" && (
            <input
              value={service.dbUser ?? ""}
              onChange={(e) => set({ dbUser: e.target.value })}
              placeholder="usuario"
              className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
            />
          )}
          <input
            value={service.dbPassword ?? ""}
            onChange={(e) => set({ dbPassword: e.target.value })}
            placeholder={service.engine === "postgres" ? "contraseña" : "contraseña de root"}
            type="password"
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
          />
        </div>
      )}

      {service.kind === "image" && (
        <div className="grid grid-cols-2 gap-2">
          <input
            value={service.image ?? ""}
            onChange={(e) => set({ image: e.target.value })}
            placeholder="ej. redis:7"
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
          />
          <input
            type="number"
            value={service.port ?? ""}
            onChange={(e) => set({ port: Number(e.target.value) })}
            placeholder="puerto interno"
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
          />
          <textarea
            value={envToText(service.env)}
            onChange={(e) => set({ env: parseEnvText(e.target.value) })}
            placeholder={"variables de entorno, una por línea\nCLAVE=valor"}
            className="col-span-2 h-16 resize-none rounded border border-slate-700 bg-slate-800 px-2 py-1.5 font-mono text-xs text-slate-200"
          />
        </div>
      )}

      {service.kind !== "database" && (
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={!!service.isPublic}
            onChange={(e) => set({ isPublic: e.target.checked })}
            className="accent-indigo-400"
          />
          este es el servicio público (al que apuntará el túnel)
        </label>
      )}
    </div>
  );
}
