// Ofuscación de pantalla: puramente del navegador, nunca toca el servidor. Vive en
// sessionStorage (por eso ya es por pestaña/navegador, sin que haga falta nada especial para
// que "solo afecte a quien lo marcó") y se limpia explícitamente en cada login real (ver
// Login.tsx) para que nunca quede encendida sin querer en la siguiente sesión.
const STORAGE_KEY = "portledger:obfuscate";

export function isObfuscateOn(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

// recarga la página a propósito: así todo lo que ya estaba en pantalla se vuelve a pedir y sale
// ya ofuscado (o real), en vez de dejar una mezcla de datos antiguos y nuevos.
export function setObfuscate(on: boolean) {
  try {
    if (on) sessionStorage.setItem(STORAGE_KEY, "1");
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage no disponible (privado a rajatabla, etc.) — no hay nada que hacer
  }
  window.location.reload();
}

export function resetObfuscateOnLogin() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada que limpiar si no hay sessionStorage
  }
}

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

// Mismo recorrido "por forma del objeto" que se probó en el backend: reconoce Client/
// CompanySettings por su campo taxId, Project por composeFile, etc. — así solo se ofuscan datos
// identificativos reales, no textos internos (tareas, notificaciones, nombres de servicios...).
// Las facturas se dejan tal cual a propósito: eso lo controla el usuario a mano.
export function obfuscateValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(obfuscateValue);
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

    out[key] = obfuscateValue(val);
  }
  return out;
}
