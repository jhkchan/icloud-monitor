# icloud-monitor

A terminal-based monitoring tool for macOS iCloud Drive. Provides real-time visibility into sync status, process health, and stuck item diagnostics that macOS doesn't surface natively.

Built with [Ink](https://github.com/vadimdemedes/ink) (React for CLI).

## Why

iCloud Drive on macOS provides no meaningful visibility into its sync operations. When sync stalls or system performance degrades:

- Finder shows a spinner or hangs with no explanation
- `bird` and `fileproviderd` can consume 70-100% CPU for hours
- Thousands of items can get stuck in retry loops at 62 attempts
- `brctl status` exists but produces raw, ANSI-colored, multi-thousand-line output

This tool parses `brctl` and `ps` output into a usable dashboard.

## Install

### Homebrew

```bash
brew install jhkchan/icloud-monitor/icloud-monitor
```

### npm

```bash
npm install -g icloud-monitor
```

### GitHub Release

Download the single-file bundle from the [latest release](https://github.com/jhkchan/icloud-monitor/releases/latest):

```bash
curl -LO https://github.com/jhkchan/icloud-monitor/releases/latest/download/icloud-monitor.mjs
node icloud-monitor.mjs
```

### From source

```bash
git clone https://github.com/jhkchan/icloud-monitor.git
cd icloud-monitor
npm install
npm run build
```

Requires Node.js 18+ and macOS (uses `brctl`, `osascript`).

## Usage

```
icloud-monitor                    # Interactive TUI dashboard
icloud-monitor status             # One-shot summary, then exit
icloud-monitor status --json      # Machine-readable JSON output
icloud-monitor log                # Stream parsed brctl log events
icloud-monitor log --errors       # Stream only failed operations
icloud-monitor check              # Exit 0 if healthy, exit 1 if not
icloud-monitor --watch            # Background mode with macOS notifications
```

## Dashboard

The default interactive mode shows:

- **Process Health** -- CPU/MEM for `bird`, `fileproviderd`, `cloudd`, `nsurlsessiond` with color thresholds
- **Sync Status** -- current state, last sync time, iCloud quota
- **Queue Summary** -- stuck item count, clearance rate between scans
- **Category Breakdown** -- stuck items grouped by top-level directory
- **System Load** -- load average and uptime

Keyboard shortcuts: `d` detail view, `l` log view, `q` quit.

### Detail View

Collapsible tree of stuck items grouped by directory. Arrow keys to navigate, Enter to expand/collapse, `c` to copy path, `b` to go back.

### Log View

Live stream of `brctl log` events with color coding (green success, red error, yellow slow >30s). Press `f` to cycle filters (all/errors/slow), `b` to go back.

## Alerts

The tool monitors for these conditions and displays banner alerts:

| Condition | Severity |
|---|---|
| `bird` CPU >60% sustained for 2+ min | Critical |
| `fileproviderd` CPU >80% for 5+ min | Critical |
| Items at retry ceiling (62 attempts) | Warning |
| No successful sync in >1 hour | Warning |
| `brctl status` takes >30s | Warning |
| System load >2x CPU cores | Warning |

Each alert includes a suggested command (e.g., `killall bird`) and contextual notes.

In `--watch` mode, alerts trigger macOS notifications.

## Architecture

```
src/
  cli.tsx              Entry point, argument parsing, mode dispatch
  state.tsx            React Context + useReducer state manager
  collectors/
    ProcessMonitor.ts    Polls ps aux every 2s
    BrctlStatusPoller.ts Runs brctl status with adaptive polling
    BrctlQuotaPoller.ts  Runs brctl quota every 5 min
    SystemInfoCollector.ts Polls uptime, reads sysctl hw.ncpu
    LogStreamer.ts       Spawns brctl log -f -q, parses events
  components/
    App.tsx              Root component, view router
    DashboardView.tsx    Dashboard layout
    DetailView.tsx       Stuck items tree
    LogView.tsx          Live log stream
    AlertBanner.tsx      Alert display
    ...                  ProcessHealth, SyncStatus, QueueSummary, etc.
  modes/
    status.ts            Non-interactive status command
    log.ts               Non-interactive log streaming
    check.ts             Health check (exit code)
    watch.ts             Background monitoring with notifications
  alerts/
    engine.ts            Alert rule evaluation
  utils/
    spawn.ts             Child process with timeout
    stripAnsi.ts         ANSI code removal
    format.ts            Formatting helpers
```

### Key Design Decisions

- **First scan runs without timeout.** `brctl status` buffers all output and dumps at once -- it can take 3+ minutes on a loaded system. Killing it early yields zero data.
- **Adaptive polling.** `brctl status` interval doubles when slow (max 5 min), halves when fast (min 15s).
- **Queue clearance is measured between scans**, not from log throughput. Log operations (fetch-content, update-item) are general sync activity that doesn't directly correspond to stuck items clearing.
- **Warn, don't act.** The tool shows commands and context but never takes action automatically.

## Disclaimer

This project is not affiliated with, endorsed by, or associated with Apple Inc. iCloud and macOS are trademarks of Apple Inc. This tool uses publicly accessible command-line utilities (`brctl`, `ps`, `osascript`) and does not modify any system files or iCloud Drive settings.

## License

[MIT](LICENSE)
