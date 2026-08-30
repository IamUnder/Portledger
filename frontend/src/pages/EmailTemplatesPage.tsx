import { useEffect, useState } from "react";
import { RotateCcw, Mail } from "lucide-react";
import { api, type EmailTemplate } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { SkeletonCard } from "../components/ui/skeleton";

function TemplateCard({ template, onChanged }: { template: EmailTemplate; onChanged: () => void }) {
  const [subject, setSubject] = useState(template.subject ?? template.defaultSubject);
  const [body, setBody] = useState(template.body ?? template.defaultBody);
  const [saving, setSaving] = useState(false);
  const isCustomized = template.subject !== null || template.body !== null;

  useEffect(() => {
    setSubject(template.subject ?? template.defaultSubject);
    setBody(template.body ?? template.defaultBody);
  }, [template]);

  const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  const save = async () => {
    setSaving(true);
    try {
      await api.updateEmailTemplate(template.key, { subject, body });
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await api.resetEmailTemplate(template.key);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="flex-wrap gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            {template.label}
            {isCustomized && <Badge variant="info">personalizada</Badge>}
          </CardTitle>
          <p className="mt-1 text-xs text-slate-500">{template.description}</p>
        </div>
        <div className="flex gap-2">
          {isCustomized && (
            <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
              <RotateCcw className="h-3.5 w-3.5" /> restaurar por defecto
            </Button>
          )}
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Asunto</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Cuerpo (HTML)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className={`${inputClass} h-28 resize-y font-mono text-xs`} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-800 pt-2.5 text-[11px] text-slate-500">
          {template.variables.map((v) => (
            <span key={v.key}>
              <code className="text-indigo-400">{`{{${v.key}}}`}</code> — {v.description}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);

  const load = () => {
    api.emailTemplates().then(setTemplates);
  };
  useEffect(load, []);

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-100">
        <Mail className="h-5 w-5 text-slate-500" /> Plantillas de email
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Personaliza el asunto y el texto de cada email que envía la aplicación. Usa las variables listadas debajo de cada
        plantilla — se sustituyen automáticamente al enviar.
      </p>

      {templates === null ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        templates.map((t) => <TemplateCard key={t.key} template={t} onChanged={load} />)
      )}
    </div>
  );
}
