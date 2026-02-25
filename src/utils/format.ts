export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return seconds > 0 ? `${minutes}m${seconds}s` : `${minutes}m`;
}

export function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function parseDurationString(dur: string): number {
  // Parses strings like "105ms", "45s756ms", "2min28s", "1m8s"
  let totalMs = 0;
  const minMatch = dur.match(/(\d+)\s*min/);
  const mMatch = dur.match(/(\d+)\s*m(?!s|in)/);
  const sMatch = dur.match(/(\d+)\s*s(?!$|\d)/);
  const secMatch = dur.match(/(\d+)\s*s$/);
  const msMatch = dur.match(/(\d+)\s*ms/);
  const µsMatch = dur.match(/(\d+)\s*µs/);

  if (minMatch) totalMs += parseInt(minMatch[1]) * 60_000;
  if (mMatch) totalMs += parseInt(mMatch[1]) * 60_000;
  if (sMatch) totalMs += parseInt(sMatch[1]) * 1000;
  if (secMatch) totalMs += parseInt(secMatch[1]) * 1000;
  if (msMatch) totalMs += parseInt(msMatch[1]);
  if (µsMatch) totalMs += parseInt(µsMatch[1]) / 1000;

  return totalMs;
}
