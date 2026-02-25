import { execWithTimeout } from "../utils/spawn.js";

export interface SystemInfo {
  loadAverage: [number, number, number];
  cpuCores: number;
  uptimeStr: string;
  updatedAt: Date;
}

export class SystemInfoCollector {
  private interval: ReturnType<typeof setInterval> | null = null;
  private _info: SystemInfo | null = null;
  private _cpuCores: number = 0;
  private onChange: ((info: SystemInfo) => void) | null = null;

  constructor(onChange?: (info: SystemInfo) => void) {
    this.onChange = onChange ?? null;
  }

  get info(): SystemInfo | null {
    return this._info;
  }

  async start(intervalMs: number = 5000): Promise<void> {
    await this.getCpuCores();
    await this.poll();
    this.interval = setInterval(() => this.poll(), intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async getCpuCores(): Promise<void> {
    try {
      const output = await execWithTimeout(
        "sysctl",
        ["-n", "hw.ncpu"],
        5000,
      );
      this._cpuCores = parseInt(output.trim()) || 1;
    } catch {
      this._cpuCores = 1;
    }
  }

  private async poll(): Promise<void> {
    try {
      const output = await execWithTimeout("uptime", [], 5000);
      const loadMatch = output.match(
        /load averages?:\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/,
      );
      const uptimeMatch = output.match(/up\s+(.+?),\s+\d+\s+users?/);

      if (loadMatch) {
        this._info = {
          loadAverage: [
            parseFloat(loadMatch[1]),
            parseFloat(loadMatch[2]),
            parseFloat(loadMatch[3]),
          ],
          cpuCores: this._cpuCores,
          uptimeStr: uptimeMatch ? uptimeMatch[1].trim() : "unknown",
          updatedAt: new Date(),
        };
        this.onChange?.(this._info);
      }
    } catch {
      // Silently fail
    }
  }
}
