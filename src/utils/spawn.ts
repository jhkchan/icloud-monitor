import { spawn, type ChildProcess } from "node:child_process";
import { createInterface, type Interface } from "node:readline";

export interface SpawnResult {
  process: ChildProcess;
  lines: Interface;
  kill: () => void;
}

/**
 * Spawn a child process with an optional timeout.
 * Returns a readline interface for line-by-line streaming.
 */
export function spawnWithTimeout(
  command: string,
  args: string[],
  timeoutMs?: number,
): SpawnResult {
  const ac = timeoutMs ? new AbortController() : undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    signal: ac?.signal,
  });

  if (timeoutMs && ac) {
    timer = setTimeout(() => ac.abort(), timeoutMs);
    child.on("close", () => {
      if (timer) clearTimeout(timer);
    });
  }

  const lines = createInterface({ input: child.stdout! });

  return {
    process: child,
    lines,
    kill: () => {
      if (timer) clearTimeout(timer);
      child.kill("SIGTERM");
    },
  };
}

/**
 * Run a command and collect all stdout as a string.
 * Rejects on timeout or non-zero exit.
 */
export function execWithTimeout(
  command: string,
  args: string[],
  timeoutMs: number = 30_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const { process: child, kill } = spawnWithTimeout(
      command,
      args,
      timeoutMs,
    );
    const chunks: Buffer[] = [];

    child.stdout!.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("close", (code: number | null) => {
      const output = Buffer.concat(chunks).toString("utf-8");
      if (code === 0 || code === null) {
        resolve(output);
      } else {
        reject(new Error(`${command} exited with code ${code}: ${output}`));
      }
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.name === "AbortError") {
        kill();
        reject(new Error(`${command} timed out after ${timeoutMs}ms`));
      } else {
        reject(err);
      }
    });
  });
}
