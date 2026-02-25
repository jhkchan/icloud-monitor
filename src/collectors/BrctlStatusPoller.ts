import { stripAnsi } from "../utils/stripAnsi.js";
import { spawnWithTimeout } from "../utils/spawn.js";

export interface StuckItem {
  directory: string;
  status: "pending-scan" | "active";
  attempts: number;
  lastAttempt: string;
}

export interface DirectoryGroup {
  path: string;
  shortName: string;
  items: number;
}

export interface SyncStatus {
  state: string;
  lastSync: Date | null;
  stuckItems: StuckItem[];
  directoryGroups: DirectoryGroup[];
  totalStuck: number;
  scanDurationMs: number;
  timedOut: boolean;
  updatedAt: Date;
  // Queue delta tracking between scans
  previousTotalStuck: number | null;
  previousScanAt: Date | null;
  queueDelta: number | null; // negative = items cleared
  queueDeltaPerMin: number | null; // clearance rate
}

const MIN_INTERVAL = 15_000;
const MAX_INTERVAL = 300_000;
const DEFAULT_INTERVAL = 30_000;
const POLL_TIMEOUT_MS = 600_000; // 10 min for subsequent polls

export class BrctlStatusPoller {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private _status: SyncStatus | null = null;
  private _interval: number = DEFAULT_INTERVAL;
  private _isFirstRun: boolean = true;
  private _isPolling: boolean = false;
  private onChange: ((status: SyncStatus) => void) | null = null;

  constructor(onChange?: (status: SyncStatus) => void) {
    this.onChange = onChange ?? null;
  }

  get status(): SyncStatus | null {
    return this._status;
  }

  get interval(): number {
    return this._interval;
  }

  get isFirstRun(): boolean {
    return this._isFirstRun;
  }

  async start(): Promise<void> {
    await this.poll();
    this._isFirstRun = false;
    this.scheduleNext();
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    this.timer = setTimeout(() => {
      this.poll().then(() => this.scheduleNext());
    }, this._interval);
  }

  private async poll(): Promise<void> {
    if (this._isPolling) return;
    this._isPolling = true;

    const startTime = Date.now();
    const stuckItems: StuckItem[] = [];
    let syncState = "";
    let lastSync: Date | null = null;
    let timedOut = false;
    let currentDir = "";

    try {
      // First run: no timeout — let brctl status complete fully
      // Subsequent polls: generous timeout
      const timeout = this._isFirstRun ? undefined : POLL_TIMEOUT_MS;
      const result = spawnWithTimeout("brctl", ["status"], timeout);

      await new Promise<void>((resolve) => {
        result.lines.on("line", (rawLine: string) => {
          const line = stripAnsi(rawLine);

          // Parse sync state header
          if (line.includes("client:")) {
            const stateMatch = line.match(/client:(\S+)/);
            if (stateMatch) syncState = stateMatch[1];
          }

          // Parse last sync timestamp
          if (line.includes("last-sync:")) {
            const tsMatch = line.match(
              /last-sync:(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+)/,
            );
            if (tsMatch) lastSync = new Date(tsMatch[1]);
          }

          // Parse directory paths
          if (line.trim().startsWith("Under /")) {
            currentDir = line.trim().replace("Under ", "");
          }

          // Parse stuck items
          if (line.includes("pending-scan") || line.includes("active")) {
            const attemptsMatch = line.match(/attempts:(\d+)/);
            const lastMatch = line.match(/last:(\S+)/);
            const isPending = line.includes("pending-scan");

            stuckItems.push({
              directory: currentDir,
              status: isPending ? "pending-scan" : "active",
              attempts: attemptsMatch ? parseInt(attemptsMatch[1]) : 0,
              lastAttempt: lastMatch ? lastMatch[1] : "unknown",
            });
          }
        });

        result.lines.on("close", () => resolve());

        result.process.on("error", (err: Error) => {
          if (err.name === "AbortError") {
            timedOut = true;
            result.kill();
          }
          resolve();
        });
      });
    } catch {
      timedOut = true;
    }

    const scanDuration = Date.now() - startTime;
    this.adaptInterval(scanDuration);

    // Group by top-level project directory
    const dirCounts = new Map<string, number>();
    for (const item of stuckItems) {
      // Extract project-level path: /Documents/X/Y/Z -> /Documents/X/Y/Z
      const parts = item.directory.split("/");
      const key = parts.length >= 5 ? parts.slice(0, 5).join("/") : item.directory;
      dirCounts.set(key, (dirCounts.get(key) || 0) + 1);
    }

    const directoryGroups: DirectoryGroup[] = Array.from(dirCounts.entries())
      .map(([path, items]) => ({
        path,
        shortName: path.split("/").pop() || path,
        items,
      }))
      .sort((a, b) => b.items - a.items);

    const now = new Date();
    const prevTotal = this._status?.totalStuck ?? null;
    const prevScanAt = this._status?.updatedAt ?? null;

    // Compute queue delta between scans
    let queueDelta: number | null = null;
    let queueDeltaPerMin: number | null = null;
    if (prevTotal !== null && prevScanAt !== null && !timedOut) {
      queueDelta = stuckItems.length - prevTotal;
      const elapsedMin = (now.getTime() - prevScanAt.getTime()) / 60_000;
      if (elapsedMin > 0) {
        queueDeltaPerMin = queueDelta / elapsedMin;
      }
    }

    this._status = {
      state: syncState,
      lastSync,
      stuckItems,
      directoryGroups,
      totalStuck: stuckItems.length,
      scanDurationMs: scanDuration,
      timedOut,
      updatedAt: now,
      previousTotalStuck: prevTotal,
      previousScanAt: prevScanAt,
      queueDelta,
      queueDeltaPerMin,
    };

    this.onChange?.(this._status);
    this._isPolling = false;
  }

  private adaptInterval(durationMs: number): void {
    if (durationMs > this._interval) {
      // Slow -- double interval
      this._interval = Math.min(this._interval * 2, MAX_INTERVAL);
    } else if (durationMs < this._interval / 2) {
      // Fast -- halve interval
      this._interval = Math.max(this._interval / 2, MIN_INTERVAL);
    }
  }
}
