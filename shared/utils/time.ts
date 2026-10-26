// Timestamps are stored as integer milliseconds in UTC (ADR-0004); Drizzle maps them to Date via `timestamp_ms`

export function now(): Date {
  return new Date()
}
