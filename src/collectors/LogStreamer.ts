import { stripAnsi } from "../utils/stripAnsi.js";
import { spawnWithTimeout, type SpawnResult } from "../utils/spawn.js";
import { parseDurationString } from "../utils/format.js";

export interface LogEvent {
  timestamp: string;
  operation: string;
  success: boolean;
  durationMs: number;
  target: string;
  error?: string;
}

export interface LogStats {
  opsPerMinute: number;
  errorCount: number;
  avgDurationMs: number;
}

const WINDOW_SIZE_MS = 60_000; // 1 minute rolling window

export class LogStreamer {
  private spawn: SpawnResult | null = null;
  private _events: LogEvent[] = [];
  private _recentEvents: LogEvent[] = [];
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private onEvent: ((event: LogEvent) => void) | null = null;
  private onStats: ((stats: LogStats) => void) | null = null;

  constructor(
    onEvent?: (event: LogEvent) => void,
    onStats?: (stats: LogStats) => void,
  ) {
    this.onEvent = onEvent ?? null;
    this.onStats = onStats ?? null;
  }

  get events(): LogEvent[] {
    return this._events;
  }

  get stats(): LogStats {
    return this.computeStats();
  }

  start(): void {
    this.running = true;
    this.spawnProcess();
  }

  stop(): void {
    this.running = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.spawn) {
      this.spawn.kill();
      this.spawn = null;
    }
  }

  private spawnProcess(): void {
    if (!this.running) return;

    this.spawn = spawnWithTimeout("brctl", ["log", "-f", "-q"]);

    this.spawn.lines.on("line", (rawLine: string) => {
      const line = stripAnsi(rawLine);
      const event = this.parseLine(line);
      if (event) {
        this._events.push(event);
        this._recentEvents.push(event);
        this.pruneWindow();
        this.onEvent?.(event);
        this.onStats?.(this.computeStats());
      }
    });

    this.spawn.process.on("close", () => {
      if (this.running) {
        // Auto-restart after 5 seconds
        this.restartTimer = setTimeout(() => this.spawnProcess(), 5000);
      }
    });

    this.spawn.process.on("error", () => {
      if (this.running) {
        this.restartTimer = setTimeout(() => this.spawnProcess(), 5000);
      }
    });
  }

  private parseLine(line: string): LogEvent | null {
    // Match "done executing" lines
    const doneMatch = line.match(
      /\[(\w+)\s+[\d-]+\s+([\d:.-]+)\].*done executing.*?<(\w+)\s+([\S✅‼️]+)\s+(\S+)/,
    );
    if (doneMatch) {
      const durationMatch = line.match(/duration\s+([\w\dµ]+)/);
      const errorMatch = line.match(/error:<NSError.*?"([^"]+)"/);

      const success = line.includes("✅") || !line.includes("‼️");
      const timestamp = doneMatch[2];

      return {
        timestamp,
        operation: doneMatch[5].replace(/\(.*/, ""),
        success,
        durationMs: durationMatch
          ? parseDurationString(durationMatch[1])
          : 0,
        target: this.extractTarget(line),
        error: errorMatch ? errorMatch[1] : undefined,
      };
    }

    // Simpler pattern: look for "done executing" with duration
    if (line.includes("done executing")) {
      const timeMatch = line.match(/([\d:]+)/);
      const durMatch = line.match(/duration\s+([\w\dµ]+)/);
      const success = !line.includes("‼️");

      return {
        timestamp: timeMatch ? timeMatch[1] : "",
        operation: this.extractOperation(line),
        success,
        durationMs: durMatch ? parseDurationString(durMatch[1]) : 0,
        target: this.extractTarget(line),
        error: success ? undefined : this.extractError(line),
      };
    }

    return null;
  }

  private extractOperation(line: string): string {
    const opMatch = line.match(
      /(create-item|fetch-content|update-item|delete-item|materialize|fetch-metadata)/,
    );
    return opMatch ? opMatch[1] : "unknown";
  }

  private extractTarget(line: string): string {
    // Prefer filename from n:"..." over raw docID
    const nameMatch = line.match(/n:"([^"]+)"/);
    if (nameMatch) return nameMatch[1];
    const docIdMatch = line.match(/docID\((\d+)\)/);
    if (docIdMatch) return `docID(${docIdMatch[1]})`;
    return "";
  }

  private extractError(line: string): string {
    const errMatch = line.match(/error:<NSError.*?"([^"]+)"/);
    return errMatch ? errMatch[1] : "unknown error";
  }

  private pruneWindow(): void {
    const cutoff = Date.now() - WINDOW_SIZE_MS;
    // Simple approach: keep only recent events for stats
    if (this._recentEvents.length > 1000) {
      this._recentEvents = this._recentEvents.slice(-500);
    }
  }

  private computeStats(): LogStats {
    const recent = this._recentEvents;
    if (recent.length === 0) {
      return { opsPerMinute: 0, errorCount: 0, avgDurationMs: 0 };
    }

    const errors = recent.filter((e) => !e.success).length;
    const totalDuration = recent.reduce((sum, e) => sum + e.durationMs, 0);

    return {
      opsPerMinute: recent.length, // events in the last window (1 min)
      errorCount: errors,
      avgDurationMs: totalDuration / recent.length,
    };
  }
}
