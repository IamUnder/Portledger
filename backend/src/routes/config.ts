import type { FastifyInstance } from "fastify";
import { PANEL_BASE_URL } from "../config.js";

// configuración pública mínima que el frontend necesita en tiempo de ejecución (no se puede
// "hornear" en el bundle estático porque una sola imagen de frontend sirve cualquier instalación).
export async function configRoutes(app: FastifyInstance) {
  app.get("/api/config", async () => {
    return { publicBaseUrl: PANEL_BASE_URL, smtpConfigured: !!process.env.SMTP_HOST };
  });
}
