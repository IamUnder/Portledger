import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api, type Client, type DeliveryNote, type Invoice } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";

const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-red-500 focus:outline-none";

export function DeleteClientModal({
  client,
  invoices,
  deliveryNotes,
  onClose,
  onDeleted,
}: {
  client: Client;
  invoices: Invoice[];
  deliveryNotes: DeliveryNote[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmedInvoices = invoices.filter((i) => i.invoiceNumber);
  const draftInvoices = invoices.length - confirmedInvoices.length;
  const matches = typed.trim() === client.name;

  const doDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteClient(client.id);
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={`¿Eliminar "${client.name}"?`}
      description="Esto borra también, sin poder deshacerlo, todas sus propuestas, albaranes, facturas y horas registradas."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={doDelete} disabled={!matches || deleting}>
            {deleting ? "Eliminando…" : "Eliminar cliente"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <ul className="space-y-1 text-xs text-slate-400">
          <li>{client.proposals.length} propuesta(s)</li>
          <li>{deliveryNotes.length} albarán(es)</li>
          <li>
            {invoices.length} factura(s) {invoices.length > 0 && `(${draftInvoices} borrador, ${confirmedInvoices.length} confirmada${confirmedInvoices.length === 1 ? "" : "s"})`}
          </li>
        </ul>

        {confirmedInvoices.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">
                Este cliente tiene {confirmedInvoices.length} factura{confirmedInvoices.length === 1 ? "" : "s"} ya confirmada
                {confirmedInvoices.length === 1 ? "" : "s"} y numerada{confirmedInvoices.length === 1 ? "" : "s"}:{" "}
                <span className="font-mono">{confirmedInvoices.map((i) => i.invoiceNumber).join(", ")}</span>
              </p>
              <p className="mt-1 text-red-400/80">
                Son documentos fiscales — borrarlas deja un hueco en la numeración secuencial, algo que normativamente debería
                anularse con una rectificativa en vez de desaparecer sin más.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Escribe <span className="font-mono text-slate-300">{client.name}</span> para confirmar
          </label>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} autoFocus />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </Modal>
  );
}
