import React from "react";
import { Box, Text } from "ink";
import { useAppState } from "../state.js";

export function CategoryBreakdown(): React.ReactElement {
  const { syncStatus } = useAppState();

  const groups = syncStatus?.directoryGroups ?? [];
  const total = syncStatus?.totalStuck ?? 0;

  if (groups.length === 0) return <></>;

  const topN = groups.slice(0, 8);

  return (
    <Box flexDirection="column">
      <Text bold>Top Directories</Text>
      {topN.map((group) => {
        const pct = total > 0 ? ((group.items / total) * 100).toFixed(1) : "0";
        return (
          <Text key={group.path}>
            <Text>
              {group.shortName.slice(0, 25).padEnd(26)}
            </Text>
            <Text>{String(group.items).padStart(6)}</Text>
            <Text dimColor> {pct.padStart(5)}%</Text>
          </Text>
        );
      })}
    </Box>
  );
}
