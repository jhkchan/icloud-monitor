import React from "react";
import { Text } from "ink";
import { useAppState } from "../state.js";
import { relativeTime } from "../utils/format.js";

export function StalenessIndicator(): React.ReactElement {
  const { syncStatus } = useAppState();

  if (!syncStatus) {
    return <Text dimColor>no data yet</Text>;
  }

  if (syncStatus.timedOut) {
    return <Text color="red">scan timed out !!</Text>;
  }

  const age = Date.now() - syncStatus.updatedAt.getTime();
  const stale = age > 120_000; // 2 minutes

  return (
    <Text color={stale ? "yellow" : "dim"}>
      updated {relativeTime(syncStatus.updatedAt)}
      {stale && " !"}
    </Text>
  );
}
