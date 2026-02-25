import React from "react";
import { Box, Text } from "ink";
import { useAppState } from "../state.js";

export function AlertBanner(): React.ReactElement {
  const { alerts } = useAppState();

  if (alerts.length === 0) return <></>;

  return (
    <Box flexDirection="column" paddingX={1}>
      {alerts.map((alert) => (
        <Box key={alert.id} flexDirection="column">
          <Text
            color={alert.severity === "critical" ? "red" : "yellow"}
            bold
          >
            {alert.severity === "critical" ? "!!" : "!"} {alert.message}
          </Text>
          {alert.command && (
            <Text dimColor>
              {"  "}Run: <Text color="cyan">{alert.command}</Text>
            </Text>
          )}
          {alert.note && (
            <Text dimColor>{"  "}Note: {alert.note}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}
