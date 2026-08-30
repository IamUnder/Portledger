import { randomBytes } from "node:crypto";

const BASE = "https://api.cloudflare.com/client/v4";

interface CFResponse<T> {
  success: boolean;
  result: T;
  errors: { code: number; message: string }[];
}

async function cf<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = (await res.json()) as CFResponse<T>;
  if (!body.success) {
    throw new Error(body.errors.map((e) => e.message).join("; ") || `error HTTP ${res.status}`);
  }
  return body.result;
}

export interface RemoteTunnel {
  id: string;
  name: string;
  status: string;
}

export interface IngressRuleData {
  hostname?: string;
  service: string;
}

export function listRemoteTunnels(accountId: string, apiToken: string) {
  return cf<RemoteTunnel[]>(apiToken, `/accounts/${accountId}/cfd_tunnel?is_deleted=false`);
}

export async function getTunnelIngress(
  accountId: string,
  apiToken: string,
  tunnelId: string
): Promise<IngressRuleData[]> {
  const result = await cf<{ config: { ingress?: IngressRuleData[] } }>(
    apiToken,
    `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`
  );
  return result.config?.ingress ?? [];
}

export async function createRemoteTunnel(
  accountId: string,
  apiToken: string,
  name: string
): Promise<{ id: string; name: string }> {
  return cf(apiToken, `/accounts/${accountId}/cfd_tunnel`, {
    method: "POST",
    body: JSON.stringify({
      name,
      config_src: "cloudflare", // remotely-managed: el ingress se administra vía API/dashboard, no un config.yml local
      tunnel_secret: randomBytes(32).toString("base64"),
    }),
  });
}

export function getTunnelToken(accountId: string, apiToken: string, tunnelId: string) {
  return cf<string>(apiToken, `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`);
}

export function putTunnelIngress(
  accountId: string,
  apiToken: string,
  tunnelId: string,
  ingress: IngressRuleData[]
) {
  return cf(apiToken, `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
    method: "PUT",
    body: JSON.stringify({ config: { ingress } }),
  });
}

// heurística simple (últimos dos segmentos): suficiente para dominios .es/.com como los
// que usa esta cuenta; no cubre TLDs compuestos como .co.uk.
function rootDomain(hostname: string): string {
  const parts = hostname.split(".");
  return parts.slice(-2).join(".");
}

async function findZoneId(apiToken: string, hostname: string): Promise<string> {
  const zones = await cf<{ id: string; name: string }[]>(
    apiToken,
    `/zones?name=${encodeURIComponent(rootDomain(hostname))}`
  );
  if (zones.length === 0) throw new Error(`no se encontró la zona de Cloudflare para ${rootDomain(hostname)}`);
  return zones[0].id;
}

// crea o actualiza el CNAME que hace falta para que el hostname resuelva hacia el túnel;
// publicar el ingress por sí solo no basta, Cloudflare necesita este registro para enrutar tráfico ahí.
export async function ensureDnsRecord(apiToken: string, hostname: string, tunnelId: string): Promise<void> {
  const zoneId = await findZoneId(apiToken, hostname);
  const target = `${tunnelId}.cfargotunnel.com`;
  const existing = await cf<{ id: string; content: string }[]>(
    apiToken,
    `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`
  );
  const data = { type: "CNAME", name: hostname, content: target, proxied: true, ttl: 1 };
  if (existing.length > 0) {
    if (existing[0].content === target) return; // ya apunta donde debe, nada que hacer
    await cf(apiToken, `/zones/${zoneId}/dns_records/${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  } else {
    await cf(apiToken, `/zones/${zoneId}/dns_records`, { method: "POST", body: JSON.stringify(data) });
  }
}
