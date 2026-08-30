import { useState } from "react";
import { api, type CronJob } from "../api";
import { CRON_PRESETS } from "../cron";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

export function CronJobFormModal({ existing, onClose, onSaved }: { existing: CronJob | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [url, setUrl] = useState(existing?.url ?? "");
  const [method, setMethod] = useState<CronJob["method"]>(existing?.method ?? "POST");
  const [headers, setHeaders] = useState(existing?.headers ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [schedulePreset, setSchedulePreset] = useState<string>(
    CRON_PRESETS.find((p) => p.value === existing?.schedule)?.value ?? (existing ? "custom" : "*/15 * * * *")
  );
  const [customCron, setCustomCron] = useState(existing?.schedule ?? "*/15 * * * *");
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const schedule = schedulePreset === "custom" ? customCron : schedulePreset;
  const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  const save = async () => {
    if (!name.trim() || !url.trim()) return setError("nombre y URL son obligatorios");
    setSaving(true);
    setError(null);
    const data = { name, url, method, headers: headers || undefined, body: body || undefined, schedule, enabled };
    try {
      if (existing) await api.updateCronJob(existing.id, data);
      else await api.createCronJob(data);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={existing ? "Editar automatización" : "Nueva automatización"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
        <div className="space-y-3">
          <Field label="Nombre">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Recordatorios diarios" className={inputClass} autoFocus />
          </Field>

          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-1">
              <Field label="Método">
                <select value={method} onChange={(e) => setMethod(e.target.value as CronJob["method"])} className={inputClass}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                </select>
              </Field>
            </div>
            <div className="col-span-3">
              <Field label="URL del endpoint">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://mi-proyecto-backend:8080/tareas/recordatorios"
                  className={`${inputClass} font-mono text-xs`}
                />
              </Field>
            </div>
          </div>

          <Field label="Calendario">
            <select value={schedulePreset} onChange={(e) => setSchedulePreset(e.target.value)} className={inputClass}>
              {CRON_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          {schedulePreset === "custom" && (
            <input
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              placeholder="expresión cron, ej. 30 2 * * *"
              className={`${inputClass} font-mono text-xs`}
            />
          )}

          <Field label="Cabeceras HTTP (opcional, una por línea)">
            <textarea
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              placeholder={"Authorization: Bearer xxx\nContent-Type: application/json"}
              className={`${inputClass} h-16 resize-none font-mono text-xs`}
            />
          </Field>

          {method !== "GET" && (
            <Field label="Cuerpo de la petición (opcional)">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{"clave": "valor"}'
                className={`${inputClass} h-16 resize-none font-mono text-xs`}
              />
            </Field>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-indigo-400" />
            activa
          </label>
        </div>

        {error && <p className="mb-3 mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
