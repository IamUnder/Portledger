import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Seed neutro: solo crea el usuario admin a partir de las variables de entorno. A partir de
// ahí, todo (proyectos, cuentas de Cloudflare, bases de datos...) se da de alta desde la propia
// interfaz. Si quieres precargar datos reales de tu infraestructura (para una nueva instalación
// o para restaurar tras cambiar de servidor), usa un seed.local.ts propio — ver README.
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("[seed] ADMIN_EMAIL/ADMIN_PASSWORD no definidos, no se crea usuario admin");
    return;
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return;
  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.create({ data: { email, passwordHash, role: "ADMIN" } });
  console.log(`[seed] usuario admin creado: ${email}`);
}

async function main() {
  await seedAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
