import type { FastifyInstance } from "fastify";
import { db } from "../db.js";

interface SearchResult {
  type: "client" | "project" | "invoice" | "task" | "proposal";
  id: string;
  label: string;
  sublabel?: string;
  link: string;
}

// SQLite no soporta "contains" case-insensitive en Prisma (a diferencia de Postgres/MySQL), así
// que se filtra en memoria en minúsculas. El volumen esperado (herramienta personal/pequeño
// equipo) hace esto perfectamente razonable sin necesitar SQL crudo.
function matches(q: string, ...fields: (string | null | undefined)[]): boolean {
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export async function searchRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string } }>("/api/search", async (req) => {
    const raw = req.query.q?.trim();
    if (!raw || raw.length < 2) return [];
    const q = raw.toLowerCase();

    const [clients, projects, invoices, tasks, proposals] = await Promise.all([
      db.client.findMany(),
      db.project.findMany(),
      db.invoice.findMany({ include: { client: true } }),
      db.task.findMany(),
      db.proposal.findMany({ include: { client: true } }),
    ]);

    const results: SearchResult[] = [
      ...clients
        .filter((c) => matches(q, c.name, c.contactName, c.email))
        .slice(0, 5)
        .map((c) => ({ type: "client" as const, id: c.id, label: c.name, sublabel: c.contactName ?? undefined, link: `/clientes/${c.id}` })),
      ...projects
        .filter((p) => matches(q, p.name, p.hostname))
        .slice(0, 5)
        .map((p) => ({ type: "project" as const, id: p.id, label: p.name, sublabel: p.hostname ?? undefined, link: `/projects/${p.id}` })),
      ...invoices
        .filter((i) => matches(q, i.invoiceNumber))
        .slice(0, 5)
        .map((i) => ({
          type: "invoice" as const,
          id: i.id,
          label: i.invoiceNumber ?? "(borrador)",
          sublabel: i.client.name,
          link: `/facturas/${i.id}`,
        })),
      ...tasks
        .filter((t) => matches(q, t.title))
        .slice(0, 5)
        .map((t) => ({ type: "task" as const, id: t.id, label: t.title, sublabel: "tarea", link: `/tareas` })),
      ...proposals
        .filter((p) => matches(q, p.title))
        .slice(0, 5)
        .map((p) => ({
          type: "proposal" as const,
          id: p.id,
          label: p.title,
          sublabel: p.client.name,
          link: `/clientes/${p.clientId}`,
        })),
    ];

    return results;
  });
}
