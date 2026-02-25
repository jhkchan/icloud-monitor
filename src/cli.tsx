#!/usr/bin/env node
import { render } from "ink";
import React from "react";
import { App } from "./components/App.js";
import { runStatus } from "./modes/status.js";
import { runLog } from "./modes/log.js";
import { runCheck } from "./modes/check.js";
import { runWatch } from "./modes/watch.js";

export interface CliOptions {
  command: "dashboard" | "status" | "log" | "check";
  json: boolean;
  watch: boolean;
  errors: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const opts: CliOptions = {
    command: "dashboard",
    json: false,
    watch: false,
    errors: false,
  };

  const positional = args.filter((a) => !a.startsWith("-"));
  const flags = args.filter((a) => a.startsWith("-"));

  if (positional.length > 0) {
    const cmd = positional[0];
    if (cmd === "status" || cmd === "log" || cmd === "check") {
      opts.command = cmd;
    }
  }

  opts.json = flags.includes("--json");
  opts.watch = flags.includes("--watch");
  opts.errors = flags.includes("--errors");

  return opts;
}

const opts = parseArgs(process.argv.slice(2));

// Non-interactive modes — no Ink/React
if (opts.watch) {
  runWatch();
} else if (opts.command === "status") {
  runStatus(opts.json);
} else if (opts.command === "log") {
  runLog(opts.errors);
} else if (opts.command === "check") {
  runCheck();
} else {
  // Interactive TUI
  const { waitUntilExit } = render(<App options={opts} />);
  waitUntilExit().then(() => process.exit(0)).catch(() => process.exit(0));
}
