// Light/dark theme (ADR-0010 §3, decision F01-T2: a two-state toggle). The server never knows the theme: until the
// component mounts, `theme` is undefined, and the inline head script has already applied any stored choice.
import { isThemeName, THEME_STORAGE_KEY } from '#shared/design/theme'
import type { ThemeName } from '#shared/design/css-tokens'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function storedTheme(): ThemeName | undefined {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeName(value) ? value : undefined
  }
  catch {
    return undefined
  }
}

export function useTheme() {
  const theme = ref<ThemeName>()

  function systemTheme(): ThemeName {
    return matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
  }

  // Without a stored choice the page follows the system, also when it changes while the page is open
  function onSystemChange() {
    if (!storedTheme()) {
      theme.value = systemTheme()
    }
  }

  onMounted(() => {
    theme.value = storedTheme() ?? systemTheme()
    matchMedia(DARK_QUERY).addEventListener('change', onSystemChange)
  })
  onBeforeUnmount(() => matchMedia(DARK_QUERY).removeEventListener('change', onSystemChange))

  function setTheme(next: ThemeName) {
    theme.value = next
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    }
    catch {
      // Storage unavailable: the choice lasts for this page only
    }
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return { theme: readonly(theme), setTheme, toggleTheme }
}
