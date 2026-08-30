import { useState } from "react";
import { api } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

export function TunnelFormModal({
  accountId,
  hasApiToken,
  onClose,
  onSaved,
}: {
  accountId: string;
  hasApiToken: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"create" | "register">(hasApiToken ? "create" : "register");
  const [name, setName] = useState("");
  const [containerName, setContainerName] = useState("");
  const [dockerNetwork, setDockerNetwork] = useState("");
  const [tunnelId, setTunnelId] = useState("");
  const [tunnelToken, setTunnelToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim() || !containerName.trim() || !dockerNetwork.trim()) {
      return setError("nombre, contenedor y red son obligatorios");
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        const tunnel = await api.createTunnelViaApi(accountId, name.trim(), containerName.trim(), dockerNetwork.trim());
        setCreatedToken(tunnel.tunnelToken);
        onSaved();
      } else {
        if (!tunnelId.trim() || !tunnelToken.trim()) {
          setError("tunnel id y token son obligatorios para registrar uno existente");
          setSaving(false);
          return;
        }
        await api.createTunnel({
          cloudflareAccountId: accountId,
          name: name.trim(),
          tunnelId: tunnelId.trim(),
          tunnelToken: tunnelToken.trim(),
          containerName: containerName.trim(),
          dockerNetwork: dockerNetwork.trim(),
        });
        onSaved();
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  if (createdToken) {
    return (
      <Modal onClose={onClose} title={<span className="text-emerald-400">Túnel creado en Cloudflare</span>} footer={<Button className="w-full" onClick={onClose}>Ya lo copié, cerrar</Button>}>
        <p className="mb-3 text-xs text-slate-400">
          Copia este token ahora — no se volverá a mostrar completo. Pégalo como <code className="text-slate-300">TUNNEL_TOKEN</code> en el{" "}
          <code className="text-slate-300">docker-compose.yml</code> del proyecto que vaya a usar este túnel, con un servicio{" "}
          <code className="text-slate-300">cloudflared</code> en la red <code className="text-slate-300">{dockerNetwork}</code>.
        </p>
        <textarea
          readOnly
          value={createdToken}
          className="h-24 w-full resize-none rounded-md border border-slate-700 bg-black p-2 font-mono text-xs text-emerald-400"
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
      </Modal>
    );
  }

  return (
    <Modal
      onClose={onClose}
      title="Añadir túnel"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : mode === "create" ? "Crear en Cloudflare" : "Registrar"}
          </Button>
        </>
      }
    >
      {hasApiToken && (
        <div className="mb-3 flex gap-1 rounded-md bg-slate-800 p-1 text-xs">
          <button onClick={() => setMode("create")} className={cn("flex-1 rounded px-2 py-1 transition-colors", mode === "create" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200")}>
            Crear nuevo
          </button>
          <button onClick={() => setMode("register")} className={cn("flex-1 rounded px-2 py-1 transition-colors", mode === "register" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200")}>
            Registrar existente
          </button>
        </div>
      )}

      <label className="mb-1 block text-xs font-medium text-slate-400">Nombre</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. cliente-xyz-tunnel" className={cn(inputClass, "mb-3")} autoFocus />

      {mode === "register" && (
        <>
          <label className="mb-1 block text-xs font-medium text-slate-400">Tunnel ID (UUID de Cloudflare)</label>
          <input value={tunnelId} onChange={(e) => setTunnelId(e.target.value)} className={cn(inputClass, "mb-3 font-mono text-xs")} />
          <label className="mb-1 block text-xs font-medium text-slate-400">Tunnel Token</label>
          <textarea value={tunnelToken} onChange={(e) => setTunnelToken(e.target.value)} className={cn(inputClass, "mb-3 h-20 resize-none font-mono text-xs")} />
        </>
      )}

      <label className="mb-1 block text-xs font-medium text-slate-400">Contenedor del conector</label>
      <input value={containerName} onChange={(e) => setContainerName(e.target.value)} placeholder="ej. cliente-xyz-tunnel" className={cn(inputClass, "mb-3")} />

      <label className="mb-1 block text-xs font-medium text-slate-400">Red docker</label>
      <input value={dockerNetwork} onChange={(e) => setDockerNetwork(e.target.value)} placeholder="ej. cliente-xyz-net" className={inputClass} />

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
