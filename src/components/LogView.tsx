import React, { useState } from "react";
import { Box, Text, useInput, useStdin, useStdout } from "ink";
import { useAppState } from "../state.js";
import { formatDuration } from "../utils/format.js";
import type { LogEvent } from "../collectors/LogStreamer.js";

type FilterMode = "all" | "errors" | "slow";

interface Props {
  onBack: () => void;
}

function LogEntry({ event }: { event: LogEvent }): React.ReactElement {
  const slow = event.durationMs > 30_000;
  let color: string | undefined;
  let icon: string;

  if (!event.success) {
    color = "red";
    icon = "✗";
  } else if (slow) {
    color = "yellow";
    icon = "✓";
  } else {
    color = "green";
    icon = "✓";
  }

  return (
    <Box flexDirection="column">
      <Text color={color}>
        {event.timestamp.padEnd(10)} {icon} {event.operation.padEnd(15)}{" "}
        {event.target.slice(0, 35).padEnd(36)}
        [{formatDuration(event.durationMs)}]
      </Text>
      {event.error && (
        <Text color="red">{"          → " + event.error}</Text>
      )}
    </Box>
  );
}

export function LogView({ onBack }: Props): React.ReactElement {
  const { logEvents, logStats } = useAppState();
  const [filter, setFilter] = useState<FilterMode>("all");
  const { isRawModeSupported } = useStdin();

  useInput((input) => {
    if (input === "b") {
      onBack();
      return;
    }
    if (input === "f") {
      setFilter((prev) => {
        const modes: FilterMode[] = ["all", "errors", "slow"];
        const idx = modes.indexOf(prev);
        return modes[(idx + 1) % modes.length];
      });
    }
  }, { isActive: isRawModeSupported });

  const { stdout } = useStdout();
  const termRows = stdout?.rows ?? 24;
  const termCols = stdout?.columns ?? 80;
  // Reserve rows for: header, separator, separator, stats bar, padding (top+bottom)
  const availableRows = Math.max(5, termRows - 7);
  const separatorWidth = Math.max(40, termCols - 4);

  const filtered = logEvents.filter((e) => {
    if (filter === "errors") return !e.success;
    if (filter === "slow") return e.durationMs > 30_000;
    return true;
  });

  // Fill available terminal space
  const visible = filtered.slice(-availableRows);

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text bold>Live Log</Text>
        <Text dimColor>filter: {filter}  [f]cycle  [b]ack</Text>
      </Box>
      <Text>{"─".repeat(separatorWidth)}</Text>

      {visible.map((event, i) => (
        <LogEntry key={`log-${i}`} event={event} />
      ))}

      <Text>{"─".repeat(separatorWidth)}</Text>
      <Text>
        Throughput:{" "}
        <Text bold>{logStats.opsPerMinute} ops/min</Text>
        {"  "}Errors: <Text color={logStats.errorCount > 0 ? "red" : "green"}>{logStats.errorCount}</Text>
        {"  "}Avg: {formatDuration(logStats.avgDurationMs)}
      </Text>
    </Box>
  );
}
