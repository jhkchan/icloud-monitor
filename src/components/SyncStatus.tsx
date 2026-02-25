import React from "react";
import { Box, Text } from "ink";
import { useAppState } from "../state.js";
import { relativeTime, formatBytes } from "../utils/format.js";

export function SyncStatusPanel(): React.ReactElement {
  const { syncStatus, quota } = useAppState();

  return (
    <Box flexDirection="column">
      <Text bold>Sync Status</Text>
      <Text>
        State:{" "}
        <Text color={syncStatus?.state === "synced" ? "green" : "yellow"}>
          {syncStatus?.state || "unknown"}
        </Text>
      </Text>
      <Text>
        Last sync:{" "}
        {syncStatus?.lastSync ? relativeTime(syncStatus.lastSync) : "unknown"}
      </Text>
      {quota && (
        <Text>Quota: {formatBytes(quota.remainingBytes)} free</Text>
      )}
    </Box>
  );
}
