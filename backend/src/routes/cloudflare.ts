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

  // metadatos locales del túnel (nombre, contenedor, red) — no toca nada en Cloudflare, es solo
  // la documentación que Portledger guarda sobre un túnel ya creado.
  app.patch<{ Params: { id: string }; Body: { name?: string; containerName?: string; dockerNetwork?: string } }>(
    "/api/cloudflare/tunnels/:id",
    async (req, reply) => {
      const tunnel = await db.tunnel.findUnique({ where: { id: req.params.id } });
      if (!tunnel) return reply.code(404).send({ error: "túnel no encontrado" });
      const updated = await db.tunnel.update({ where: { id: req.params.id }, data: req.body });
      return maskTunnel(updated);
    }
  );

  // mueve una regla de ingress de un túnel a otro: la quita del origen y la añade al destino,
  // ambas veces recalculando desde el estado REAL en Cloudflare (no la caché local) para no
  // pisar reglas que el otro túnel ya tuviera publicadas — el mismo cuidado que ya tiene el PUT
  // de ingress de abajo, pero mirando a dos túneles en vez de uno.
  app.post<{ Params: { id: string }; Body: { targetTunnelId: string } }>(
    "/api/cloudflare/ingress-rules/:id/move",
    async (req, reply) => {
      const rule = await db.ingressRule.findUnique({
        where: { id: req.params.id },
        include: { tunnel: { include: { account: true } } },
      });
      if (!rule) return reply.code(404).send({ error: "regla no encontrada" });
      if (!rule.hostname) return reply.code(400).send({ error: "la regla catch-all no se puede mover" });
      if (rule.tunnelId === req.body.targetTunnelId) {
        return reply.code(400).send({ error: "la regla ya está en ese túnel" });
      }

      const target = await db.tunnel.findUnique({
        where: { id: req.body.targetTunnelId },
        include: { account: true },
      });
      if (!target) return reply.code(404).send({ error: "túnel destino no encontrado" });

      const source = rule.tunnel;

      if (source.account.apiToken) {
        try {
          const live = await getTunnelIngress(source.account.accountId, source.account.apiToken, source.tunnelId);
          const remaining = live.filter((r) => r.hostname !== rule.hostname);
          if (remaining.length === 0 || remaining.at(-1)?.hostname) remaining.push({ service: "http_status:404" });
          await putTunnelIngress(source.account.accountId, source.account.apiToken, source.tunnelId, remaining);
        } catch (err) {
          return reply.code(502).send({ error: `no se pudo quitar la regla del túnel origen: ${(err as Error).message}` });
        }
      }

      let dnsWarning: string | null = null;
      if (target.account.apiToken) {
        try {
          const live = await getTunnelIngress(target.account.accountId, target.account.apiToken, target.tunnelId);
          const rules = [...live.filter((r) => r.hostname), { hostname: rule.hostname, service: rule.service }, { service: "http_status:404" }];
          await putTunnelIngress(target.account.accountId, target.account.apiToken, target.tunnelId, rules);
          try {
            await ensureDnsRecord(target.account.apiToken, rule.hostname, target.tunnelId);
          } catch (err) {
            dnsWarning = (err as Error).message;
          }
        } catch (err) {
          return reply.code(502).send({
            error: `se quitó del túnel origen pero falló al añadirla al destino — revísalo a mano: ${(err as Error).message}`,
          });
        }
      }

      const maxPosition = await db.ingressRule.aggregate({
        where: { tunnelId: target.id, hostname: { not: null } },
        _max: { position: true },
      });
      const updated = await db.ingressRule.update({
        where: { id: rule.id },
        data: { tunnelId: target.id, position: (maxPosition._max.position ?? -1) + 1 },
      });

      if (dnsWarning) {
        await notify({
          type: "DNS_WARNING",
          title: `Aviso DNS al mover "${rule.hostname}" a "${target.name}"`,
          message: dnsWarning,
          link: "/tuneles",
        });
      }

      return { rule: updated, dnsWarning };
    }
  );

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
