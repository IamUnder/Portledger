import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { requireRole } from "../auth.js";
import { getCompanySettings } from "../invoices/engine.js";

export async function companySettingsRoutes(app: FastifyInstance) {
  app.get("/api/company-settings", async () => {
    return getCompanySettings();
  });

  app.patch<{ Body: Record<string, unknown> }>(
    "/api/company-settings",
    { preHandler: requireRole("ADMIN") },
    async (req) => {
      await getCompanySettings(); // asegura que exista la fila
      return db.companySettings.update({ where: { id: "singleton" }, data: req.body });
    }
  );
}
