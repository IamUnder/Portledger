import { useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2, X, Save, Network } from "lucide-react";
import { api, type CloudflareAccount, type IngressRule, type Project, type Tunnel } from "../api";
import { AccountFormModal } from "../components/AccountFormModal";
import { TunnelFormModal } from "../components/TunnelFormModal";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { useConfirm } from "../components/ui/confirm-dialog";

function extractServiceHost(service: string): string | null {
  const match = service.match(/^https?:\/\/([^:/]+)/);
  return match ? match[1] : null;
}

function findMatch(service: string, projects: Project[]): string | null {
  const host = extractServiceHost(service);
  if (!host) return null;
  for (const p of projects) {
    for (const s of p.services) {
      if (s.containerName === host || s.name === host) return `${p.name} / ${s.name}`;
    }
  }
  return null;
}

function TunnelCard({
  tunnel,
  projects,
  hasApiToken,
  onChanged,
}: {
  tunnel: Tunnel;
  projects: Project[];
  hasApiToken: boolean;
  onChanged: () => void;
}) {
  const confirm = useConfirm();
  const [rules, setRules] = useState<IngressRule[]>(tunnel.ingressRules ?? []);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setRules(tunnel.ingressRules ?? []), [tunnel.ingressRules]);

  const sync = async () => {
    setSyncing(true);
    try {
      const fresh = await api.syncTunnel(tunnel.id);
      setRules(fresh);
      onChanged();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  // si no hay nada en caché local pero la cuenta tiene API, puede ser que simplemente no se
  // haya sincronizado nunca en esta sesión — mejor traer el estado real que mostrar "vacío"
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (hasApiToken && (tunnel.ingressRules?.length ?? 0) === 0) sync();
  }, [tunnel.id]);

  const save = async () => {
    setSaving(true);
    try {
      const withoutCatchAll = rules.filter((r) => r.hostname);
      const { rules: fresh, dnsWarnings } = await api.saveIngress(tunnel.id, withoutCatchAll);
      setRules(fresh);
      if (dnsWarnings.length > 0) {
        alert(`Ingress guardado, pero no se pudo crear/verificar el DNS de:\n${dnsWarnings.join("\n")}`);
      }
      onChanged();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // se muestran todas las reglas reales, incluida una recién añadida sin hostname aún; solo se
  // oculta la regla catch-all sintética que añade el backend automáticamente al publicar.
  const editableRules = rules.filter((r) => r.service !== "http_status:404");
  const cellInput = "w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none";

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-200">{tunnel.name}</div>
          <div className="text-xs text-slate-600">
            {tunnel.containerName} · red {tunnel.dockerNetwork}
          </div>
        </div>
        <div className="flex gap-1.5">
          {hasApiToken && (
            <Button size="sm" variant="secondary" onClick={sync} disabled={syncing}>
              <RefreshCw className={syncing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> {syncing ? "…" : "Sincronizar"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={async () => {
              if (!(await confirm({ title: `¿Eliminar el túnel "${tunnel.name}"?`, description: "Esto no borra el túnel en Cloudflare, solo dentro del panel.", destructive: true }))) return;
              await api.deleteTunnel(tunnel.id);
              onChanged();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> eliminar
          </Button>
        </div>
      </div>

      <table className="mb-3 w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800 text-left text-slate-600">
            <th className="pb-1.5 font-medium">hostname</th>
            <th className="pb-1.5 font-medium">servicio</th>
            <th className="pb-1.5 font-medium">relación</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {editableRules.map((rule, i) => {
            const match = findMatch(rule.service, projects);
            return (
              <tr key={i} className="border-b border-slate-800/60">
                <td className="py-1.5 pr-2">
                  <input
                    value={rule.hostname ?? ""}
                    onChange={(e) => setRules((rs) => rs.map((r, j) => (r === rule ? { ...r, hostname: e.target.value } : r)))}
                    className={cellInput}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    value={rule.service}
                    onChange={(e) => setRules((rs) => rs.map((r, j) => (r === rule ? { ...r, service: e.target.value } : r)))}
                    className={cellInput}
                  />
                </td>
                <td className="py-1.5 pr-2 text-slate-500">{match ?? "—"}</td>
                <td className="py-1.5 text-right">
                  <button onClick={() => setRules((rs) => rs.filter((r) => r !== rule))} className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
          {editableRules.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-center text-slate-600">
                sin reglas todavía — sincroniza o añade una
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setRules((rs) => [...rs, { hostname: "", service: "http://" }])}>
          <Plus className="h-3.5 w-3.5" /> añadir regla
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="h-3.5 w-3.5" /> {saving ? "Guardando…" : hasApiToken ? "Guardar y publicar en Cloudflare" : "Guardar (solo documentación)"}
        </Button>
      </div>
    </Card>
  );
}

export function TunnelsPage() {
  const confirm = useConfirm();
  const [accounts, setAccounts] = useState<CloudflareAccount[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [addingAccount, setAddingAccount] = useState(false);
  const [addingTunnelFor, setAddingTunnelFor] = useState<CloudflareAccount | null>(null);

  const load = () => {
    api.cfAccounts().then(setAccounts);
    api.projects().then(setProjects);
  };

  useEffect(load, []);

  const removeAccount = async (account: CloudflareAccount) => {
    if (!(await confirm({ title: `¿Eliminar la cuenta "${account.name}"?`, description: "Se eliminan también todos sus túneles del panel.", destructive: true }))) return;
    await api.deleteCfAccount(account.id);
    load();
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Túneles de Cloudflare</h1>
        <Button size="sm" onClick={() => setAddingAccount(true)}>
          <Plus className="h-4 w-4" /> Añadir cuenta
        </Button>
      </div>
      <p className="mb-6 text-sm text-slate-500">Cada cuenta puede o no tener API token propio — sin él, el túnel solo queda documentado.</p>

      {accounts.length === 0 && (
        <EmptyState
          icon={Network}
          title="Sin cuentas configuradas"
          description="Añade una cuenta de Cloudflare para empezar a gestionar túneles."
          action={
            <Button size="sm" onClick={() => setAddingAccount(true)}>
              <Plus className="h-4 w-4" /> Añadir cuenta
            </Button>
          }
        />
      )}

      {accounts.map((account) => (
        <div key={account.id} className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-medium text-slate-300">{account.name}</h2>
            <Badge variant={account.hasApiToken ? "success" : "neutral"}>{account.hasApiToken ? "API conectada" : "solo documentación"}</Badge>
            <span className="font-mono text-xs text-slate-700">{account.accountId}</span>
            <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setAddingTunnelFor(account)}>
              <Plus className="h-3.5 w-3.5" /> añadir túnel
            </Button>
            <button onClick={() => removeAccount(account)} className="text-xs text-red-400 transition-colors hover:text-red-300">
              eliminar cuenta
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {account.tunnels.map((tunnel) => (
              <TunnelCard key={tunnel.id} tunnel={tunnel} projects={projects} hasApiToken={account.hasApiToken} onChanged={load} />
            ))}
            {account.tunnels.length === 0 && <p className="text-sm text-slate-600">sin túneles todavía en esta cuenta</p>}
          </div>
        </div>
      ))}

      {addingAccount && <AccountFormModal onClose={() => setAddingAccount(false)} onSaved={load} />}
      {addingTunnelFor && (
        <TunnelFormModal accountId={addingTunnelFor.id} hasApiToken={addingTunnelFor.hasApiToken} onClose={() => setAddingTunnelFor(null)} onSaved={load} />
      )}
    </div>
  );
}
