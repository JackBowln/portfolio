// The site's time zone (PRD Q-06, F06-T4): schedules and expiry times are shown and typed in it, and stored in UTC.
// Offsets come from Intl, so a future daylight-saving rule needs no code change
export const SITE_TIME_ZONE = 'America/Sao_Paulo'

/** Minutes the zone is ahead of UTC at that instant (São Paulo today: -180) */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant).map(part => [part.type, part.value]))
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  return Math.round((asUtc - instant.getTime()) / 60_000)
}

/** "2026-11-01T09:30" on the wall clock of `timeZone` → the instant; null for anything else */
export function zonedToUtc(local: string, timeZone = SITE_TIME_ZONE): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!match) {
    return null
  }
  const [, year, month, day, hour, minute] = match.map(Number) as [number, number, number, number, number, number]
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  // Two passes settle the offset around a transition
  let instant = new Date(wall - offsetMinutes(new Date(wall), timeZone) * 60_000)
  instant = new Date(wall - offsetMinutes(instant, timeZone) * 60_000)
  return Number.isNaN(instant.getTime()) ? null : instant
}

/** The instant as "2026-11-01T09:30" on the wall clock of `timeZone`, for a datetime-local input */
export function utcToZoned(instant: Date, timeZone = SITE_TIME_ZONE): string {
  return new Date(instant.getTime() + offsetMinutes(instant, timeZone) * 60_000).toISOString().slice(0, 16)
}

/** "1 de novembro de 2026 às 09:30 BRT"-style text in the zone, with its name */
export function formatInZone(instant: Date | string | number, locale: string, timeZone = SITE_TIME_ZONE): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone, timeZoneName: 'short' }).format(new Date(instant))
}
