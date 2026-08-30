export const CRON_PRESETS = [
  { label: "Cada 5 minutos", value: "*/5 * * * *" },
  { label: "Cada 15 minutos", value: "*/15 * * * *" },
  { label: "Cada hora", value: "0 * * * *" },
  { label: "Cada día a las 03:00", value: "0 3 * * *" },
  { label: "Cada 6 horas", value: "0 */6 * * *" },
  { label: "Cada 12 horas", value: "0 */12 * * *" },
  { label: "Cada domingo a las 04:00", value: "0 4 * * 0" },
  { label: "Personalizado", value: "custom" },
] as const;

const DOW = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function describeCron(expr: string): string {
  const preset = CRON_PRESETS.find((p) => p.value === expr);
  if (preset) return preset.label;

  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, , dow] = parts;

  if (dom === "*" && dow === "*" && /^\d+$/.test(min) && /^\d+$/.test(hour)) {
    return `cada día a las ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  if (dom === "*" && dow !== "*" && /^\d+$/.test(dow) && /^\d+$/.test(min) && /^\d+$/.test(hour)) {
    return `cada ${DOW[Number(dow)]} a las ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  const everyHours = hour.match(/^\*\/(\d+)$/);
  if (everyHours && min === "0") return `cada ${everyHours[1]} horas`;

  const everyMinutes = min.match(/^\*\/(\d+)$/);
  if (everyMinutes && hour === "*" && dom === "*" && dow === "*") return `cada ${everyMinutes[1]} minutos`;

  if (min === "0" && hour === "*" && dom === "*" && dow === "*") return "cada hora";

  return expr;
}
