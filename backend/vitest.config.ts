import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/testEnv.js";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/globalSetup.ts"],
    env: { DATABASE_URL: TEST_DATABASE_URL },
    // todos los tests comparten un único fichero SQLite: en paralelo, dos suites escribiendo
    // a la vez chocan con SQLITE_BUSY. Son pocos tests, correr en serie no cuesta nada.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
