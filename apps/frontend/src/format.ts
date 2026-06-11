/**
 * Formats an epoch-millisecond timestamp as a local time string.
 *
 * @param ms - The timestamp in milliseconds since the epoch.
 * @returns The local time string (e.g. `12:00:01`).
 */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}

/**
 * Formats a value as pretty-printed JSON.
 *
 * @param value - The value to format.
 * @returns The indented JSON string.
 */
export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
