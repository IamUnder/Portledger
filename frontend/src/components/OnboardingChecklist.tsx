import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Circle, CheckCircle2, Compass } from "lucide-react";
import { api } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils";

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  to: string;
  cta: string;
}

export function OnboardingChecklist() {
  const [items, setItems] = useState<ChecklistItem[] | null>(null);

  useEffect(() => {
    Promise.all([api.projects(), api.companySettings(), api.cfAccounts(), api.config()]).then(
      ([projects, company, cfAccounts, config]) => {
        setItems([
          { key: "project", label: "Crea tu primer proyecto", done: projects.length > 0, to: "/projects/new", cta: "crear proyecto" },
          { key: "company", label: "Configura tus datos fiscales", done: !!company.businessName, to: "/facturas", cta: "ir a Facturas" },
          { key: "cloudflare", label: "Conecta una cuenta de Cloudflare (opcional)", done: cfAccounts.length > 0, to: "/tuneles", cta: "ir a Túneles" },
          { key: "smtp", label: "Configura el envío de email (opcional)", done: config.smtpConfigured, to: "", cta: "ver README" },
        ]);
      }
    );
  }, []);

  if (!items) return null;
  const pending = items.filter((i) => !i.done);
  if (pending.length === 0) return null;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-indigo-400" /> Primeros pasos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-2.5 text-sm">
            {item.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-slate-700" />}
            <span className={cn(item.done ? "text-slate-500 line-through" : "text-slate-300")}>{item.label}</span>
            {!item.done && item.to && (
              <Link to={item.to} className="ml-auto shrink-0 text-xs text-indigo-400 transition-colors hover:text-indigo-300">
                {item.cta} →
              </Link>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
