import fs from "node:fs/promises";
import path from "node:path";
import { runCommand } from "../exec.js";
import { db } from "../db.js";
import { PANEL_HOST_DIR } from "../config.js";

const SERVED_ROOT = path.join(PANEL_HOST_DIR, "proposals");

export const RESERVED_SLUGS = new Set([
  "api",
  "assets",
  "backups",
  "tuneles",
  "servidor",
  "usuarios",
  "clientes",
  "facturas",
  "proyectos",
  "projects",
  "health",
  "automatizaciones",
  "databases",
  "tareas",
  "horas",
  "auditoria",
  "informes",
  "gastos",
]);

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

export async function publishProposal(proposalId: string): Promise<void> {
  const proposal = await db.proposal.findUniqueOrThrow({ where: { id: proposalId } });
  if (!proposal.publicSlug) throw new Error("la propuesta no tiene slug asignado");
  if (!proposal.sourceType || !proposal.sourcePath) throw new Error("falta configurar el origen del contenido");

  const dest = `${SERVED_ROOT}/${proposal.publicSlug}`;
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(SERVED_ROOT, { recursive: true });

  if (proposal.sourceType === "GITHUB") {
    const args = ["clone", "--depth", "1"];
    if (proposal.sourceBranch) args.push("-b", proposal.sourceBranch);
    args.push(proposal.sourcePath, dest);
    const { code, output } = await runCommand("git", args);
    if (code !== 0) throw new Error(`git clone falló: ${output}`);
  } else {
    const { code, output } = await runCommand("cp", ["-r", proposal.sourcePath, dest]);
    if (code !== 0) throw new Error(`no se pudo copiar la carpeta: ${output}`);
  }

  await db.proposal.update({ where: { id: proposalId }, data: { servedAt: new Date() } });
}
