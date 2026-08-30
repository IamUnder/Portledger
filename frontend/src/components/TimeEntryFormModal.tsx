import { useEffect, useState } from "react";
import { api, type TimeEntry, type Client, type Project, type Task } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useConfirm } from "./ui/confirm-dialog";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

export function TimeEntryFormModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: TimeEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const confirm = useConfirm();
  const alreadyInvoiced = !!existing?.deliveryNoteId;

  const [description, setDescription] = useState(existing?.description ?? "");
  const [date, setDate] = useState(existing?.startedAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState(existing?.minutes ? existing.minutes / 60 : 1);
  const [clientId, setClientId] = useState(existing?.clientId ?? "");
  const [projectId, setProjectId] = useState(existing?.projectId ?? "");
  const [taskId, setTaskId] = useState(existing?.taskId ?? "");
  const [billable, setBillable] = useState(existing?.billable ?? true);
  const [hourlyRate, setHourlyRate] = useState<number | "">(existing?.hourlyRate ?? "");
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.clients().then(setClients);
    api.projects().then(setProjects);
    api.tasks().then(setTasks);
  }, []);

  const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none disabled:opacity-50";

  const onClientChange = (id: string) => {
    setClientId(id);
    if (!existing && hourlyRate === "") {
      const client = clients.find((c) => c.id === id);
      if (client?.defaultHourlyRate) setHourlyRate(client.defaultHourlyRate);
    }
  };

  const save = async () => {
    if (!description.trim()) return setError("la descripción es obligatoria");
    if (!hours || hours <= 0) return setError("la duración debe ser mayor que 0");
    setSaving(true);
    setError(null);
    const data = {
      description,
      date,
      minutes: Math.round(hours * 60),
      clientId: clientId || undefined,
      projectId: projectId || undefined,
      taskId: taskId || undefined,
      billable,
      hourlyRate: hourlyRate === "" ? undefined : hourlyRate,
    };
    try {
      if (existing) await api.updateTimeEntry(existing.id, data);
      else await api.createTimeEntry(data);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (!(await confirm({ title: "¿Eliminar este registro?", destructive: true }))) return;
    try {
      await api.deleteTimeEntry(existing.id);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={existing ? "Editar registro" : "Nuevo registro manual"}
      description={alreadyInvoiced ? "Este registro ya forma parte de un albarán/factura y no se puede modificar." : undefined}
      footer={
        alreadyInvoiced ? (
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        ) : (
          <>
            {existing && (
              <Button variant="ghost" className="mr-auto text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={remove}>
                Eliminar
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        )
      }
    >
      {alreadyInvoiced && (
        <div className="mb-3">
          <Badge variant="success">facturado</Badge>
        </div>
      )}
      <div className="space-y-3">
        <Field label="Descripción">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} autoFocus disabled={alreadyInvoiced} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Fecha">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} disabled={alreadyInvoiced} />
          </Field>
          <Field label="Horas">
            <input type="number" step="0.25" value={hours} onChange={(e) => setHours(Number(e.target.value))} className={inputClass} disabled={alreadyInvoiced} />
          </Field>
        </div>
        <Field label="Cliente (opcional)">
          <select value={clientId} onChange={(e) => onClientChange(e.target.value)} className={inputClass} disabled={alreadyInvoiced}>
            <option value="">ninguno</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Proyecto (opcional)">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass} disabled={alreadyInvoiced}>
            <option value="">ninguno</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tarea (opcional)">
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className={inputClass} disabled={alreadyInvoiced}>
            <option value="">ninguna</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 items-end gap-2">
          <Field label="Tarifa (€/h, opcional)">
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value === "" ? "" : Number(e.target.value))}
              className={inputClass}
              disabled={alreadyInvoiced}
            />
          </Field>
          <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="accent-indigo-500" disabled={alreadyInvoiced} />
            facturable
          </label>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
