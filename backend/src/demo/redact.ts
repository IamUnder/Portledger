import { db } from "../db.js";

export async function isDemoMode(): Promise<boolean> {
  const settings = await db.companySettings.findUnique({ where: { id: "singleton" } });
  return settings?.demoMode ?? false;
}

// hash determinista y estable: el mismo id (o el mismo texto) siempre da el mismo número,
// así un cliente concreto sale con el mismo nombre de mentira en todas las páginas/peticiones.
function pseudoIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 1000;
}

const businessName = (seed: string) => `Empresa Demo ${pseudoIndex(seed)}`;
const personName = (seed: string) => `Contacto Demo ${pseudoIndex(seed)}`;
const emailFor = (seed: string) => `demo${pseudoIndex(seed)}@example.com`;
const domainFor = (seed: string) => `demo-${pseudoIndex(seed)}.example.com`;
const projectName = (seed: string) => `proyecto-demo-${pseudoIndex(seed)}`;

// Recorre cualquier respuesta JSON y sustituye los campos identificativos reales por valores
// de mentira, reconociendo la "forma" del objeto (qué claves trae) en vez de una lista ciega de
// nombres de campo — así "name"/"title" de cosas no sensibles (proyectos internos aparte,
// tareas, automatizaciones...) no se tocan por accidente, solo lo que de verdad identifica a un
// cliente real, tu propia empresa, o un dominio real.
export function redactForDemo(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForDemo);
  if (!value || typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id : "";
  const isClientLike = "taxId" in obj; // Client o CompanySettings
  const isProjectLike = "composeFile" in obj;
  const isSearchResult = "type" in obj && "label" in obj && "link" in obj;
  const isClientRevenueRow = "clientName" in obj && ("paidTotal" in obj || "pendingTotal" in obj);
  const isUserLike = "role" in obj && typeof obj.email === "string";

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (isClientLike) {
      if ((key === "name" || key === "businessName") && val) {
        out[key] = businessName(id || key);
        continue;
      }
      if (key === "contactName" && val) {
        out[key] = personName(id + "c");
        continue;
      }
      if (key === "email" && val) {
        out[key] = emailFor(id || String(val));
        continue;
      }
      if (key === "phone" && val) {
        out[key] = "600000000";
        continue;
      }
      if (key === "taxId" && val) {
        out[key] = "B00000000";
        continue;
      }
      if ((key === "address" || key === "bankAccount") && val) {
        out[key] = "—";
        continue;
      }
      if ((key === "city" || key === "province") && val) {
        out[key] = "Demo";
        continue;
      }
      if (key === "postalCode" && val) {
        out[key] = "00000";
        continue;
      }
      if (key === "notes" && val) {
        out[key] = "";
        continue;
      }
    }
    if (isProjectLike) {
      if (key === "name" && val) {
        out[key] = projectName(id || key);
        continue;
      }
      if (key === "hostname" && val) {
        out[key] = domainFor(id || String(val));
        continue;
      }
    }
    if (isSearchResult && (obj.type === "client" || obj.type === "project")) {
      if (key === "label" && val) {
        out[key] = obj.type === "client" ? businessName(id) : projectName(id);
        continue;
      }
      if (key === "sublabel" && val) {
        out[key] = "";
        continue;
      }
    }
    if (isClientRevenueRow && key === "clientName" && typeof val === "string") {
      out[key] = businessName(val);
      continue;
    }
    if (isUserLike && key === "email" && val) {
      out[key] = emailFor(id || String(val));
      continue;
    }
    if (key === "accessEmail" && typeof val === "string" && val) {
      out[key] = emailFor(val);
      continue;
    }

    out[key] = redactForDemo(val);
  }
  return out;
}
