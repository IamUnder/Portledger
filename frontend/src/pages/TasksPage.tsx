import { useEffect, useMemo, useState } from "react";
import { Plus, User, FolderKanban, Calendar, X } from "lucide-react";
import { api, type Task, type Project } from "../api";
import { TaskFormModal } from "../components/TaskFormModal";
import { cn } from "../lib/utils";

const COLUMNS = [
  { status: "TODO", label: "Por hacer" },
  { status: "IN_PROGRESS", label: "En progreso" },
  { status: "REVIEW", label: "En revisión" },
  { status: "DONE", label: "Hecho" },
] as const;

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-slate-700/30 text-slate-500 ring-slate-700/30",
  MEDIUM: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  HIGH: "bg-red-500/15 text-red-400 ring-red-500/30",
};
const PRIORITY_BORDER: Record<string, string> = {
  LOW: "border-l-slate-700",
  MEDIUM: "border-l-amber-500",
  HIGH: "border-l-red-500",
};
const PRIORITY_LABEL: Record<string, string> = { LOW: "baja", MEDIUM: "media", HIGH: "alta" };

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      onClick={onClick}
      className={cn(
        "mb-2 cursor-pointer rounded-lg border border-l-[3px] border-slate-800 bg-slate-900/60 p-3 transition-all duration-200 hover:border-slate-700 hover:bg-slate-900",
        PRIORITY_BORDER[task.priority]
      )}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="text-sm text-slate-200">{task.title}</span>
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ring-1 ${PRIORITY_STYLES[task.priority]}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
        {task.client && (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">{task.client.name}</span>
        )}
        {task.project && (
          <span className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
            <FolderKanban className="h-2.5 w-2.5" /> {task.project.name}
          </span>
        )}
        {task.assignee && (
          <span className="flex items-center gap-1">
            <User className="h-2.5 w-2.5" /> {task.assignee.email.split("@")[0]}
          </span>
        )}
        {task.dueDate && (
          <span className={cn("flex items-center gap-1", overdue && "font-medium text-red-400")}>
            <Calendar className="h-2.5 w-2.5" /> {new Date(task.dueDate).toLocaleDateString("es-ES")}
          </span>
        )}
      </div>
    </div>
  );
}

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [editing, setEditing] = useState<Task | null | undefined>(undefined);
  const [newInColumn, setNewInColumn] = useState<Task["status"] | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const load = () => {
    api.tasks().then(setTasks);
  };
  useEffect(load, []);
  useEffect(() => {
    api.projects().then(setProjects);
    api.usersBasic().then(setUsers);
  }, []);

  const moveTask = async (taskId: string, status: Task["status"]) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    const position = tasks.filter((t) => t.status === status).length;
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status: status as Task["status"] } : t)));
    await api.updateTask(taskId, { status, position });
    load();
  };

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (!assigneeFilter || t.assigneeId === assigneeFilter) &&
          (!projectFilter || t.projectId === projectFilter) &&
          (!priorityFilter || t.priority === priorityFilter)
      ),
    [tasks, assigneeFilter, projectFilter, priorityFilter]
  );

  const hasFilters = assigneeFilter || projectFilter || priorityFilter;
  const selectClass =
    "rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 transition-colors focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Tareas</h1>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={selectClass}>
          <option value="">todos los asignados</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
            </option>
          ))}
        </select>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={selectClass}>
          <option value="">todos los proyectos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={selectClass}>
          <option value="">toda prioridad</option>
          <option value="HIGH">alta</option>
          <option value="MEDIUM">media</option>
          <option value="LOW">baja</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => {
              setAssigneeFilter("");
              setProjectFilter("");
              setPriorityFilter("");
            }}
            className="flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            <X className="h-3 w-3" /> limpiar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = filtered.filter((t) => t.status === col.status);
          return (
            <div
              key={col.status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCol(col.status);
              }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/plain");
                setDragOverCol(null);
                moveTask(taskId, col.status);
              }}
              className={cn(
                "rounded-xl border p-3 transition-all duration-200",
                dragOverCol === col.status ? "border-indigo-500 bg-indigo-500/5" : "border-slate-800 bg-slate-950/40"
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {col.label} <span className="text-slate-700">({colTasks.length})</span>
                </span>
                <button
                  onClick={() => setNewInColumn(col.status)}
                  className="flex items-center gap-0.5 text-xs text-indigo-300 transition-colors hover:text-indigo-200"
                >
                  <Plus className="h-3.5 w-3.5" /> añadir
                </button>
              </div>
              <div className="min-h-[80px]">
                {colTasks.map((t) => (
                  <TaskCard key={t.id} task={t} onClick={() => setEditing(t)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {editing !== undefined && (
        <TaskFormModal existing={editing} defaultStatus="TODO" onClose={() => setEditing(undefined)} onSaved={load} />
      )}
      {newInColumn && (
        <TaskFormModal existing={null} defaultStatus={newInColumn} onClose={() => setNewInColumn(null)} onSaved={load} />
      )}
    </div>
  );
}
