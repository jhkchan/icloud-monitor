import { execSync } from "node:child_process";
import type { AppState, Alert } from "../state.js";

interface CpuHistory {
  bird: Array<{ cpu: number; time: number }>;
  fileproviderd: Array<{ cpu: number; time: number }>;
}

const cpuHistory: CpuHistory = {
  bird: [],
  fileproviderd: [],
};

function trackCpu(
  name: "bird" | "fileproviderd",
  cpu: number,
  running: boolean,
): void {
  if (!running) {
    cpuHistory[name] = [];
    return;
  }
  cpuHistory[name].push({ cpu, time: Date.now() });
  // Keep last 10 minutes
  const cutoff = Date.now() - 600_000;
  cpuHistory[name] = cpuHistory[name].filter((e) => e.time > cutoff);
}

function sustainedAbove(
  name: "bird" | "fileproviderd",
  threshold: number,
  durationMs: number,
): number | null {
  const history = cpuHistory[name];
  if (history.length === 0) return null;

  const cutoff = Date.now() - durationMs;
  const recent = history.filter((e) => e.time > cutoff);
  if (recent.length < 2) return null;

  const allAbove = recent.every((e) => e.cpu > threshold);
  if (!allAbove) return null;

  return Math.round((Date.now() - recent[0].time) / 60_000);
}

export function evaluateAlerts(state: AppState): Alert[] {
  const alerts: Alert[] = [];

  // Track CPU history
  const bird = state.processes.get("bird");
  const fprovider = state.processes.get("fileproviderd");
  if (bird) trackCpu("bird", bird.cpu, bird.running);
  if (fprovider) trackCpu("fileproviderd", fprovider.cpu, fprovider.running);

  // Rule: bird CPU > 60% for 2+ minutes
  const birdMinutes = sustainedAbove("bird", 60, 120_000);
  if (birdMinutes !== null) {
    alerts.push({
      id: "bird-thrashing",
      message: `bird has been above 60% CPU for ${birdMinutes}m`,
      command: "killall bird",
      note: "expect a processing storm while fileproviderd catches up",
      severity: "critical",
      since: new Date(Date.now() - birdMinutes * 60_000),
    });
  }

  // Rule: fileproviderd CPU > 80% for 5+ minutes
  const fpMinutes = sustainedAbove("fileproviderd", 80, 300_000);
  if (fpMinutes !== null) {
    alerts.push({
      id: "fprovider-saturated",
      message: `fileproviderd saturated at ${fprovider?.cpu.toFixed(0)}% CPU for ${fpMinutes}m -- Finder may hang`,
      command: "killall fileproviderd",
      note: "will restart automatically via launchd",
      severity: "critical",
      since: new Date(Date.now() - fpMinutes * 60_000),
    });
  }

  // Rule: items at retry ceiling
  if (state.syncStatus) {
    const ceilingItems = state.syncStatus.stuckItems.filter(
      (i) => i.attempts >= 62,
    );
    if (ceilingItems.length > 0) {
      alerts.push({
        id: "retry-ceiling",
        message: `${ceilingItems.length} items hit retry limit (62 attempts) -- sync stalled`,
        command: "killall bird",
        note: "restarting bird clears the retry queue",
        severity: "warning",
        since: new Date(),
      });
    }

    // Rule: stale sync (> 1 hour)
    if (state.syncStatus.lastSync) {
      const ageMs = Date.now() - state.syncStatus.lastSync.getTime();
      if (ageMs > 3_600_000) {
        const hours = Math.round(ageMs / 3_600_000);
        alerts.push({
          id: "stale-sync",
          message: `No successful sync in ${hours}h`,
          severity: "warning",
          since: state.syncStatus.lastSync,
        });
      }
    }

    // Rule: brctl subsystem overloaded
    if (state.syncStatus.scanDurationMs > 30_000) {
      alerts.push({
        id: "slow-brctl",
        message: `iCloud subsystem under heavy load (scan took ${Math.round(state.syncStatus.scanDurationMs / 1000)}s)`,
        severity: "warning",
        since: new Date(),
      });
    }
  }

  // Rule: system overloaded
  if (state.systemInfo) {
    const load = state.systemInfo.loadAverage[0];
    const cores = state.systemInfo.cpuCores;
    if (load > cores * 2) {
      alerts.push({
        id: "system-overloaded",
        message: `System overloaded (load: ${load.toFixed(1)} on ${cores} cores)`,
        severity: "warning",
        since: new Date(),
      });
    }
  }

  // Sort by severity (critical first)
  return alerts.sort((a, b) => {
    if (a.severity === "critical" && b.severity !== "critical") return -1;
    if (b.severity === "critical" && a.severity !== "critical") return 1;
    return 0;
  });
}

export function sendMacOSNotification(
  title: string,
  message: string,
): void {
  try {
    execSync(
      `osascript -e 'display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"'`,
    );
  } catch {
    // ignore notification failures
  }
}
