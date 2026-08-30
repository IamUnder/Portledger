import { Fragment, useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { api, type AuditLog } from "../api";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { EmptyState } from "../components/ui/empty-state";
import { cn } from "../lib/utils";

const METHOD_STYLES: Record<string, string> = {
  POST: "bg-emerald-500/15 text-emerald-400",
  PATCH: "bg-indigo-400/15 text-indigo-300",
  PUT: "bg-indigo-400/15 text-indigo-300",
  DELETE: "bg-red-500/15 text-red-400",
};

function statusColor(code: number): string {
  if (code >= 500) return "text-red-400";
  if (code >= 400) return "text-amber-400";
  return "text-emerald-500";
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    api.auditLogs({ userEmail: userEmail || undefined }).then(setLogs);
  };

  useEffect(load, [userEmail]);
  useEffect(() => {
    api.usersBasic().then(setUsers);
  }, []);

  const visible = logs.filter((l) => l.path.toLowerCase().includes(pathFilter.toLowerCase()));
  const selectClass = "rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-100">Auditoría</h1>
      <p className="mb-6 text-sm text-slate-500">Últimas 300 acciones que han modificado algo, con el usuario responsable.</p>

      <div className="mb-4 flex flex-wrap gap-2">
        <select value={userEmail} onChange={(e) => setUserEmail(e.target.value)} className={selectClass}>
          <option value="">todos los usuarios</option>
          {users.map((u) => (
            <option key={u.id} value={u.email}>
              {u.email}
            </option>
          ))}
        </select>
        <input
          value={pathFilter}
          onChange={(e) => setPathFilter(e.target.value)}
          placeholder="filtrar por ruta (ej. invoices, clients...)"
          className={cn(selectClass, "min-w-[16rem]")}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={ScrollText} title="Sin registros" description="No hay acciones que coincidan con el filtro actual." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>fecha</TableHead>
              <TableHead>usuario</TableHead>
              <TableHead>acción</TableHead>
              <TableHead>estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((l) => (
              <Fragment key={l.id}>
                <TableRow onClick={() => setExpanded(expanded === l.id ? null : l.id)} className="cursor-pointer">
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">{new Date(l.createdAt).toLocaleString("es-ES")}</TableCell>
                  <TableCell className="text-xs">
                    {l.userEmail} <span className="text-slate-600">({l.userRole.toLowerCase()})</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className={cn("mr-2 rounded px-1.5 py-0.5", METHOD_STYLES[l.method] ?? "bg-slate-700/30 text-slate-400")}>{l.method}</span>
                    <span className="text-slate-400">{l.path}</span>
                  </TableCell>
                  <TableCell className={cn("text-xs font-medium", statusColor(l.statusCode))}>{l.statusCode}</TableCell>
                </TableRow>
                {expanded === l.id && l.body && (
                  <TableRow className="bg-slate-950/60 hover:bg-slate-950/60">
                    <TableCell colSpan={4}>
                      <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-slate-500">{l.body}</pre>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
