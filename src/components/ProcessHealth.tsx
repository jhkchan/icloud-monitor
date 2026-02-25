import React from "react";
import { Box, Text } from "ink";
import { useAppState } from "../state.js";

function cpuColor(cpu: number): string {
  if (cpu >= 60) return "red";
  if (cpu >= 20) return "yellow";
  return "green";
}

export function ProcessHealth(): React.ReactElement {
  const { processes } = useAppState();

  const bird = processes.get("bird");
  const fprovider = processes.get("fileproviderd");

  return (
    <Box flexDirection="column">
      <Text bold>Process Health</Text>
      {[bird, fprovider].map((proc) => {
        if (!proc) return null;
        const label = proc.name === "fileproviderd" ? "fprovider" : proc.name;
        if (!proc.running) {
          return (
            <Text key={proc.name}>
              <Text color="red">{label}: not running</Text>
            </Text>
          );
        }
        return (
          <Text key={proc.name}>
            <Text>{label.padEnd(10)}</Text>
            <Text color={cpuColor(proc.cpu)}>
              CPU {proc.cpu.toFixed(1).padStart(5)}%
            </Text>
          </Text>
        );
      })}
    </Box>
  );
}
