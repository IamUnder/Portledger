import path from "node:path";
import { HOST_HOME } from "../config.js";
import type { ScaffoldSpec, ServiceSpec } from "./types.js";

function containerName(projectName: string, key: string) {
  return `${projectName}-${key}`;
}

function projectPath(projectName: string) {
  return path.join(HOST_HOME, projectName);
}

function servicePath(projectName: string, key: string) {
  return `${projectPath(projectName)}/${key}`;
}

function indentBlock(lines: string[], spaces: number): string {
  const pad = " ".repeat(spaces);
  return lines.map((l) => `${pad}${l}`).join("\n");
}

function envBlock(env: Record<string, string> | undefined, spaces: number): string[] {
  if (!env || Object.keys(env).length === 0) return [];
  return ["environment:", ...Object.entries(env).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)];
}

function dbServiceYaml(projectName: string, svc: ServiceSpec, netName: string): { lines: string[]; volume?: string } {
  const cname = containerName(projectName, svc.key);
  const volumeName = `${svc.key}_data`;
  if (svc.engine === "postgres") {
    return {
      lines: [
        `${svc.key}:`,
        `  image: postgres:15`,
        `  container_name: ${cname}`,
        `  restart: always`,
        `  environment:`,
        `    POSTGRES_DB: ${svc.dbName}`,
        `    POSTGRES_USER: ${svc.dbUser}`,
        `    POSTGRES_PASSWORD: ${svc.dbPassword}`,
        `  volumes:`,
        `    - ${volumeName}:/var/lib/postgresql/data`,
        `  networks:`,
        `    - ${netName}`,
      ],
      volume: volumeName,
    };
  }
  // mysql por defecto
  return {
    lines: [
      `${svc.key}:`,
      `  image: mysql:8`,
      `  container_name: ${cname}`,
      `  restart: always`,
      `  environment:`,
      `    MYSQL_DATABASE: ${svc.dbName}`,
      `    MYSQL_ROOT_PASSWORD: ${svc.dbPassword}`,
      `  volumes:`,
      `    - ${volumeName}:/var/lib/mysql`,
      `  networks:`,
      `    - ${netName}`,
    ],
    volume: volumeName,
  };
}

function gitServiceYaml(
  projectName: string,
  svc: ServiceSpec,
  netName: string,
  dbKeys: string[]
): string[] {
  const cname = containerName(projectName, svc.key);
  const lines = [
    `${svc.key}:`,
    `  build:`,
    `    context: ${servicePath(projectName, svc.key)}`,
    `  container_name: ${cname}`,
    `  restart: always`,
  ];
  if (dbKeys.length) {
    lines.push(`  depends_on:`, ...dbKeys.map((k) => `    - ${k}`));
  }
  const env = envBlock(svc.env, 4);
  if (env.length) lines.push(...env.map((l) => `  ${l}`));
  lines.push(`  networks:`, `    - ${netName}`);
  return lines;
}

function imageServiceYaml(projectName: string, svc: ServiceSpec, netName: string): string[] {
  const cname = containerName(projectName, svc.key);
  const lines = [`${svc.key}:`, `  image: ${svc.image}`, `  container_name: ${cname}`, `  restart: always`];
  const env = envBlock(svc.env, 4);
  if (env.length) lines.push(...env.map((l) => `  ${l}`));
  lines.push(`  networks:`, `    - ${netName}`);
  return lines;
}

export function generateCompose(spec: ScaffoldSpec, includeTunnel: boolean): string {
  const netName = `${spec.name}-net`;
  const dbKeys = spec.services.filter((s) => s.kind === "database").map((s) => s.key);
  const volumes: string[] = [];

  const serviceBlocks = spec.services.map((svc) => {
    if (svc.kind === "database") {
      const { lines, volume } = dbServiceYaml(spec.name, svc, netName);
      if (volume) volumes.push(volume);
      return lines;
    }
    if (svc.kind === "git") return gitServiceYaml(spec.name, svc, netName, dbKeys);
    return imageServiceYaml(spec.name, svc, netName);
  });

  if (includeTunnel) {
    serviceBlocks.push([
      `tunnel:`,
      `  image: cloudflare/cloudflared:latest`,
      `  container_name: ${containerName(spec.name, "tunnel")}`,
      `  restart: always`,
      `  networks:`,
      `    - ${netName}`,
      `  environment:`,
      `    - TUNNEL_TOKEN=\${TUNNEL_TOKEN}`,
      `  command: tunnel run`,
    ]);
  }

  const out: string[] = ["services:"];
  for (const block of serviceBlocks) {
    out.push(indentBlock(block, 2));
    out.push("");
  }

  if (volumes.length) {
    out.push("volumes:");
    for (const v of volumes) out.push(`  ${v}:`);
    out.push("");
  }

  out.push("networks:", `  ${netName}:`);

  return out.join("\n") + "\n";
}
