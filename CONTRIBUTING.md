# Contributing

## Prerequisites

- macOS (the tool uses `brctl`, `osascript`, and other macOS-specific APIs)
- Node.js 18+

## Setup

```bash
git clone <repo-url>
cd icloud-monitor
npm install
```

## Development

```bash
npx tsx src/cli.tsx          # Run the TUI
npx tsx src/cli.tsx status   # Test non-interactive mode
```

## Building

```bash
npm run build                # TypeScript compilation to dist/
npm run bundle               # Single-file bundle via esbuild
```

## Type checking

```bash
npx tsc --noEmit
```

## Project structure

```
src/
  cli.tsx              Entry point, argument parsing
  state.tsx            React Context + useReducer
  collectors/          Data collection (brctl, ps, uptime)
  components/          Ink/React UI components
  modes/               Non-interactive CLI modes
  alerts/              Alert rule engine
  utils/               Formatting, child process helpers
```

## Guidelines

- This is a macOS-only tool. Cross-platform support is a non-goal.
- The tool observes and reports. It should never modify iCloud Drive settings or take automated action.
- `brctl` output format is undocumented and may change across macOS versions. Parsers should fail gracefully.
- Keep Ink components focused. Each component should map to one section of the dashboard.
- Collectors run independently and update shared state via dispatch. Don't couple collectors to each other.

## Submitting changes

1. Fork the repo and create a branch
2. Make your changes
3. Run `npx tsc --noEmit` to verify no type errors
4. Test with `npx tsx src/cli.tsx` on a real macOS system with iCloud Drive enabled
5. Open a pull request with a description of what changed and why
