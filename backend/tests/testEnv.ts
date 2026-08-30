import path from "node:path";

// BBDD SQLite propia y desechable para los tests: nunca toca panel.db (la real, montada por
// volumen en /data en producción). Vive dentro de prisma/, fuera de cualquier volumen montado.
export const TEST_DB_PATH = path.join(process.cwd(), "prisma", "test.db");
export const TEST_DATABASE_URL = `file:${TEST_DB_PATH}`;
