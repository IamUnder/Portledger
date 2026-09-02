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

export interface ScaffoldSpec {
  name: string; // nombre del proyecto: carpeta bajo HOST_HOME y nombre del compose project
  hostname?: string;
  services: ServiceSpec[];
  cloudflareAccountId?: string; // crea un túnel nuevo en esta cuenta (ignorado si existingTunnelId está presente)
  existingTunnelId?: string; // reutiliza este túnel ya existente en vez de crear uno nuevo
  enableBackups?: boolean;
}
