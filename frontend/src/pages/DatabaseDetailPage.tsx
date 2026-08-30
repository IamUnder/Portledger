import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { api, type DatabaseRecord, type QueryStat } from "../api";
import { Button } from "../components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { SkeletonTable } from "../components/ui/skeleton";
import { useConfirm } from "../components/ui/confirm-dialog";

export function DatabaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const confirm = useConfirm();
  const [database, setDatabase] = useState<DatabaseRecord | null>(null);
  const [stats, setStats] = useState<QueryStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const loadStats = () => {
    if (!id) return;
    api
      .databaseStats(id)
      .then((r) => {
        setStats(r.stats);
        setError(null);
      })
      .catch((err) => setError((err as Error).message));
  };

  useEffect(() => {
    if (id) api.database(id).then(setDatabase);
    loadStats();
  }, [id]);

  const reset = async () => {
    if (!id) return;
    if (!(await confirm({ title: "¿Reiniciar las estadísticas acumuladas?", description: "Se pierde el histórico de conteos/tiempos.", destructive: true }))) return;
    setResetting(true);
    try {
      await api.resetDatabaseStats(id);
      loadStats();
    } finally {
      setResetting(false);
    }
  };

  if (!database) return <SkeletonTable cols={5} />;

  return (
    <div>
      {database.project && (
        <Link to={`/projects/${database.project.id}`} className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-300">
          <ArrowLeft className="h-3.5 w-3.5" /> {database.project.name}
        </Link>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">{database.label}</h1>
          <div className="font-mono text-xs text-slate-600">
            {database.engine} · {database.containerName} · {database.databaseName}
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={reset} disabled={resetting}>
          <RotateCcw className="h-3.5 w-3.5" /> {resetting ? "reiniciando…" : "reiniciar estadísticas"}
        </Button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>}

      {!error && !stats && <SkeletonTable cols={5} />}

      {stats && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>consulta</TableHead>
              <TableHead className="text-right">ejecuciones</TableHead>
              <TableHead className="text-right">tiempo medio</TableHead>
              <TableHead className="text-right">tiempo total</TableHead>
              <TableHead className="text-right">filas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((s, i) => (
              <TableRow key={i} onClick={() => setExpanded(expanded === i ? null : i)} className="cursor-pointer">
                <TableCell className="max-w-md font-mono text-xs">
                  {expanded === i ? <pre className="whitespace-pre-wrap">{s.query}</pre> : <span className="block truncate">{s.query}</span>}
                </TableCell>
                <TableCell className="text-right">{s.execCount}</TableCell>
                <TableCell className="text-right">{s.avgTimeMs} ms</TableCell>
                <TableCell className="text-right text-slate-200">{s.totalTimeMs} ms</TableCell>
                <TableCell className="text-right">{s.rowsExamined}</TableCell>
              </TableRow>
            ))}
            {stats.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-slate-600">
                  sin datos todavía — vuelve a mirar cuando la aplicación haya recibido tráfico
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
