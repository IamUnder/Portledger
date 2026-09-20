import path from "node:path";

// Carpeta home del host, montada dentro del contenedor en la misma ruta (bind-mount espejo).
// Todo lo que necesita tocar el filesystem del host (repos de proyectos, backups, rclone/restic)
// cuelga de aquí, para que la app funcione en cualquier servidor sin tocar código.
export const HOST_HOME = process.env.HOST_HOME || "/home/under";

// Carpeta donde vive este propio panel dentro del host (por defecto, junto al resto de proyectos).
export const PANEL_HOST_DIR = process.env.PANEL_HOST_DIR || path.join(HOST_HOME, "panel");

export const RESTIC_BIN = process.env.RESTIC_BIN || path.join(HOST_HOME, ".local/bin/restic");
export const RCLONE_BIN = process.env.RCLONE_BIN || path.join(HOST_HOME, ".local/bin/rclone");
export const RCLONE_CONFIG_PATH = process.env.RCLONE_CONFIG_PATH || path.join(HOST_HOME, ".config/rclone/rclone.conf");
export const RESTIC_PASSPHRASE_FILE =
  process.env.RESTIC_PASSPHRASE_FILE || path.join(HOST_HOME, "infra/backups/restic-passphrase.txt");

// git usa credential.helper=store (ver ~/.gitconfig del host) para no pedir el token en cada
// operación — pero ese helper REESCRIBE este fichero después de cualquier fetch/pull/clone que
// autentique con éxito, no solo la primera vez (así confirma que el credential sigue siendo
// válido). Si esa operación corre como root (deploys, scaffolding de proyectos nuevos), el
// fichero se queda con dueño root en el host, y entonces ni el usuario real ni git desde su
// propia shell pueden volver a leerlo. Ver gitCredentials.ts.
export const GIT_CREDENTIALS_PATH = process.env.GIT_CREDENTIALS_PATH || path.join(HOST_HOME, ".git-credentials");

// URL pública desde la que se sirve el panel (para enlaces en emails y propuestas publicadas).
// Vacío = no se generan enlaces absolutos (los emails simplemente los omiten).
export const PANEL_BASE_URL = process.env.PANEL_BASE_URL || "";

// git corre como root dentro del contenedor (necesario para que HOME=HOST_HOME comparta
// credenciales con el usuario del host); cualquier fichero que toque en un checkout/pull queda
// en el host con dueño root. Se usa para devolver esos ficheros al usuario real tras cada deploy.
export const HOST_UID = process.env.HOST_UID || "1000";
export const HOST_GID = process.env.HOST_GID || "1000";

// clave de solo-escritura para /api/public/leads (ver routes/publicLeads.ts) — la usan sitios
// estáticos externos (ej. la landing de KaizoGroup) desde JS de cliente, así que va embebida en
// su bundle público a propósito; no da acceso a nada más de la API, solo a crear leads.
export const PUBLIC_LEADS_API_KEY = process.env.PUBLIC_LEADS_API_KEY || "";
