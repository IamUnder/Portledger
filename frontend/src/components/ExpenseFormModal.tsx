import { useEffect, useState } from "react";
import { api, type Expense, type Project } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";

const CATEGORIES = [
  { value: "SOFTWARE", label: "Software" },
  { value: "HOSTING", label: "Hosting / infraestructura" },
  { value: "MATERIALES", label: "Materiales" },
  { value: "SERVICIOS", label: "Servicios profesionales" },
  { value: "OTRO", label: "Otro" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

export function ExpenseFormModal({ existing, onClose, onSaved }: { existing: Expense | null; onClose: () => void; onSaved: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [concept, setConcept] = useState(existing?.concept ?? "");
  const [amount, setAmount] = useState(existing?.amount ?? 0);
  const [date, setDate] = useState(existing?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(existing?.category ?? "OTRO");
  const [projectId, setProjectId] = useState(existing?.projectId ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.projects().then(setProjects);
  }, []);

  const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  const save = async () => {
    if (!concept.trim()) return setError("el concepto es obligatorio");
    if (!amount) return setError("el importe es obligatorio");
    setSaving(true);
    setError(null);
    const data = { concept, amount, date, category, projectId: projectId || null, notes: notes || undefined };
    try {
      if (existing) await api.updateExpense(existing.id, data);
      else await api.createExpense(data);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={existing ? "Editar gasto" : "Nuevo gasto"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Concepto">
          <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="ej. Renovación dominio" className={inputClass} autoFocus />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Importe (€)">
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Fecha">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Categoría">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Proyecto (opcional)">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
              <option value="">sin proyecto asociado</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notas (opcional)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} h-16 resize-none`} />
        </Field>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
