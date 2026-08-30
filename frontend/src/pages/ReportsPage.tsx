import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Euro, TrendingUp, Users, Receipt, Download } from "lucide-react";
import { api, type MonthlyRevenue, type ClientRevenue } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { RevenueBarChart } from "../components/RevenueBarChart";
import { SkeletonCard } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Button } from "../components/ui/button";
import { downloadCsv } from "../lib/csv";

const RANGES = [
  { label: "6 meses", months: 6 },
  { label: "12 meses", months: 12 },
  { label: "24 meses", months: 24 },
];

function KpiCard({ icon: Icon, label, value, sub }: { icon: typeof Euro; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-2xl font-semibold text-slate-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

export function ReportsPage() {
  const [months, setMonths] = useState(12);
  const [revenue, setRevenue] = useState<MonthlyRevenue[] | null>(null);
  const [byClient, setByClient] = useState<ClientRevenue[] | null>(null);

  useEffect(() => {
    api.monthlyRevenue(months).then(setRevenue);
  }, [months]);
  useEffect(() => {
    api.revenueByClient().then(setByClient);
  }, []);

  const thisMonthKey = new Date().toISOString().slice(0, 7);
  const paidThisMonth = revenue?.find((r) => r.month === thisMonthKey)?.paid ?? 0;
  const totalPaidRange = revenue?.reduce((s, r) => s + r.paid, 0) ?? 0;
  const totalInvoicedRange = revenue?.reduce((s, r) => s + r.invoiced, 0) ?? 0;
  const activeClients = byClient?.filter((c) => c.paidTotal + c.pendingTotal > 0).length ?? 0;

  if (revenue === null || byClient === null) {
    return (
      <div>
        <h1 className="mb-6 text-xl font-semibold text-slate-100">Informes</h1>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const hasAnyData = revenue.some((r) => r.invoiced > 0 || r.paid > 0);

  const exportMonthly = () => {
    downloadCsv(
      `facturacion-mensual-${months}m.csv`,
      ["mes", "facturado", "cobrado"],
      revenue.map((r) => [r.month, r.invoiced.toFixed(2), r.paid.toFixed(2)])
    );
  };

  const exportByClient = () => {
    downloadCsv(
      "facturacion-por-cliente.csv",
      ["cliente", "cobrado", "pendiente", "num_facturas"],
      byClient.map((c) => [c.clientName, c.paidTotal.toFixed(2), c.pendingTotal.toFixed(2), c.invoiceCount])
    );
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-100">Informes</h1>
      <p className="mb-6 text-sm text-slate-500">Evolución de facturación e ingresos por cliente.</p>

      {!hasAnyData ? (
        <EmptyState
          icon={TrendingUp}
          title="Sin datos de facturación todavía"
          description="En cuanto emitas y cobres facturas, aquí verás la evolución mes a mes."
          action={
            <Link to="/facturas" className="text-xs text-indigo-400 hover:text-indigo-300">
              ir a Facturas →
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard icon={Euro} label="Cobrado este mes" value={`${paidThisMonth.toFixed(2)} €`} />
            <KpiCard icon={TrendingUp} label={`Cobrado (${months}m)`} value={`${totalPaidRange.toFixed(2)} €`} />
            <KpiCard icon={Receipt} label={`Facturado (${months}m)`} value={`${totalInvoicedRange.toFixed(2)} €`} />
            <KpiCard icon={Users} label="Clientes con movimiento" value={String(activeClients)} />
          </div>

          <Card className="mb-6">
            <CardHeader className="flex-wrap gap-2">
              <CardTitle>Facturación mensual</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1">
                  {RANGES.map((r) => (
                    <button
                      key={r.months}
                      onClick={() => setMonths(r.months)}
                      className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                        months === r.months ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <Button variant="secondary" size="sm" onClick={exportMonthly}>
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <RevenueBarChart data={revenue} />
            </CardContent>
          </Card>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-300">Por cliente</h2>
            <Button variant="secondary" size="sm" onClick={exportByClient}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>cliente</TableHead>
                <TableHead className="text-right">cobrado</TableHead>
                <TableHead className="text-right">pendiente</TableHead>
                <TableHead className="text-right">facturas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byClient.map((c) => (
                <TableRow key={c.clientId}>
                  <TableCell>
                    <Link to={`/clientes/${c.clientId}`} className="text-indigo-300 transition-colors hover:text-indigo-200">
                      {c.clientName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-emerald-400">{c.paidTotal.toFixed(2)} €</TableCell>
                  <TableCell className="text-right text-amber-400">{c.pendingTotal.toFixed(2)} €</TableCell>
                  <TableCell className="text-right text-slate-400">{c.invoiceCount}</TableCell>
                </TableRow>
              ))}
              {byClient.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-slate-600">
                    sin facturas todavía
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
