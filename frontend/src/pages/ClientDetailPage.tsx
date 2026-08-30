import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Plus, Receipt, Mail, Trash2, ExternalLink } from "lucide-react";
import { api, type Client, type Proposal, type DeliveryNote, type Invoice } from "../api";
import { ClientFormModal } from "../components/ClientFormModal";
import { ProposalFormModal } from "../components/ProposalFormModal";
import { DeliveryNoteFormModal } from "../components/DeliveryNoteFormModal";
import { GenerateInvoiceModal } from "../components/GenerateInvoiceModal";
import { useMe } from "../MeContext";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { SkeletonCard } from "../components/ui/skeleton";
import { useConfirm } from "../components/ui/confirm-dialog";

const INVOICE_STATUS_VARIANT: Record<string, "neutral" | "info" | "success" | "danger"> = {
  DRAFT: "neutral",
  SENT: "info",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};
const INVOICE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "borrador",
  SENT: "enviada",
  PAID: "pagada",
  OVERDUE: "vencida",
  CANCELLED: "cancelada",
};

const STATUS_VARIANT: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  DRAFT: "neutral",
  SENT: "info",
  NEGOTIATION: "warning",
  ACCEPTED: "success",
  REJECTED: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "borrador",
  SENT: "enviada",
  NEGOTIATION: "negociación",
  ACCEPTED: "aceptada",
  REJECTED: "rechazada",
};

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const confirm = useConfirm();
  const [client, setClient] = useState<Client | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [editingClient, setEditingClient] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | null | undefined>(undefined);
  const [editingNote, setEditingNote] = useState<DeliveryNote | null | undefined>(undefined);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [publicBaseUrl, setPublicBaseUrl] = useState("");

  const load = () => {
    if (!id) return;
    api.client(id).then(setClient);
    api.deliveryNotes(id).then(setDeliveryNotes);
    api.invoices(id).then(setInvoices);
  };
  useEffect(load, [id]);
  useEffect(() => {
    api.config().then((c) => setPublicBaseUrl(c.publicBaseUrl));
  }, []);

  if (!client) return <SkeletonCard />;

  const total = (p: Proposal) => p.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);

  const removeProposal = async (p: Proposal) => {
    if (!(await confirm({ title: `¿Eliminar la propuesta "${p.title}"?`, destructive: true }))) return;
    await api.deleteProposal(p.id);
    load();
  };

  const sendProposalEmail = async (p: Proposal) => {
    try {
      await api.sendProposalEmail(p.id);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div>
      <Link to="/clientes" className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-300">
        <ArrowLeft className="h-3.5 w-3.5" /> clientes
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-100">{client.name}</h1>
          <div className="text-xs text-slate-500">
            {client.contactName && <span>{client.contactName} · </span>}
            {client.email && <span>{client.email} · </span>}
            {client.phone}
          </div>
          {client.project && (
            <Link to={`/projects/${client.project.id}`} className="text-xs text-indigo-400 transition-colors hover:text-indigo-300">
              proyecto: {client.project.name}
            </Link>
          )}
        </div>
        {me.role === "ADMIN" && (
          <Button size="sm" variant="secondary" onClick={() => setEditingClient(true)}>
            <Pencil className="h-3.5 w-3.5" /> Editar cliente
          </Button>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-300">Propuestas</h2>
        {me.role === "ADMIN" && (
          <Button size="sm" onClick={() => setEditingProposal(null)}>
            <Plus className="h-4 w-4" /> Nueva propuesta
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {client.proposals.map((p) => (
          <div key={p.id} className="card-glow rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all duration-200">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-200">{p.title}</span>
              <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              {p.publicSlug && publicBaseUrl && (
                <a
                  href={`${publicBaseUrl}/${p.publicSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-indigo-400 transition-colors hover:text-indigo-300"
                >
                  {publicBaseUrl.replace(/^https?:\/\//, "")}/{p.publicSlug} <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {p.lineItems.length > 0 && <span>total: {total(p).toFixed(2)} €</span>}
              {p.servedAt ? <span className="text-emerald-500">publicada</span> : <span className="text-slate-600">sin publicar</span>}
              {p.emailSentAt && <span>· enviada por email el {new Date(p.emailSentAt).toLocaleDateString("es-ES")}</span>}
            </div>
            {me.role === "ADMIN" && (
              <div className="flex gap-4 text-xs">
                <button onClick={() => setEditingProposal(p)} className="flex items-center gap-1 text-indigo-300 transition-colors hover:text-indigo-200">
                  <Pencil className="h-3 w-3" /> editar
                </button>
                {p.publicSlug && p.servedAt && (
                  <button
                    onClick={() => sendProposalEmail(p)}
                    disabled={!client.email}
                    title={!client.email ? "el cliente no tiene email configurado" : undefined}
                    className="flex items-center gap-1 text-indigo-300 transition-colors hover:text-indigo-200 disabled:opacity-40"
                  >
                    <Mail className="h-3 w-3" /> enviar por email
                  </button>
                )}
                <button onClick={() => removeProposal(p)} className="flex items-center gap-1 text-red-400 transition-colors hover:text-red-300">
                  <Trash2 className="h-3 w-3" /> eliminar
                </button>
              </div>
            )}
          </div>
        ))}
        {client.proposals.length === 0 && <p className="text-sm text-slate-600">sin propuestas todavía</p>}
      </div>

      <div className="mb-4 mt-8 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-300">Albaranes</h2>
        {me.role === "ADMIN" && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-emerald-800/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300" onClick={() => setGeneratingInvoice(true)}>
              <Receipt className="h-3.5 w-3.5" /> Generar factura
            </Button>
            <Button size="sm" onClick={() => setEditingNote(null)}>
              <Plus className="h-4 w-4" /> Nuevo albarán
            </Button>
          </div>
        )}
      </div>
      <div className="mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>concepto</TableHead>
              <TableHead>importe</TableHead>
              <TableHead>estado</TableHead>
              <TableHead className="text-right">acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveryNotes.map((n) => (
              <TableRow key={n.id}>
                <TableCell>{n.concept}</TableCell>
                <TableCell className="text-slate-400">
                  {n.quantity} × {n.unitPrice}€ (+{n.vatRate}% IVA)
                </TableCell>
                <TableCell>
                  {n.status === "PENDING" ? (
                    <Badge variant="warning">pendiente</Badge>
                  ) : n.invoice ? (
                    <Link to={`/facturas/${n.invoice.id}`} className="text-emerald-500 transition-colors hover:text-emerald-400">
                      facturado en {n.invoice.invoiceNumber ?? "(borrador)"}
                    </Link>
                  ) : (
                    <Badge variant="success">facturado</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {me.role === "ADMIN" && n.status === "PENDING" && (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditingNote(n)} className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-indigo-300">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!(await confirm({ title: "¿Eliminar este albarán?", destructive: true }))) return;
                          await api.deleteDeliveryNote(n.id);
                          load();
                        }}
                        className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {deliveryNotes.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-slate-600">
                  sin albaranes todavía
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <h2 className="mb-4 text-sm font-medium text-slate-300">Facturas</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>número</TableHead>
            <TableHead>total</TableHead>
            <TableHead>estado</TableHead>
            <TableHead className="text-right">acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="font-mono">
                <Link to={`/facturas/${inv.id}`} className="text-indigo-300 transition-colors hover:text-indigo-200">
                  {inv.invoiceNumber ?? "(borrador)"}
                </Link>
              </TableCell>
              <TableCell className="text-slate-400">{inv.total.toFixed(2)} €</TableCell>
              <TableCell>
                <Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs text-indigo-300 transition-colors hover:text-indigo-200">
                  PDF
                </a>
              </TableCell>
            </TableRow>
          ))}
          {invoices.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-slate-600">
                sin facturas todavía
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {editingClient && <ClientFormModal existing={client} onClose={() => setEditingClient(false)} onSaved={load} />}
      {editingNote !== undefined && (
        <DeliveryNoteFormModal clientId={client.id} existing={editingNote} defaultVatRate={21} onClose={() => setEditingNote(undefined)} onSaved={load} />
      )}
      {generatingInvoice && <GenerateInvoiceModal clientId={client.id} onClose={() => setGeneratingInvoice(false)} onSaved={load} />}
      {editingProposal !== undefined && (
        <ProposalFormModal clientId={client.id} existing={editingProposal} onClose={() => setEditingProposal(undefined)} onSaved={load} />
      )}
    </div>
  );
}
