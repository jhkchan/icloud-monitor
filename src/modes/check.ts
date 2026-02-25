import { ProcessMonitor } from "../collectors/ProcessMonitor.js";
import { BrctlStatusPoller } from "../collectors/BrctlStatusPoller.js";
import { SystemInfoCollector } from "../collectors/SystemInfoCollector.js";
import { evaluateAlerts } from "../alerts/engine.js";
import type { AppState } from "../state.js";

export async function runCheck(): Promise<void> {
  const processMonitor = new ProcessMonitor();
  const statusPoller = new BrctlStatusPoller();
  const systemInfo = new SystemInfoCollector();

  processMonitor.start();
  await Promise.all([
    statusPoller.start(),
    systemInfo.start(2_000_000_000),
  ]);

  // Give process monitor a moment to collect
  await new Promise((resolve) => setTimeout(resolve, 3000));

  processMonitor.stop();
  statusPoller.stop();
  systemInfo.stop();

  // Build minimal AppState for alert evaluation
  const state: AppState = {
    processes: processMonitor.stats,
    syncStatus: statusPoller.status,
    quota: null,
    systemInfo: systemInfo.info,
    logEvents: [],
    logStats: { opsPerMinute: 0, errorCount: 0, avgDurationMs: 0 },
    initialScanComplete: true,
    pollInterval: 0,
    alerts: [],
  };

  const alerts = evaluateAlerts(state);

  if (alerts.length === 0) {
    console.log("OK");
    process.exit(0);
  } else {
    for (const alert of alerts) {
      const severity = alert.severity === "critical" ? "!!" : "!";
      console.log(`${severity} ${alert.message}`);
      if (alert.command) {
        console.log(`  Run: ${alert.command}`);
      }
      if (alert.note) {
        console.log(`  Note: ${alert.note}`);
      }
    }
    process.exit(1);
  }
}
