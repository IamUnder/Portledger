import { db } from "../db.js";

const TIMEOUT_MS = 30_000;
const MAX_RESPONSE_LOG = 2000;

function parseHeaders(raw: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!raw) return headers;
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return headers;
}

export async function runCronJob(cronJobId: string, trigger: "scheduled" | "manual"): Promise<string> {
  const job = await db.cronJob.findUniqueOrThrow({ where: { id: cronJobId } });
  const run = await db.cronJobRun.create({ data: { cronJobId, status: "running", trigger } });

  (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(job.url, {
        method: job.method,
        headers: parseHeaders(job.headers),
        body: job.method === "GET" ? undefined : job.body ?? undefined,
        signal: controller.signal,
      });
      const text = (await res.text()).slice(0, MAX_RESPONSE_LOG);
      await db.cronJobRun.update({
        where: { id: run.id },
        data: {
          status: res.ok ? "success" : "failed",
          httpStatus: res.status,
          response: text,
          finishedAt: new Date(),
        },
      });
    } catch (err) {
      await db.cronJobRun.update({
        where: { id: run.id },
        data: { status: "failed", response: (err as Error).message, finishedAt: new Date() },
      });
    } finally {
      clearTimeout(timeout);
    }
  })().catch((err) => console.error(`cron job ${cronJobId} crashed:`, err));

  return run.id;
}
