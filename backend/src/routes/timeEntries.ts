import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { requireRole } from "../auth.js";

const INCLUDE = {
  user: { select: { id: true, email: true } },
  client: true,
  project: true,
  task: true,
  deliveryNote: true,
};

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

interface ManualEntryInput {
  description: string;
  date: string;
  minutes: number;
  clientId?: string;
  projectId?: string;
  taskId?: string;
  billable?: boolean;
  hourlyRate?: number;
}

interface StartEntryInput {
  description: string;
  clientId?: string;
  projectId?: string;
  taskId?: string;
  billable?: boolean;
  hourlyRate?: number;
}

async function resolveHourlyRate(clientId: string | undefined, explicit: number | undefined) {
  if (explicit !== undefined) return explicit;
  if (!clientId) return undefined;
  const client = await db.client.findUnique({ where: { id: clientId } });
  return client?.defaultHourlyRate ?? undefined;
}

export async function timeEntryRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { userId?: string; clientId?: string; projectId?: string; from?: string; to?: string } }>(
    "/api/time-entries",
    async (req) => {
      const { userId, clientId, projectId, from, to } = req.query;
      // un colaborador solo ve sus propios registros; un admin puede filtrar por cualquiera
      const effectiveUserId = req.user!.role === "ADMIN" ? userId : req.user!.id;
      return db.timeEntry.findMany({
        where: {
          userId: effectiveUserId,
          clientId,
          projectId,
          startedAt: {
            gte: from ? new Date(from) : undefined,
            lte: to ? new Date(to) : undefined,
          },
        },
        include: INCLUDE,
        orderBy: { startedAt: "desc" },
      });
    }
  );

  app.get("/api/time-entries/running", async (req) => {
    return db.timeEntry.findFirst({
      where: { userId: req.user!.id, endedAt: null },
      include: INCLUDE,
    });
  });

  app.post<{ Body: StartEntryInput }>("/api/time-entries/start", async (req, reply) => {
    const { description, clientId, projectId, taskId, billable } = req.body;
    if (!description?.trim()) return reply.code(400).send({ error: "falta la descripción" });
    const running = await db.timeEntry.findFirst({ where: { userId: req.user!.id, endedAt: null } });
    if (running) return reply.code(400).send({ error: "ya tienes un cronómetro en marcha" });
    const hourlyRate = await resolveHourlyRate(clientId, req.body.hourlyRate);
    return db.timeEntry.create({
      data: { userId: req.user!.id, description, clientId, projectId, taskId, billable, hourlyRate },
      include: INCLUDE,
    });
  });

  app.post<{ Params: { id: string } }>("/api/time-entries/:id/stop", async (req, reply) => {
    const entry = await db.timeEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) return reply.code(404).send({ error: "registro no encontrado" });
    if (entry.userId !== req.user!.id && req.user!.role !== "ADMIN") return reply.code(403).send({ error: "forbidden" });
    if (entry.endedAt) return reply.code(400).send({ error: "ya está parado" });
    const endedAt = new Date();
    return db.timeEntry.update({
      where: { id: entry.id },
      data: { endedAt, minutes: minutesBetween(entry.startedAt, endedAt) },
      include: INCLUDE,
    });
  });

  app.post<{ Body: ManualEntryInput }>("/api/time-entries", async (req, reply) => {
    const { description, date, minutes, clientId, projectId, taskId, billable } = req.body;
    if (!description?.trim()) return reply.code(400).send({ error: "falta la descripción" });
    if (!date || !minutes || minutes <= 0) return reply.code(400).send({ error: "fecha y duración son obligatorias" });
    const startedAt = new Date(date);
    const hourlyRate = await resolveHourlyRate(clientId, req.body.hourlyRate);
    return db.timeEntry.create({
      data: {
        userId: req.user!.id,
        description,
        startedAt,
        endedAt: new Date(startedAt.getTime() + minutes * 60_000),
        minutes,
        clientId,
        projectId,
        taskId,
        billable,
        hourlyRate,
      },
      include: INCLUDE,
    });
  });

  app.patch<{ Params: { id: string }; Body: Partial<ManualEntryInput> }>(
    "/api/time-entries/:id",
    async (req, reply) => {
      const entry = await db.timeEntry.findUnique({ where: { id: req.params.id } });
      if (!entry) return reply.code(404).send({ error: "registro no encontrado" });
      if (entry.userId !== req.user!.id && req.user!.role !== "ADMIN") return reply.code(403).send({ error: "forbidden" });
      if (entry.deliveryNoteId) return reply.code(400).send({ error: "ya está incluido en un albarán, no se puede editar" });

      const { description, date, minutes, clientId, projectId, taskId, billable, hourlyRate } = req.body;
      const startedAt = date ? new Date(date) : entry.startedAt;
      const finalMinutes = minutes ?? entry.minutes ?? undefined;
      return db.timeEntry.update({
        where: { id: entry.id },
        data: {
          description,
          clientId,
          projectId,
          taskId,
          billable,
          hourlyRate,
          startedAt: date ? startedAt : undefined,
          minutes: minutes,
          endedAt: entry.endedAt && finalMinutes ? new Date(startedAt.getTime() + finalMinutes * 60_000) : undefined,
        },
        include: INCLUDE,
      });
    }
  );

  app.delete<{ Params: { id: string } }>("/api/time-entries/:id", async (req, reply) => {
    const entry = await db.timeEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) return reply.code(404).send({ error: "registro no encontrado" });
    if (entry.userId !== req.user!.id && req.user!.role !== "ADMIN") return reply.code(403).send({ error: "forbidden" });
    if (entry.deliveryNoteId) return reply.code(400).send({ error: "ya está incluido en un albarán, no se puede eliminar" });
    await db.timeEntry.delete({ where: { id: entry.id } });
    return { ok: true };
  });

  app.post<{ Body: { entryIds: string[]; concept?: string } }>(
    "/api/time-entries/generate-delivery-note",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const entries = await db.timeEntry.findMany({ where: { id: { in: req.body.entryIds } } });
      if (entries.length === 0) return reply.code(400).send({ error: "no hay registros seleccionados" });
      if (entries.some((e) => e.deliveryNoteId)) return reply.code(400).send({ error: "alguno ya está facturado" });
      if (entries.some((e) => !e.endedAt || !e.minutes)) {
        return reply.code(400).send({ error: "hay un cronómetro en marcha entre los seleccionados" });
      }
      const clientId = entries[0].clientId;
      if (!clientId || entries.some((e) => e.clientId !== clientId)) {
        return reply.code(400).send({ error: "todos los registros deben ser del mismo cliente" });
      }
      const hourlyRate = entries[0].hourlyRate;
      if (hourlyRate == null || entries.some((e) => e.hourlyRate !== hourlyRate)) {
        return reply.code(400).send({ error: "todos los registros deben tener la misma tarifa por hora" });
      }

      const totalHours = entries.reduce((s, e) => s + e.minutes! / 60, 0);
      const client = await db.client.findUniqueOrThrow({ where: { id: clientId } });
      const note = await db.deliveryNote.create({
        data: {
          clientId,
          concept: req.body.concept?.trim() || `Horas trabajadas (${entries.length} registro${entries.length > 1 ? "s" : ""})`,
          quantity: Number(totalHours.toFixed(2)),
          unitPrice: hourlyRate,
          vatRate: 21,
        },
      });
      await db.timeEntry.updateMany({ where: { id: { in: entries.map((e) => e.id) } }, data: { deliveryNoteId: note.id } });
      return { ...note, client };
    }
  );
}
