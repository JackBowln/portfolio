// F06-T4: the site's time zone (Q-06: America/Sao_Paulo) for schedules: wall clock ↔ UTC, both ways, and the text
import { describe, expect, it } from 'vitest'
import { formatInZone, SITE_TIME_ZONE, utcToZoned, zonedToUtc } from '../../shared/utils/time-zone'

describe('site time zone', () => {
  it('is São Paulo, three hours behind UTC', () => {
    expect(SITE_TIME_ZONE).toBe('America/Sao_Paulo')
    expect(zonedToUtc('2026-11-01T09:30')?.toISOString()).toBe('2026-11-01T12:30:00.000Z')
    expect(zonedToUtc('2026-12-31T22:00')?.toISOString()).toBe('2027-01-01T01:00:00.000Z')
    expect(utcToZoned(new Date('2026-11-01T12:30:00Z'))).toBe('2026-11-01T09:30')
  })

  it('follows a zone with daylight saving in either season', () => {
    expect(zonedToUtc('2026-07-01T12:00', 'Europe/Berlin')?.toISOString()).toBe('2026-07-01T10:00:00.000Z')
    expect(zonedToUtc('2026-01-15T12:00', 'Europe/Berlin')?.toISOString()).toBe('2026-01-15T11:00:00.000Z')
    expect(utcToZoned(new Date('2026-07-01T10:00:00Z'), 'Europe/Berlin')).toBe('2026-07-01T12:00')
  })

  it('refuses anything that is not a wall-clock date and time', () => {
    for (const value of ['', '2026-11-01', '2026-11-01 09:30', '2026-11-01T09:30:00Z', 'amanhã']) {
      expect(zonedToUtc(value), value).toBeNull()
    }
  })

  it('writes the instant with the zone name', () => {
    expect(formatInZone('2026-11-01T12:30:00Z', 'pt-BR')).toMatch(/1 de novembro de 2026.*09:30.*(BRT|GMT-3)/)
  })
})
