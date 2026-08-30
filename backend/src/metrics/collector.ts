import os from "node:os";
import fs from "node:fs/promises";
import { db } from "../db.js";
import { runCommand } from "../exec.js";
import { HOST_HOME } from "../config.js";

const DISK_PROBE_PATH = HOST_HOME; // bind-mount compartido con el host: refleja su disco real

// os.cpus() devuelve tiempos ACUMULADOS desde el arranque; el % de uso real sale
// de comparar dos lecturas separadas en el tiempo, no de una lectura suelta.
let lastCpuSample: { idle: number; total: number } | null = null;

function sampleCpuTimes() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += Object.values(cpu.times).reduce((a, b) => a + b, 0);
  }
  return { idle, total };
}

function cpuPercentSinceLast(): number {
  const current = sampleCpuTimes();
  if (!lastCpuSample) {
    lastCpuSample = current;
    return 0;
  }
  const idleDelta = current.idle - lastCpuSample.idle;
  const totalDelta = current.total - lastCpuSample.total;
  lastCpuSample = current;
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, 100 * (1 - idleDelta / totalDelta)));
}

async function readMemory(): Promise<{ usedMB: number; totalMB: number }> {
  const raw = await fs.readFile("/proc/meminfo", "utf-8");
  const get = (key: string) => {
    const match = raw.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
    return match ? Number(match[1]) / 1024 : 0; // kB -> MB
  };
  const totalMB = get("MemTotal");
  const availableMB = get("MemAvailable");
  return { usedMB: Math.round(totalMB - availableMB), totalMB: Math.round(totalMB) };
}

async function readDisk(): Promise<{ usedGB: number; totalGB: number }> {
  const { output } = await runCommand("df", ["-B1", "--output=size,used", DISK_PROBE_PATH]);
  const line = output.trim().split("\n").at(-1)?.trim().split(/\s+/) ?? [];
  const [sizeBytes, usedBytes] = line.map(Number);
  return { totalGB: (sizeBytes ?? 0) / 1e9, usedGB: (usedBytes ?? 0) / 1e9 };
}

export async function readCurrentMetrics() {
  const [mem, disk] = await Promise.all([readMemory(), readDisk()]);
  return {
    cpuPercent: cpuPercentSinceLast(),
    memUsedMB: mem.usedMB,
    memTotalMB: mem.totalMB,
    diskUsedGB: Number(disk.usedGB.toFixed(1)),
    diskTotalGB: Number(disk.totalGB.toFixed(1)),
    loadAvg1: os.loadavg()[0],
    uptimeSeconds: os.uptime(),
    cpuCount: os.cpus().length,
  };
}

export async function collectSample() {
  // primera lectura de CPU tras un arranque no tiene referencia previa con la que calcular
  // un delta real, así que se descarta esa muestra en vez de guardar un falso 0%.
  const isFirstSample = lastCpuSample === null;
  const metrics = await readCurrentMetrics();
  if (isFirstSample) return;

  await db.metricSample.create({
    data: {
      cpuPercent: metrics.cpuPercent,
      memUsedMB: metrics.memUsedMB,
      memTotalMB: metrics.memTotalMB,
      diskUsedGB: metrics.diskUsedGB,
      diskTotalGB: metrics.diskTotalGB,
      loadAvg1: metrics.loadAvg1,
    },
  });

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await db.metricSample.deleteMany({ where: { timestamp: { lt: cutoff } } });
}

export function startMetricsCollection() {
  collectSample().catch((err) => console.error("[metrics] fallo en la muestra inicial:", err));
  setInterval(() => {
    collectSample().catch((err) => console.error("[metrics] fallo recolectando:", err));
  }, 60_000);
}
