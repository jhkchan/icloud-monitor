import { execWithTimeout } from "../utils/spawn.js";

export interface ProcessStats {
  name: string;
  pid: number;
  cpu: number;
  mem: number;
  running: boolean;
}

const TARGET_PROCESSES = ["bird", "fileproviderd", "cloudd", "nsurlsessiond"];

export class ProcessMonitor {
  private interval: ReturnType<typeof setInterval> | null = null;
  private _stats: Map<string, ProcessStats> = new Map();
  private onChange: ((stats: Map<string, ProcessStats>) => void) | null = null;

  constructor(onChange?: (stats: Map<string, ProcessStats>) => void) {
    this.onChange = onChange ?? null;
    // Initialize all targets as not running
    for (const name of TARGET_PROCESSES) {
      this._stats.set(name, { name, pid: 0, cpu: 0, mem: 0, running: false });
    }
  }

  get stats(): Map<string, ProcessStats> {
    return this._stats;
  }

  start(intervalMs: number = 2000): void {
    this.poll(); // Initial poll
    this.interval = setInterval(() => this.poll(), intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const output = await execWithTimeout("ps", ["aux"], 5000);
      const lines = output.split("\n");

      // Reset all to not running
      const updated = new Map<string, ProcessStats>();
      for (const name of TARGET_PROCESSES) {
        updated.set(name, { name, pid: 0, cpu: 0, mem: 0, running: false });
      }

      for (const line of lines) {
        for (const target of TARGET_PROCESSES) {
          if (line.includes(`/${target}`)) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 6) {
              const existing = updated.get(target)!;
              const cpu = parseFloat(parts[2]) || 0;
              // Accumulate CPU if multiple instances (e.g., multiple cloudd)
              updated.set(target, {
                name: target,
                pid: existing.running
                  ? existing.pid
                  : parseInt(parts[1]) || 0,
                cpu: existing.running ? existing.cpu + cpu : cpu,
                mem: existing.running
                  ? Math.max(existing.mem, parseFloat(parts[3]) || 0)
                  : parseFloat(parts[3]) || 0,
                running: true,
              });
            }
          }
        }
      }

      this._stats = updated;
      this.onChange?.(updated);
    } catch {
      // Silently fail -- will retry on next poll
    }
  }
}
