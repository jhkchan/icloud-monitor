import { execWithTimeout } from "../utils/spawn.js";

export interface QuotaInfo {
  remainingBytes: number;
  updatedAt: Date;
}

export class BrctlQuotaPoller {
  private interval: ReturnType<typeof setInterval> | null = null;
  private _quota: QuotaInfo | null = null;
  private onChange: ((quota: QuotaInfo) => void) | null = null;

  constructor(onChange?: (quota: QuotaInfo) => void) {
    this.onChange = onChange ?? null;
  }

  get quota(): QuotaInfo | null {
    return this._quota;
  }

  start(intervalMs: number = 300_000): void {
    this.poll();
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
      const output = await execWithTimeout("brctl", ["quota"], 15_000);
      const match = output.match(/(\d+)\s+bytes\s+of\s+quota\s+remaining/);
      if (match) {
        this._quota = {
          remainingBytes: parseInt(match[1]),
          updatedAt: new Date(),
        };
        this.onChange?.(this._quota);
      }
    } catch {
      // Silently fail
    }
  }
}
