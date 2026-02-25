import { ProcessMonitor } from "../collectors/ProcessMonitor.js";
import { BrctlStatusPoller } from "../collectors/BrctlStatusPoller.js";
import { SystemInfoCollector } from "../collectors/SystemInfoCollector.js";
import { evaluateAlerts, sendMacOSNotification } from "../alerts/engine.js";
import type { AppState, Alert } from "../state.js";

export async function runWatch(): Promise<void> {
  const processMonitor = new ProcessMonitor();
  const statusPoller = new BrctlStatusPoller();
  const systemInfo = new SystemInfoCollector();
  const sentAlerts = new Set<string>();

  console.log("icloud-monitor: watching in background (Ctrl+C to stop)");

  processMonitor.start();
  systemInfo.start();
  await statusPoller.start();

  // Evaluate alerts periodically
  const evalInterval = setInterval(() => {
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
    const activeIds = new Set(alerts.map((a) => a.id));

    // Clear resolved alerts from sent tracking
    for (const id of sentAlerts) {
      if (!activeIds.has(id)) sentAlerts.delete(id);
    }

    // Send notifications for new alerts
    for (const alert of alerts) {
      if (!sentAlerts.has(alert.id)) {
        sentAlerts.add(alert.id);
        const prefix = alert.severity === "critical" ? "!!" : "!";
        console.log(
          `[${new Date().toLocaleTimeString()}] ${prefix} ${alert.message}`,
        );
        sendMacOSNotification("iCloud Monitor", alert.message);
      }
    }
  }, 10_000);

  const cleanup = () => {
    clearInterval(evalInterval);
    processMonitor.stop();
    statusPoller.stop();
    systemInfo.stop();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
