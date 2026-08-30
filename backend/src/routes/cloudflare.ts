import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import {
  listRemoteTunnels,
  getTunnelIngress,
  putTunnelIngress,
  createRemoteTunnel,
  getTunnelToken,
  ensureDnsRecord,
  type IngressRuleData,
} from "../cloudflare/api.js";
import { notify } from "../notifications/service.js";

function maskTunnel<T extends { tunnelToken: string }>(tunnel: T) {
  return { ...tunnel, tunnelToken: "••••••••" };
}

export async function cloudflareRoutes(app: FastifyInstance) {
  app.get("/api/cloudflare/accounts", async () => {
    const accounts = await db.cloudflareAccount.findMany({
      include: { tunnels: { include: { ingressRules: { orderBy: { position: "asc" } } } } },
    });
    return accounts.map((a) => ({
      ...a,
      apiToken: a.apiToken ? "••••••••" : null,
      hasApiToken: !!a.apiToken,
      tunnels: a.tunnels.map(maskTunnel),
    }));
  });

  app.post<{ Body: { name: string; accountId: string; apiToken?: string } }>(
    "/api/cloudflare/accounts",
    async (req) => {
      return db.cloudflareAccount.create({ data: req.body });
    }
  );

  app.delete<{ Params: { id: string } }>("/api/cloudflare/accounts/:id", async (req) => {
    await db.tunnel.deleteMany({ where: { cloudflareAccountId: req.params.id } });
    await db.cloudflareAccount.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/api/cloudflare/accounts/:id/remote-tunnels", async (req, reply) => {
    const account = await db.cloudflareAccount.findUnique({ where: { id: req.params.id } });
    if (!account?.apiToken) return reply.code(400).send({ error: "esta cuenta no tiene API token" });
    try {
      return await listRemoteTunnels(account.accountId, account.apiToken);
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });

  app.post<{
    Params: { id: string };
    Body: { name: string; containerName: string; dockerNetwork: string };
  }>("/api/cloudflare/accounts/:id/create-tunnel", async (req, reply) => {
    const account = await db.cloudflareAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return reply.code(404).send({ error: "cuenta no encontrada" });
    if (!account.apiToken) return reply.code(400).send({ error: "esta cuenta no tiene API token" });

    try {
      const { name, containerName, dockerNetwork } = req.body;
      const remote = await createRemoteTunnel(account.accountId, account.apiToken, name);
      const token = await getTunnelToken(account.accountId, account.apiToken, remote.id);
      const tunnel = await db.tunnel.create({
        data: {
          cloudflareAccountId: account.id,
          name,
          tunnelId: remote.id,
          tunnelToken: token,
          containerName,
          dockerNetwork,
        },
      });
      // única vez que se devuelve el token en claro: el usuario lo necesita para
      // pegarlo en el docker-compose.yml del proyecto; luego siempre viaja enmascarado
      return tunnel;
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });

  app.get("/api/cloudflare/tunnels", async () => {
    const tunnels = await db.tunnel.findMany({
      include: { account: true, ingressRules: { orderBy: { position: "asc" } } },
    });
    return tunnels.map(maskTunnel);
  });

  app.post<{
    Body: {
      cloudflareAccountId: string;
      name: string;
      tunnelId: string;
      tunnelToken: string;
      containerName: string;
      dockerNetwork: string;
    };
  }>("/api/cloudflare/tunnels", async (req) => {
    const tunnel = await db.tunnel.create({ data: req.body });
    return maskTunnel(tunnel);
  });

  app.delete<{ Params: { id: string } }>("/api/cloudflare/tunnels/:id", async (req) => {
    await db.ingressRule.deleteMany({ where: { tunnelId: req.params.id } });
    await db.tunnel.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/cloudflare/tunnels/:id/sync", async (req, reply) => {
    const tunnel = await db.tunnel.findUnique({ where: { id: req.params.id }, include: { account: true } });
    if (!tunnel) return reply.code(404).send({ error: "túnel no encontrado" });
    if (!tunnel.account.apiToken) return reply.code(400).send({ error: "la cuenta no tiene API token" });

    try {
      const ingress = await getTunnelIngress(tunnel.account.accountId, tunnel.account.apiToken, tunnel.tunnelId);
      await db.ingressRule.deleteMany({ where: { tunnelId: tunnel.id } });
      await db.ingressRule.createMany({
        data: ingress.map((rule, i) => ({
          tunnelId: tunnel.id,
          position: i,
          hostname: rule.hostname ?? null,
          service: rule.service,
        })),
      });
      return db.ingressRule.findMany({ where: { tunnelId: tunnel.id }, orderBy: { position: "asc" } });
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });

  app.put<{ Params: { id: string }; Body: { rules: IngressRuleData[] } }>(
    "/api/cloudflare/tunnels/:id/ingress",
    async (req, reply) => {
      const tunnel = await db.tunnel.findUnique({ where: { id: req.params.id }, include: { account: true } });
      if (!tunnel) return reply.code(404).send({ error: "túnel no encontrado" });

      // salvaguarda: si se intenta guardar el ingress vacío, comprobamos contra CLOUDFLARE
      // (no la caché local, que puede estar desactualizada) si ya hay reglas reales publicadas.
      // Guardar vacío sobre un túnel con enrutado real en producción sería borrarlo por error.
      if (req.body.rules.length === 0 && tunnel.account.apiToken) {
        try {
          const live = await getTunnelIngress(tunnel.account.accountId, tunnel.account.apiToken, tunnel.tunnelId);
          if (live.some((r) => r.hostname)) {
            return reply.code(400).send({
              error: "el túnel ya tiene reglas reales en Cloudflare — sincroniza antes de vaciar el ingress si es intencional",
            });
          }
        } catch {
          // si no se puede comprobar, seguimos con la salvaguarda más simple de abajo
        }
      }

      // Cloudflare exige que la última regla sea un catch-all sin hostname; se añade si falta.
      const rules = [...req.body.rules];
      if (rules.length === 0 || rules.at(-1)?.hostname) {
        rules.push({ service: "http_status:404" });
      }

      // sin API token la cuenta solo se documenta aquí: se guarda local, no se publica en Cloudflare
      const dnsWarnings: string[] = [];
      if (tunnel.account.apiToken) {
        try {
          await putTunnelIngress(tunnel.account.accountId, tunnel.account.apiToken, tunnel.tunnelId, rules);
        } catch (err) {
          return reply.code(502).send({ error: (err as Error).message });
        }

        // publicar el ingress no basta: sin el CNAME apuntando al túnel, el hostname no resuelve.
        // esto es best-effort — si el token no tiene permiso de Zone:DNS:Edit, se avisa sin bloquear.
        for (const rule of rules) {
          if (!rule.hostname) continue;
          try {
            await ensureDnsRecord(tunnel.account.apiToken, rule.hostname, tunnel.tunnelId);
          } catch (err) {
            dnsWarnings.push(`${rule.hostname}: ${(err as Error).message}`);
          }
        }
      }

      await db.ingressRule.deleteMany({ where: { tunnelId: tunnel.id } });
      await db.ingressRule.createMany({
        data: rules.map((rule, i) => ({
          tunnelId: tunnel.id,
          position: i,
          hostname: rule.hostname ?? null,
          service: rule.service,
        })),
      });
      const saved = await db.ingressRule.findMany({ where: { tunnelId: tunnel.id }, orderBy: { position: "asc" } });

      if (dnsWarnings.length > 0) {
        await notify({
          type: "DNS_WARNING",
          title: `Aviso DNS en túnel "${tunnel.name}"`,
          message: dnsWarnings.join(" · "),
          link: "/tuneles",
        });
      }

      return { rules: saved, dnsWarnings };
    }
  );
}
