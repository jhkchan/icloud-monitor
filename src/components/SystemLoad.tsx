import React from "react";
import { Box, Text } from "ink";
import { useAppState } from "../state.js";

export function SystemLoad(): React.ReactElement {
  const { systemInfo } = useAppState();

  if (!systemInfo) {
    return <Text dimColor>loading system info...</Text>;
  }

  const load = systemInfo.loadAverage[0];
  const overloaded = load > systemInfo.cpuCores * 2;

  return (
    <Box>
      <Text>
        load{" "}
        <Text color={overloaded ? "red" : load > systemInfo.cpuCores ? "yellow" : "green"}>
          {load.toFixed(2)}
        </Text>
        {"  "}uptime {systemInfo.uptimeStr}
      </Text>
    </Box>
  );
}
