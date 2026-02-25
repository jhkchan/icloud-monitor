import { LogStreamer } from "../collectors/LogStreamer.js";
import { formatDuration } from "../utils/format.js";

export function runLog(errorsOnly: boolean): void {
  const streamer = new LogStreamer(
    (event) => {
      if (errorsOnly && event.success) return;

      const icon = event.success ? "✓" : "✗";
      const line = `${event.timestamp.padEnd(24)} ${icon} ${event.operation.padEnd(15)} ${event.target.slice(0, 35).padEnd(36)} [${formatDuration(event.durationMs)}]`;
      console.log(line);
      if (event.error) {
        console.log(`${"".padEnd(25)} → ${event.error}`);
      }
    },
  );

  streamer.start();

  // Keep running until SIGINT
  process.on("SIGINT", () => {
    streamer.stop();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    streamer.stop();
    process.exit(0);
  });
}
