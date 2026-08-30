import { useEffect, useState } from "react";
import { api, type Task, type Client, type Project } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
import { useConfirm } from "./ui/confirm-dialog";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

export function TaskFormModal({
  existing,
  defaultStatus,
  onClose,
  onSaved,
}: {
  existing: Task | null;
  defaultStatus: Task["status"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const confirm = useConfirm();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(existing?.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = useState(existing?.dueDate?.slice(0, 10) ?? "");
  const [assigneeId, setAssigneeId] = useState(existing?.assigneeId ?? "");
  const [clientId, setClientId] = useState(existing?.clientId ?? "");
  const [projectId, setProjectId] = useState(existing?.projectId ?? "");
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.usersBasic().then(setUsers);
    api.clients().then(setClients);
    api.projects().then(setProjects);
  }, []);

  const inputClass =
    "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  const save = async () => {
    if (!title.trim()) return setError("el título es obligatorio");
    setSaving(true);
    setError(null);
    const data = {
      title,
      description: description || undefined,
      priority,
      dueDate: dueDate || undefined,
      assigneeId: assigneeId || undefined,
      clientId: clientId || undefined,
      projectId: projectId || undefined,
      status: existing?.status ?? defaultStatus,
    };
    try {
      if (existing) await api.updateTask(existing.id, data);
      else await api.createTask(data);
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
    if (!(await confirm({ title: "¿Eliminar esta tarea?", destructive: true }))) return;
    await api.deleteTask(existing.id);
    onSaved();
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title={existing ? "Editar tarea" : "Nueva tarea"}
      footer={
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
      }
    >
      <div className="space-y-3">
        <Field label="Título">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} autoFocus />
        </Field>
        <Field label="Descripción">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} h-20 resize-none`} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prioridad">
            <select value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])} className={inputClass}>
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
            </select>
          </Field>
          <Field label="Fecha límite">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Asignada a">
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputClass}>
            <option value="">sin asignar</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cliente (opcional)">
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
              <option value="">ninguno</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Proyecto (opcional)">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
              <option value="">ninguno</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
