import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Square, Plus, Receipt, Clock, Pencil, Trash2 } from "lucide-react";
import { api, type TimeEntry, type Client } from "../api";
import { useMe } from "../MeContext";
import { TimeEntryFormModal } from "../components/TimeEntryFormModal";
import { GenerateDeliveryNoteFromTimeModal } from "../components/GenerateDeliveryNoteFromTimeModal";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { EmptyState } from "../components/ui/empty-state";
import { useConfirm } from "../components/ui/confirm-dialog";
import { cn } from "../lib/utils";

const RANGE_OPTIONS = [
  { key: "today", label: "hoy" },
  { key: "week", label: "esta semana" },
  { key: "month", label: "este mes" },
  { key: "all", label: "todo" },
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

function rangeFrom(key: RangeKey): string | undefined {
  const now = new Date();
  if (key === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (key === "week") {
    const day = (now.getDay() + 6) % 7; // lunes = 0
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    return monday.toISOString();
  }
  if (key === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return undefined;
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function formatElapsed(startedAt: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function TimeTrackingPage() {
  const me = useMe();
  const confirm = useConfirm();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [range, setRange] = useState<RangeKey>("week");
  const [clientFilter, setClientFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [editing, setEditing] = useState<TimeEntry | null | undefined>(undefined);
  const [generatingNote, setGeneratingNote] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [starterDescription, setStarterDescription] = useState("");
  const [starterClientId, setStarterClientId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .timeEntries({ from: rangeFrom(range), clientId: clientFilter || undefined, userId: me.role === "ADMIN" ? userFilter || undefined : undefined })
      .then(setEntries);
    api.runningTimeEntry().then(setRunning);
  };

  useEffect(load, [range, clientFilter, userFilter]);
  useEffect(() => {
    api.clients().then(setClients);
    if (me.role === "ADMIN") api.usersBasic().then(setUsers);
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [running]);

  const startTimer = async () => {
    if (!starterDescription.trim()) return setError("describe en qué vas a trabajar");
    setError(null);
    try {
      const entry = await api.startTimeEntry({ description: starterDescription, clientId: starterClientId || undefined });
      setRunning(entry);
      setStarterDescription("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const stopTimer = async () => {
    if (!running) return;
    await api.stopTimeEntry(running.id);
    setRunning(null);
    load();
  };

  const removeEntry = async (e: TimeEntry) => {
    if (!(await confirm({ title: "¿Eliminar este registro?", description: e.description, destructive: true }))) return;
    try {
      await api.deleteTimeEntry(e.id);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const totals = useMemo(() => {
    const totalMinutes = entries.reduce((s, e) => s + (e.minutes ?? 0), 0);
    const billableMinutes = entries.filter((e) => e.billable).reduce((s, e) => s + (e.minutes ?? 0), 0);
    const billableAmount = entries
      .filter((e) => e.billable && e.hourlyRate)
      .reduce((s, e) => s + ((e.minutes ?? 0) / 60) * (e.hourlyRate ?? 0), 0);
    return { totalMinutes, billableMinutes, billableAmount };
  }, [entries]);

  const inputClass = "rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Registro de horas</h1>

      <Card className="mb-6 p-4">
        {running ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-200">{running.description}</div>
              <div className="text-xs text-slate-500">
                {running.client?.name && <span>{running.client.name} · </span>}
                en marcha desde {new Date(running.startedAt).toLocaleTimeString("es-ES")}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-lg text-emerald-400">{formatElapsed(running.startedAt, now)}</span>
              <Button variant="destructive" onClick={stopTimer}>
                <Square className="h-4 w-4" /> Parar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={starterDescription}
              onChange={(e) => setStarterDescription(e.target.value)}
              placeholder="¿En qué vas a trabajar?"
              className="min-w-[16rem] flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && startTimer()}
            />
            <select
              value={starterClientId}
              onChange={(e) => setStarterClientId(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
            >
              <option value="">sin cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button variant="outline" className="border-emerald-800/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300" onClick={startTimer}>
              <Play className="h-4 w-4" /> Iniciar
            </Button>
          </div>
        )}
      </Card>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn("rounded-md px-2.5 py-1 text-xs transition-colors", range === r.key ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200")}
            >
              {r.label}
            </button>
          ))}
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={inputClass}>
            <option value="">todos los clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {me.role === "ADMIN" && (
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className={inputClass}>
              <option value="">todos los usuarios</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          {me.role === "ADMIN" && (
            <Button size="sm" variant="outline" className="border-emerald-800/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300" onClick={() => setGeneratingNote(true)}>
              <Receipt className="h-3.5 w-3.5" /> Añadir a factura
            </Button>
          )}
          <Button size="sm" onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" /> Registro manual
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-6 text-sm text-slate-400">
        <span>
          total: <span className="text-slate-200">{formatHours(totals.totalMinutes)}</span>
        </span>
        <span>
          facturable: <span className="text-slate-200">{formatHours(totals.billableMinutes)}</span>
        </span>
        <span>
          importe facturable: <span className="text-slate-200">{totals.billableAmount.toFixed(2)} €</span>
        </span>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Clock} title="Sin registros en este periodo" description="Inicia un cronómetro arriba o añade un registro manual." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>fecha</TableHead>
              <TableHead>descripción</TableHead>
              <TableHead>cliente / proyecto</TableHead>
              {me.role === "ADMIN" && <TableHead>usuario</TableHead>}
              <TableHead>duración</TableHead>
              <TableHead>estado</TableHead>
              <TableHead className="text-right">acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => {
              return (
                <TableRow key={e.id}>
                  <TableCell className="text-slate-400">{new Date(e.startedAt).toLocaleDateString("es-ES")}</TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {e.client?.name}
                    {e.client && e.project && " · "}
                    {e.project?.name}
                  </TableCell>
                  {me.role === "ADMIN" && <TableCell className="text-xs text-slate-500">{e.user?.email}</TableCell>}
                  <TableCell>{e.minutes != null ? formatHours(e.minutes) : "en marcha"}</TableCell>
                  <TableCell>
                    {e.deliveryNoteId ? (
                      <Badge variant="success">facturado</Badge>
                    ) : e.billable ? (
                      <Badge variant="warning">facturable{e.hourlyRate ? ` (${e.hourlyRate}€/h)` : ""}</Badge>
                    ) : (
                      <Badge>no facturable</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(e)} title={e.deliveryNoteId ? "ver" : "editar"} className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-indigo-300">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!e.deliveryNoteId && (
                        <button onClick={() => removeEntry(e)} title="eliminar" className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <p className="mt-3 text-xs text-slate-600">
        La tarifa de cada cliente se configura en su{" "}
        <Link to="/clientes" className="text-indigo-400 transition-colors hover:text-indigo-300">
          ficha
        </Link>
        .
      </p>

      {editing !== undefined && <TimeEntryFormModal existing={editing} onClose={() => setEditing(undefined)} onSaved={load} />}
      {generatingNote && <GenerateDeliveryNoteFromTimeModal onClose={() => setGeneratingNote(false)} onSaved={load} />}
    </div>
  );
}
