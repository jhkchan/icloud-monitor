import React from "react";
import { Box, Text, useStdout } from "ink";
import { ProcessHealth } from "./ProcessHealth.js";
import { SyncStatusPanel } from "./SyncStatus.js";
import { QueueSummary } from "./QueueSummary.js";
import { CategoryBreakdown } from "./CategoryBreakdown.js";
import { StalenessIndicator } from "./StalenessIndicator.js";
import { SystemLoad } from "./SystemLoad.js";
import { useAppState } from "../state.js";

export function DashboardView(): React.ReactElement {
  const { initialScanComplete } = useAppState();
  const { stdout } = useStdout();
  const termCols = stdout?.columns ?? 80;
  const separatorWidth = Math.max(40, termCols - 4);

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text bold>iCloud Drive Monitor</Text>
        {initialScanComplete ? (
          <StalenessIndicator />
        ) : (
          <Text color="yellow">scanning... (brctl status may take minutes)</Text>
        )}
      </Box>

      <Text>{"─".repeat(separatorWidth)}</Text>

      <Box gap={4}>
        <ProcessHealth />
        <SyncStatusPanel />
      </Box>

      <Text>{"─".repeat(separatorWidth)}</Text>

      {initialScanComplete ? (
        <QueueSummary />
      ) : (
        <Text dimColor>Waiting for initial scan to complete...</Text>
      )}

      <Text>{"─".repeat(separatorWidth)}</Text>

      {initialScanComplete ? (
        <CategoryBreakdown />
      ) : (
        <Text dimColor>...</Text>
      )}

      <Text>{"─".repeat(separatorWidth)}</Text>

      <Box justifyContent="space-between">
        <SystemLoad />
        <Text dimColor>
          [d]etail  [l]og  [q]uit
        </Text>
      </Box>
    </Box>
  );
}
