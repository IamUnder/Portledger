import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Users, FileText } from "lucide-react";
import { api, type Client } from "../api";
import { ClientFormModal } from "../components/ClientFormModal";
import { useMe } from "../MeContext";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { SkeletonCard } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

const STATUS_VARIANT: Record<string, "warning" | "success" | "neutral"> = {
  LEAD: "warning",
  ACTIVE: "success",
  INACTIVE: "neutral",
};

const STATUS_LABEL: Record<string, string> = { LEAD: "lead", ACTIVE: "activo", INACTIVE: "inactivo" };

export function ClientsPage() {
  const me = useMe();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [adding, setAdding] = useState(false);

  const load = () => {
    api.clients().then(setClients);
  };
  useEffect(load, []);

  const active = clients?.filter((c) => c.status === "ACTIVE").length ?? 0;
  const leads = clients?.filter((c) => c.status === "LEAD").length ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Clientes</h1>
        {me.role === "ADMIN" && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Nuevo cliente
          </Button>
        )}
      </div>

      {clients && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{clients.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Activos</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-400">{active}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Leads</div>
            <div className="mt-1 text-2xl font-semibold text-amber-400">{leads}</div>
          </Card>
        </div>
      )}

      {!clients && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {clients?.length === 0 && (
        <EmptyState
          icon={Users}
          title="Sin clientes todavía"
          description="Da de alta tu primer cliente para empezar a llevar propuestas, albaranes y facturas."
          action={
            me.role === "ADMIN" ? (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Nuevo cliente
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients?.map((c) => (
          <Link key={c.id} to={`/clientes/${c.id}`} className="card-glow rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition-all duration-200">
            <div className="mb-2 flex items-start justify-between">
              <div className="text-base font-medium text-slate-100">{c.name}</div>
              <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
            </div>
            {c.contactName && <div className="text-xs text-slate-500">{c.contactName}</div>}
            <div className="mt-3 flex items-center gap-1 text-xs text-slate-600">
              <FileText className="h-3 w-3" /> {c.proposals.length} propuesta(s)
            </div>
          </Link>
        ))}
      </div>

      {adding && <ClientFormModal existing={null} onClose={() => setAdding(false)} onSaved={load} />}
    </div>
  );
}
