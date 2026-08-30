import type { FastifyInstance } from "fastify";
import { db } from "../db.js";

interface TaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  position?: number;
  dueDate?: string;
  assigneeId?: string;
  clientId?: string;
  projectId?: string;
}

export async function taskRoutes(app: FastifyInstance) {
  app.get("/api/tasks", async () => {
    return db.task.findMany({
      include: { assignee: true, client: true, project: true },
      orderBy: { position: "asc" },
    });
  });

  app.post<{ Body: TaskInput }>("/api/tasks", async (req, reply) => {
    if (!req.body.title?.trim()) return reply.code(400).send({ error: "el título es obligatorio" });
    const { dueDate, ...rest } = req.body;
    // nueva tarea al final de su columna
    const count = await db.task.count({ where: { status: rest.status ?? "TODO" } });
    return db.task.create({
      data: { ...rest, dueDate: dueDate ? new Date(dueDate) : undefined, position: count },
      include: { assignee: true, client: true, project: true },
    });
  });

  app.patch<{ Params: { id: string }; Body: Partial<TaskInput> }>("/api/tasks/:id", async (req) => {
    const { dueDate, ...rest } = req.body;
    return db.task.update({
      where: { id: req.params.id },
      data: { ...rest, dueDate: dueDate ? new Date(dueDate) : undefined },
      include: { assignee: true, client: true, project: true },
    });
  });

  app.delete<{ Params: { id: string } }>("/api/tasks/:id", async (req) => {
    await db.timeEntry.updateMany({ where: { taskId: req.params.id }, data: { taskId: null } });
    await db.task.delete({ where: { id: req.params.id } });
    return { ok: true };
  });
}
