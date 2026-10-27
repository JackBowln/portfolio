// F01-T2: the theme toggle follows prefers-color-scheme until the visitor picks a theme, then keeps it in
// localStorage (never a cookie) and applies it through data-theme (ADR-0010 §3)
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeToggle from '~/components/layout/ThemeToggle.vue'
import { THEME_STORAGE_KEY } from '#shared/design/theme'

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>

function mockSystemTheme(dark: boolean) {
  const listeners = new Set<() => void>()
  const query = {
    matches: dark,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => query))
  return {
    change(next: boolean) {
      query.matches = next
      listeners.forEach(listener => listener())
    },
  }
}

describe('theme toggle', () => {
  let wrapper: Wrapper | undefined

  async function mountToggle() {
    wrapper = await mountSuspended(ThemeToggle)
    return wrapper.get('button')
  }

  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
  })

  it('follows the system theme and writes nothing until used', async () => {
    mockSystemTheme(true)
    const button = await mountToggle()

    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.classes()).not.toContain('invisible')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('keeps following the system while there is no stored choice', async () => {
    const system = mockSystemTheme(false)
    const button = await mountToggle()
    expect(button.attributes('aria-pressed')).toBe('false')

    system.change(true)
    await wrapper?.vm.$nextTick()
    expect(button.attributes('aria-pressed')).toBe('true')
  })

  it('stores and applies the choice, without a cookie', async () => {
    const system = mockSystemTheme(false)
    const button = await mountToggle()

    await button.trigger('click')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.cookie).toBe('')

    // A stored choice wins over later system changes
    system.change(false)
    await wrapper?.vm.$nextTick()
    expect(button.attributes('aria-pressed')).toBe('true')

    await button.trigger('click')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('reads a stored choice over the system theme and ignores invalid values', async () => {
    mockSystemTheme(true)
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    expect((await mountToggle()).attributes('aria-pressed')).toBe('false')
    wrapper?.unmount()

    localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
    expect((await mountToggle()).attributes('aria-pressed')).toBe('true')
  })

  it('still works when storage throws (privacy modes)', async () => {
    mockSystemTheme(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const button = await mountToggle()

    await button.trigger('click')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(document.documentElement.dataset.theme).toBe('dark')
    vi.restoreAllMocks()
  })
})
