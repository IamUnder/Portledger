import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  data: Record<string, number | string>[];
  dataKey: string;
  xKey: string;
  color: string;
  unit?: string;
  domain?: [number | string, number | string];
  gradientId: string;
}

export function MetricAreaChart({ data, dataKey, xKey, color, unit = "", domain, gradientId }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-800 text-sm text-slate-600">
        sin datos suficientes todavía
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
          <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 11 }} minTickGap={40} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#475569", fontSize: 11 }}
            domain={domain ?? [0, "dataMax"]}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              fontSize: 12,
              color: "#e2e8f0",
            }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(value: unknown) => [`${value}${unit}`, ""]}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
