import { useEffect, useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { api, type Proposal, type ProposalLineItem } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Borrador" },
  { value: "SENT", label: "Enviada" },
  { value: "NEGOTIATION", label: "Negociación" },
  { value: "ACCEPTED", label: "Aceptada" },
  { value: "REJECTED", label: "Rechazada" },
];

export function ProposalFormModal({
  clientId,
  existing,
  onClose,
  onSaved,
}: {
  clientId: string;
  existing: Proposal | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [status, setStatus] = useState(existing?.status ?? "DRAFT");
  const [publicSlug, setPublicSlug] = useState(existing?.publicSlug ?? "");
  const [sourceType, setSourceType] = useState<"FOLDER" | "GITHUB">(existing?.sourceType ?? "FOLDER");
  const [sourcePath, setSourcePath] = useState(existing?.sourcePath ?? "");
  const [sourceBranch, setSourceBranch] = useState(existing?.sourceBranch ?? "");
  const [validUntil, setValidUntil] = useState(existing?.validUntil?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [lineItems, setLineItems] = useState<ProposalLineItem[]>(existing?.lineItems ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [publicBaseUrl, setPublicBaseUrl] = useState("");

  useEffect(() => {
    api.config().then((c) => setPublicBaseUrl(c.publicBaseUrl));
  }, []);

  const total = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const inputClass = "rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  const save = async () => {
    if (!title.trim()) return setError("el título es obligatorio");
    setSaving(true);
    setError(null);
    const body = {
      clientId,
      title,
      status,
      publicSlug: publicSlug || undefined,
      sourceType,
      sourcePath: sourcePath || undefined,
      sourceBranch: sourceType === "GITHUB" ? sourceBranch || undefined : undefined,
      validUntil: validUntil || undefined,
      notes,
      lineItems: lineItems.map(({ concept, quantity, unitPrice }) => ({ concept, quantity, unitPrice })),
    };
    try {
      if (existing) await api.updateProposal(existing.id, body);
      else await api.createProposal(body);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!existing) return;
    setError(null);
    try {
      await api.publishProposal(existing.id);
      setPublishResult(`${publicBaseUrl}/${publicSlug}`);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={existing ? "Editar propuesta" : "Nueva propuesta"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="mb-3 grid grid-cols-2 gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="título (ej. Rediseño web 2026)"
          className={cn(inputClass, "col-span-2")}
          autoFocus
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputClass} />
      </div>

      <div className="mb-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3.5">
        <div className="mb-2 text-xs font-medium text-slate-400">Web pública</div>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs text-slate-600">{publicBaseUrl ? `${publicBaseUrl.replace(/^https?:\/\//, "")}/` : "/"}</span>
          <input
            value={publicSlug}
            onChange={(e) => setPublicSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="nombre-cliente"
            className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="mb-2 flex gap-1 rounded-md bg-slate-800 p-1 text-xs">
          <button
            onClick={() => setSourceType("FOLDER")}
            className={cn("flex-1 rounded px-2 py-1 transition-colors", sourceType === "FOLDER" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200")}
          >
            Carpeta del servidor
          </button>
          <button
            onClick={() => setSourceType("GITHUB")}
            className={cn("flex-1 rounded px-2 py-1 transition-colors", sourceType === "GITHUB" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200")}
          >
            Repo de GitHub
          </button>
        </div>
        <input
          value={sourcePath}
          onChange={(e) => setSourcePath(e.target.value)}
          placeholder={sourceType === "FOLDER" ? "/home/under/propuestas/cliente" : "https://github.com/usuario/repo.git"}
          className="mb-2 w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
        />
        {sourceType === "GITHUB" && (
          <input
            value={sourceBranch}
            onChange={(e) => setSourceBranch(e.target.value)}
            placeholder="rama (main)"
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
          />
        )}
        {existing && (
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="outline" className="border-emerald-800/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300" onClick={publish}>
              Publicar
            </Button>
            {existing.servedAt && <span className="text-xs text-slate-600">publicado por última vez: {new Date(existing.servedAt).toLocaleString("es-ES")}</span>}
          </div>
        )}
        {publishResult && (
          <p className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
            publicado en{" "}
            <a href={publishResult} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline">
              {publishResult} <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        )}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">Líneas de precio (opcional — funciona como presupuesto)</span>
        <button
          onClick={() => setLineItems((li) => [...li, { concept: "", quantity: 1, unitPrice: 0 }])}
          className="flex items-center gap-1 text-xs text-indigo-300 transition-colors hover:text-indigo-200"
        >
          <Plus className="h-3.5 w-3.5" /> añadir línea
        </button>
      </div>
      {lineItems.map((li, i) => (
        <div key={i} className="mb-1.5 flex gap-1.5">
          <input
            value={li.concept}
            onChange={(e) => setLineItems((arr) => arr.map((x, j) => (j === i ? { ...x, concept: e.target.value } : x)))}
            placeholder="concepto"
            className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="number"
            value={li.quantity}
            onChange={(e) => setLineItems((arr) => arr.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))}
            className="w-16 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="number"
            value={li.unitPrice}
            onChange={(e) => setLineItems((arr) => arr.map((x, j) => (j === i ? { ...x, unitPrice: Number(e.target.value) } : x)))}
            placeholder="precio"
            className="w-20 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
          />
          <button onClick={() => setLineItems((arr) => arr.filter((_, j) => j !== i))} className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {lineItems.length > 0 && (
        <p className="mb-3 text-right text-xs text-slate-400">
          total: <span className="text-slate-200">{total.toFixed(2)} €</span>
        </p>
      )}

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="notas internas"
        className="mt-2 h-16 w-full resize-none rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
      />

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
