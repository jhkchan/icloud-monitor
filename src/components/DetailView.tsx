import React, { useState } from "react";
import { Box, Text, useInput, useStdin, useStdout } from "ink";
import { useAppState } from "../state.js";
import { execSync } from "node:child_process";

interface Props {
  onBack: () => void;
}

export function DetailView({ onBack }: Props): React.ReactElement {
  const { syncStatus } = useAppState();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const groups = syncStatus?.directoryGroups ?? [];

  // Build visible rows (flattened tree)
  const visibleRows: Array<{
    path: string;
    shortName: string;
    items: number;
    depth: number;
    isExpanded: boolean;
    hasChildren: boolean;
  }> = [];

  for (const group of groups) {
    visibleRows.push({
      path: group.path,
      shortName: group.shortName,
      items: group.items,
      depth: 0,
      isExpanded: expandedPaths.has(group.path),
      hasChildren: true,
    });

    if (expandedPaths.has(group.path)) {
      // Show subdirectories from stuck items
      const subDirs = new Map<string, number>();
      for (const item of syncStatus?.stuckItems ?? []) {
        if (item.directory.startsWith(group.path.replace(/^\/Documents\//, "/Documents/"))) {
          const relPath = item.directory.slice(group.path.length + 1);
          const subDir = relPath.split("/").slice(0, 2).join("/");
          if (subDir) {
            subDirs.set(subDir, (subDirs.get(subDir) || 0) + 1);
          }
        }
      }
      const sorted = Array.from(subDirs.entries()).sort((a, b) => b[1] - a[1]);
      for (const [subPath, count] of sorted.slice(0, 20)) {
        visibleRows.push({
          path: `${group.path}/${subPath}`,
          shortName: subPath,
          items: count,
          depth: 1,
          isExpanded: false,
          hasChildren: false,
        });
      }
    }
  }

  // Virtualize: only show rows around the cursor
  const windowSize = 20;
  const start = Math.max(0, selectedIndex - Math.floor(windowSize / 2));
  const end = Math.min(visibleRows.length, start + windowSize);
  const windowRows = visibleRows.slice(start, end);
  const { isRawModeSupported } = useStdin();
  const { stdout } = useStdout();
  const termCols = stdout?.columns ?? 80;
  const separatorWidth = Math.max(40, termCols - 4);

  useInput((input, key) => {
    if (input === "b") {
      onBack();
      return;
    }
    if (input === "c" && visibleRows[selectedIndex]) {
      const path = visibleRows[selectedIndex].path;
      // Convert iCloud path to filesystem path
      const fsPath = `/Users/${process.env.USER}${path}`;
      try {
        execSync(`echo ${JSON.stringify(fsPath)} | pbcopy`);
      } catch {
        // ignore
      }
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(visibleRows.length - 1, i + 1));
    }
    if (key.return && visibleRows[selectedIndex]?.hasChildren) {
      const path = visibleRows[selectedIndex].path;
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    }
  }, { isActive: isRawModeSupported });

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text bold>Stuck Items Detail</Text>
        <Text dimColor>
          {selectedIndex + 1}/{visibleRows.length}
        </Text>
      </Box>
      <Text>{"─".repeat(separatorWidth)}</Text>

      {windowRows.map((row, i) => {
        const globalIndex = start + i;
        const selected = globalIndex === selectedIndex;
        const indent = "  ".repeat(row.depth);
        const icon = row.hasChildren
          ? row.isExpanded
            ? "▼"
            : "▶"
          : " ";

        return (
          <Text key={row.path}>
            <Text color={selected ? "blue" : undefined} inverse={selected}>
              {indent}
              {icon} {row.shortName.slice(0, 35).padEnd(36)}
              {String(row.items).padStart(6)} items
            </Text>
          </Text>
        );
      })}

      <Text>{"─".repeat(separatorWidth)}</Text>
      <Text dimColor>
        [b]ack  [enter]expand  [c]opy path  ↑↓ navigate
      </Text>
    </Box>
  );
}
