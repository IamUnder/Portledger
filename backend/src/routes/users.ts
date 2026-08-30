import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { requireRole } from "../auth.js";

export async function userRoutes(app: FastifyInstance) {
  app.get("/api/users", { preHandler: requireRole("ADMIN") }, async () => {
    return db.user.findMany({ select: { id: true, email: true, role: true, createdAt: true } });
  });

  // listado mínimo para cualquier usuario autenticado (ej. asignar tareas), sin datos de gestión
  app.get("/api/users/basic", async () => {
    return db.user.findMany({ select: { id: true, email: true } });
  });

  app.post<{ Body: { email: string; password: string; role: "ADMIN" | "COLLABORATOR" } }>(
    "/api/users",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      const { email, password, role } = req.body;
      if (!email || !password || password.length < 8) {
        return reply.code(400).send({ error: "email y contraseña (mín. 8 caracteres) son obligatorios" });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await db.user.create({ data: { email, passwordHash, role } });
      return { id: user.id, email: user.email, role: user.role };
    }
  );

  app.patch<{ Params: { id: string }; Body: { password: string } }>(
    "/api/users/:id/password",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      if (!req.body.password || req.body.password.length < 8) {
        return reply.code(400).send({ error: "la contraseña debe tener al menos 8 caracteres" });
      }
      const passwordHash = await bcrypt.hash(req.body.password, 12);
      await db.user.update({ where: { id: req.params.id }, data: { passwordHash } });
      return { ok: true };
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/users/:id",
    { preHandler: requireRole("ADMIN") },
    async (req, reply) => {
      if (req.user!.id === req.params.id) {
        return reply.code(400).send({ error: "no puedes eliminar tu propio usuario" });
      }
      await db.session.deleteMany({ where: { userId: req.params.id } });
      await db.notification.deleteMany({ where: { userId: req.params.id } });
      await db.notificationPreference.deleteMany({ where: { userId: req.params.id } });
      await db.user.delete({ where: { id: req.params.id } });
      return { ok: true };
    }
  );
}
