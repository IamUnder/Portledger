import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { MonthlyRevenue } from "../api";

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
}

export function RevenueBarChart({ data }: { data: MonthlyRevenue[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-slate-800 text-sm text-slate-600">
        sin datos suficientes todavía
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, label: formatMonth(d.month) }));

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 11 }} width={48} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(value: unknown) => [`${Number(value).toFixed(2)} €`, ""]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
          <Bar dataKey="invoiced" name="facturado" fill="#818cf8" radius={[3, 3, 0, 0]} />
          <Bar dataKey="paid" name="cobrado" fill="#34d399" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expenses" name="gastos" fill="#f87171" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
