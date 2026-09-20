import { existsSync } from "node:fs";
import { runCommand } from "./exec.js";
import { GIT_CREDENTIALS_PATH, HOST_UID, HOST_GID } from "./config.js";

// Llamar SIEMPRE después de cualquier operación git que corra como root (clone/pull/fetch/push
// autenticados por HTTPS) — ver el porqué en config.ts junto a GIT_CREDENTIALS_PATH. No falla
// nunca (solo registra el aviso): un fallo aquí no debe tumbar el deploy/scaffold que lo llama.
export async function fixGitCredentialsOwnership(): Promise<void> {
  if (!existsSync(GIT_CREDENTIALS_PATH)) return;
  const { code, output } = await runCommand("chown", [`${HOST_UID}:${HOST_GID}`, GIT_CREDENTIALS_PATH]);
  if (code !== 0) console.error(`[git-credentials] no se pudo devolver ${GIT_CREDENTIALS_PATH} al usuario del host: ${output}`);
}
