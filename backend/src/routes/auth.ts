import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { createSession, destroySession } from "../sessions.js";
import { SESSION_COOKIE } from "../auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string; password: string } }>(
    "/api/auth/login",
    {
      config: {
        // límite por IP: suficiente margen para un fallo de tecleo, corta un ataque de fuerza bruta.
        rateLimit: {
          max: 8,
          timeWindow: "5 minutes",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "demasiados intentos, espera unos minutos antes de volver a probar",
          }),
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body;
      const user = await db.user.findUnique({ where: { email } });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        await db.auditLog
          .create({ data: { userEmail: email, userRole: "UNKNOWN", method: "POST", path: "/api/auth/login", statusCode: 401, body: null } })
          .catch((err) => console.error("[audit] fallo registrando login fallido:", err));
        return reply.code(401).send({ error: "credenciales inválidas" });
      }
      const token = await createSession(user.id);
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
      return { email: user.email, role: user.role };
    }
  );

  app.post("/api/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await destroySession(token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "unauthorized" });
    return { email: req.user.email, role: req.user.role, accessEmail: req.accessEmail ?? null };
  });

  app.post<{ Body: { currentPassword: string; newPassword: string } }>(
    "/api/auth/change-password",
    async (req, reply) => {
      const { currentPassword, newPassword } = req.body;
      if (!newPassword || newPassword.length < 8) {
        return reply.code(400).send({ error: "la nueva contraseña debe tener al menos 8 caracteres" });
      }
      const user = req.user!;
      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return reply.code(401).send({ error: "la contraseña actual no es correcta" });
      }
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await db.user.update({ where: { id: user.id }, data: { passwordHash } });
      return { ok: true };
    }
  );
}
