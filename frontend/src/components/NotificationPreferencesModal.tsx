import { useEffect, useState } from "react";
import { api, type NotificationPreference, type Project } from "../api";
import { Modal } from "./ui/dialog";
import { cn } from "../lib/utils";

const SEVERITY_DOT: Record<string, string> = {
  INFO: "bg-indigo-400",
  WARNING: "bg-amber-500",
  CRITICAL: "bg-red-500",
};

export function NotificationPreferencesModal({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.notificationPreferences().then(setPrefs);
    api.projects().then(setProjects);
  }, []);

  const persist = async (type: string, next: NotificationPreference) => {
    setSaving(type);
    try {
      await api.updateNotificationPreference(type, { enabled: next.enabled, emailEnabled: next.emailEnabled, config: next.config });
    } finally {
      setSaving(null);
    }
  };

  const update = (type: string, patch: Partial<Pick<NotificationPreference, "enabled" | "emailEnabled">>) => {
    const current = prefs.find((p) => p.type === type)!;
    const next = { ...current, ...patch };
    setPrefs((ps) => ps.map((p) => (p.type === type ? next : p)));
    persist(type, next);
  };

  const updateConfig = (type: string, key: string, value: number | string[]) => {
    const current = prefs.find((p) => p.type === type)!;
    const next = { ...current, config: { ...current.config, [key]: value } };
    setPrefs((ps) => ps.map((p) => (p.type === type ? next : p)));
    persist(type, next);
  };

  const toggleExcludedProject = (type: string, key: string, projectId: string) => {
    const current = prefs.find((p) => p.type === type)!;
    const list = (current.config[key] as string[] | undefined) ?? [];
    const next = list.includes(projectId) ? list.filter((id) => id !== projectId) : [...list, projectId];
    updateConfig(type, key, next);
  };

  return (
    <Modal
      onClose={onClose}
      title="Preferencias de notificaciones"
      description="Qué quieres recibir, cuándo exactamente y si además por email. Solo te afecta a ti."
      size="lg"
    >
      <div className="space-y-3">
        {prefs.map((p) => (
          <div key={p.type} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3.5 transition-colors">
            <div className="mb-1 flex items-center gap-2">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[p.severity]}`} />
              <span className="text-sm font-medium text-slate-200">{p.label}</span>
            </div>
            <p className="mb-2.5 text-xs text-slate-500">{p.description}</p>
            <div className="flex items-center gap-4 text-xs text-slate-300">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) => update(p.type, { enabled: e.target.checked })}
                  className="accent-indigo-500"
                />
                recibir
              </label>
              <label className={cn("flex cursor-pointer items-center gap-1.5", !p.enabled && "opacity-40")}>
                <input
                  type="checkbox"
                  checked={p.emailEnabled}
                  disabled={!p.enabled}
                  onChange={(e) => update(p.type, { emailEnabled: e.target.checked })}
                  className="accent-indigo-500"
                />
                además por email
              </label>
              {saving === p.type && <span className="text-slate-600">guardando…</span>}
            </div>

            {p.enabled && p.configFields.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                {p.configFields.map((field) =>
                  field.kind === "number" ? (
                    <label key={field.key} className="flex items-center gap-2 text-xs text-slate-400">
                      {field.label}
                      <input
                        type="number"
                        min={field.min}
                        max={field.max}
                        value={(p.config[field.key] as number) ?? field.default}
                        onChange={(e) => updateConfig(p.type, field.key, Number(e.target.value))}
                        className="w-20 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
                      />
                      {field.unit && <span>{field.unit}</span>}
                    </label>
                  ) : (
                    <div key={field.key}>
                      <div className="mb-1 text-xs text-slate-400">{field.label}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {projects.map((proj) => {
                          const excluded = ((p.config[field.key] as string[] | undefined) ?? []).includes(proj.id);
                          return (
                            <button
                              key={proj.id}
                              onClick={() => toggleExcludedProject(p.type, field.key, proj.id)}
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[11px] transition-colors",
                                excluded ? "bg-slate-800 text-slate-600 line-through" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                              )}
                            >
                              {proj.name}
                            </button>
                          );
                        })}
                        {projects.length === 0 && <span className="text-[11px] text-slate-600">sin proyectos</span>}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
