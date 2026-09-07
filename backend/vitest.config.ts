import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL, TEST_PUBLIC_LEADS_API_KEY } from "./tests/testEnv.js";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/globalSetup.ts"],
    env: { DATABASE_URL: TEST_DATABASE_URL, PUBLIC_LEADS_API_KEY: TEST_PUBLIC_LEADS_API_KEY },
    // todos los tests comparten un único fichero SQLite: en paralelo, dos suites escribiendo
    // a la vez chocan con SQLITE_BUSY. Son pocos tests, correr en serie no cuesta nada.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
