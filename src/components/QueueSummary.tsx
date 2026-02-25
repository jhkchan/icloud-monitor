import React, { useRef } from "react";
import { Box, Text } from "ink";
import { useAppState } from "../state.js";

export function QueueSummary(): React.ReactElement {
  const { syncStatus, logStats } = useAppState();
  const initialCountRef = useRef<number | null>(null);

  const total = syncStatus?.totalStuck ?? 0;

  if (initialCountRef.current === null && total > 0) {
    initialCountRef.current = total;
  }

  const initial = initialCountRef.current ?? total;
  const cleared = initial > 0 ? initial - total : 0;
  const pct = initial > 0 ? Math.round((cleared / initial) * 100) : 0;

  if (total === 0 && initial === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>Queue</Text>
        <Text color="green">No stuck items</Text>
      </Box>
    );
  }

  // Progress bar
  const barWidth = 30;
  const filled = Math.round((pct / 100) * barWidth);
  const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);

  // Queue clearance from actual scan deltas
  const delta = syncStatus?.queueDelta ?? null;
  const deltaPerMin = syncStatus?.queueDeltaPerMin ?? null;

  return (
    <Box flexDirection="column">
      <Text bold>Queue Summary</Text>
      <Text>
        Total stuck: <Text color={total > 1000 ? "red" : total > 100 ? "yellow" : "green"}>{total}</Text> items
        {syncStatus?.directoryGroups &&
          ` across ${syncStatus.directoryGroups.length} directories`}
      </Text>
      {initial > 0 && cleared > 0 && (
        <Text>
          <Text color="green">{bar}</Text> {pct}% cleared ({cleared}/
          {initial})
        </Text>
      )}
      {delta !== null && (
        <Text>
          Since last scan:{" "}
          <Text color={delta < 0 ? "green" : delta > 0 ? "red" : "dim"}>
            {delta > 0 ? "+" : ""}{delta} items
          </Text>
          {deltaPerMin !== null && (
            <Text dimColor>
              {" "}({Math.abs(Math.round(deltaPerMin))}/min {delta <= 0 ? "clearing" : "growing"})
            </Text>
          )}
        </Text>
      )}
      {delta === null && (
        <Text dimColor>Queue trend: waiting for next scan...</Text>
      )}
      {logStats.opsPerMinute > 0 && (
        <Text dimColor>
          Sync activity: {logStats.opsPerMinute} ops/min (from brctl log)
        </Text>
      )}
    </Box>
  );
}
