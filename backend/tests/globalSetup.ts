import { execSync } from "node:child_process";
import fs from "node:fs";
import { TEST_DB_PATH, TEST_DATABASE_URL } from "./testEnv.js";

// corre una vez, antes de cualquier archivo de test: deja una BBDD de test limpia con el
// esquema al día, sin tocar nada de lo que ya hubiera en test.db de una corrida anterior.
export default function setup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(TEST_DB_PATH + suffix, { force: true });
  }
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
