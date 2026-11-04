// F10-T2: the inline motion script (ADR-0011 §4). With JS and motion allowed it adds html.motion-ok and removes it
// after 3 s unless motion started; the stored "Reduce motion" choice or the system preference keep it off; storage
// errors keep motion off
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOTION_FALLBACK_MS, MOTION_INIT_SCRIPT, MOTION_OK_CLASS } from '../../shared/design/motion'

function run(options: { stored?: string | null, reduced?: boolean, storageThrows?: boolean } = {}) {
  const root = { classList: new Set<string>(), dataset: {} as Record<string, string> }
  const document = { documentElement: { classList: { add: (name: string) => root.classList.add(name), remove: (name: string) => root.classList.delete(name) }, dataset: root.dataset } }
  const localStorage = { getItem: () => {
    if (options.storageThrows) {
      throw new Error('denied')
    }
    return options.stored ?? null
  } }
  const matchMedia = () => ({ matches: options.reduced ?? false })
  new Function('document', 'localStorage', 'matchMedia', 'setTimeout', MOTION_INIT_SCRIPT)(document, localStorage, matchMedia, setTimeout)
  return root
}

describe('motion init script', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows motion and falls back after 3 s when nothing starts', () => {
    const root = run()
    expect(root.classList.has(MOTION_OK_CLASS)).toBe(true)
    vi.advanceTimersByTime(MOTION_FALLBACK_MS)
    expect(root.classList.has(MOTION_OK_CLASS)).toBe(false)
  })

  it('keeps the class once motion started', () => {
    const root = run()
    root.dataset.motion = 'started'
    vi.advanceTimersByTime(MOTION_FALLBACK_MS)
    expect(root.classList.has(MOTION_OK_CLASS)).toBe(true)
  })

  it('stays off with the stored choice, the system preference, or no storage', () => {
    const stored = run({ stored: '1' })
    expect(stored.classList.has(MOTION_OK_CLASS)).toBe(false)
    expect(stored.dataset.reduceMotion).toBe('1')
    expect(run({ reduced: true }).classList.has(MOTION_OK_CLASS)).toBe(false)
    expect(run({ storageThrows: true }).classList.has(MOTION_OK_CLASS)).toBe(false)
  })
})
