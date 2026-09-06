export type ServiceKind = "git" | "database" | "image";
export type DbEngine = "mysql" | "postgres";

export interface ServiceSpec {
  key: string; // nombre del servicio en el compose (ej. "backend")
  kind: ServiceKind;
  isPublic?: boolean; // si es el servicio al que apunta la regla de ingress del túnel

  // kind: git
  repoUrl?: string;
  branch?: string;

  // kind: database
  engine?: DbEngine;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;

  // kind: image
  image?: string;

  // comunes
  port?: number; // puerto interno del contenedor (para el ingress del túnel)
  env?: Record<string, string>;
}

// "Traer tu propio compose": clona un repo entero (no uno por servicio) y usa el
// docker-compose.yml que ya trae, en vez de generar uno con generateCompose(). Para proyectos
// demasiado específicos para el generador (varios Dockerfiles en un monorepo, contenedores de
// migración encadenados, anclas YAML...). Cuando se usa, `services` en ScaffoldSpec se ignora —
// los servicios a rastrear se añaden después a mano, uno a uno, como en cualquier proyecto
// importado.
export interface ComposeSource {
  repoUrl: string;
  branch?: string;
  composePath?: string; // ruta relativa dentro del repo al docker-compose.yml (default: "docker-compose.yml")
  publicServiceKey?: string; // nombre del servicio (ya existente en ESE compose) al que apunta el ingress
  publicServicePort?: number; // puerto interno de ese servicio (default 80)
  envContent?: string; // contenido literal a escribir como .env en el repo clonado, ANTES de levantarlo
}

export interface ScaffoldSpec {
  name: string; // nombre del proyecto: carpeta bajo HOST_HOME y nombre del compose project
  hostname?: string;
  services: ServiceSpec[]; // ignorado si composeSource está presente
  composeSource?: ComposeSource;
  cloudflareAccountId?: string; // crea un túnel nuevo en esta cuenta (ignorado si existingTunnelId está presente)
  existingTunnelId?: string; // reutiliza este túnel ya existente en vez de crear uno nuevo
  enableBackups?: boolean;
}
