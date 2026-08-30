import { spawn } from "node:child_process";
import { createWriteStream, createReadStream } from "node:fs";

export function runCommand(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; onData?: (chunk: string) => void } = {}
): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env });
    let output = "";
    const collect = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      opts.onData?.(text);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

// para dumps de bases de datos: el stdout del proceso (el propio dump) va a un fichero,
// separado de stderr (avisos/progreso), que sí se recoge para el log.
export function runCommandToFile(
  cmd: string,
  args: string[],
  outFile: string,
  opts: { env?: NodeJS.ProcessEnv; onStderr?: (chunk: string) => void } = {}
): Promise<{ code: number }> {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(outFile);
    const child = spawn(cmd, args, { env: opts.env ?? process.env });
    child.stdout.pipe(out);
    child.stderr.on("data", (chunk: Buffer) => opts.onStderr?.(chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1 }));
  });
}

// para restaurar dumps: el contenido del fichero se envía por stdin al proceso (ej. `mysql < dump.sql`)
export function runCommandFromFile(
  cmd: string,
  args: string[],
  inputFile: string,
  opts: { env?: NodeJS.ProcessEnv; onData?: (chunk: string) => void } = {}
): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: opts.env ?? process.env });
    let output = "";
    const collect = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      opts.onData?.(text);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
    createReadStream(inputFile).pipe(child.stdin);
  });
}
