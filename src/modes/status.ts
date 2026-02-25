import { ProcessMonitor } from "../collectors/ProcessMonitor.js";
import { BrctlStatusPoller } from "../collectors/BrctlStatusPoller.js";
import { BrctlQuotaPoller } from "../collectors/BrctlQuotaPoller.js";
import { SystemInfoCollector } from "../collectors/SystemInfoCollector.js";
import { formatBytes, relativeTime } from "../utils/format.js";

export async function runStatus(json: boolean): Promise<void> {
  const processMonitor = new ProcessMonitor();
  const statusPoller = new BrctlStatusPoller();
  const quotaPoller = new BrctlQuotaPoller();
  const systemInfo = new SystemInfoCollector();

  // Run all collectors once in parallel
  processMonitor.start();
  await Promise.all([
    statusPoller.start(),
    quotaPoller.start(2_000_000_000),
    systemInfo.start(2_000_000_000),
  ]);

  // Stop all polling
  processMonitor.stop();
  statusPoller.stop();
  quotaPoller.stop();
  systemInfo.stop();

  const sync = statusPoller.status;
  const quota = quotaPoller.quota;
  const sysinfo = systemInfo.info;
  const procs = processMonitor.stats;

  if (json) {
    const output = {
      syncState: sync?.state ?? "unknown",
      lastSync: sync?.lastSync?.toISOString() ?? null,
      totalStuck: sync?.totalStuck ?? 0,
      timedOut: sync?.timedOut ?? false,
      scanDurationMs: sync?.scanDurationMs ?? 0,
      directories: sync?.directoryGroups.map((g) => ({
        path: g.path,
        name: g.shortName,
        items: g.items,
      })) ?? [],
      processes: Object.fromEntries(
        Array.from(procs.entries()).map(([name, stats]) => [
          name,
          { cpu: stats.cpu, mem: stats.mem, pid: stats.pid, running: stats.running },
        ]),
      ),
      quota: quota ? { remainingBytes: quota.remainingBytes } : null,
      system: sysinfo
        ? {
            loadAverage: sysinfo.loadAverage,
            cpuCores: sysinfo.cpuCores,
            uptime: sysinfo.uptimeStr,
          }
        : null,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    // Human-readable summary
    console.log("iCloud Drive Status");
    console.log("─".repeat(50));

    // Sync state
    console.log(`  State:     ${sync?.state || "unknown"}`);
    console.log(
      `  Last sync: ${sync?.lastSync ? relativeTime(sync.lastSync) : "unknown"}`,
    );
    if (quota) {
      console.log(`  Quota:     ${formatBytes(quota.remainingBytes)} free`);
    }

    // Stuck items
    console.log("");
    if (sync && sync.totalStuck > 0) {
      console.log(
        `  Stuck items: ${sync.totalStuck} across ${sync.directoryGroups.length} directories`,
      );
      for (const group of sync.directoryGroups.slice(0, 8)) {
        const pct = ((group.items / sync.totalStuck) * 100).toFixed(1);
        console.log(
          `    ${group.shortName.padEnd(30)} ${String(group.items).padStart(6)}  ${pct}%`,
        );
      }
    } else {
      console.log("  No stuck items");
    }

    // Processes
    console.log("");
    console.log("  Processes:");
    for (const [name, stats] of procs) {
      if (!stats.running) {
        console.log(`    ${name.padEnd(16)} not running`);
      } else {
        console.log(
          `    ${name.padEnd(16)} CPU ${stats.cpu.toFixed(1).padStart(5)}%  MEM ${stats.mem.toFixed(1)}%`,
        );
      }
    }

    // System
    if (sysinfo) {
      console.log("");
      console.log(
        `  Load: ${sysinfo.loadAverage.map((l) => l.toFixed(2)).join(" ")}  (${sysinfo.cpuCores} cores)`,
      );
      console.log(`  Uptime: ${sysinfo.uptimeStr}`);
    }

    if (sync?.timedOut) {
      console.log("");
      console.log(
        `  ⚠  brctl status timed out after ${Math.round(sync.scanDurationMs / 1000)}s — data may be incomplete`,
      );
    }
  }

  process.exit(0);
}
