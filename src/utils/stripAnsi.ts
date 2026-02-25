// Strip ANSI escape codes from brctl output
// brctl embeds color codes regardless of whether stdout is a TTY
const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /\x1B\[[0-9;]*[a-zA-Z]|\x1B\].*?\x07/g;

export function stripAnsi(str: string): string {
  return str.replace(ANSI_PATTERN, "");
}
