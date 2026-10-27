// Theme preference (ADR-0010 §3): follows prefers-color-scheme until the visitor picks one, which is kept in
// localStorage, never in a cookie, so public pages stay cacheable.
import type { ThemeName } from './css-tokens.ts'

export const THEME_STORAGE_KEY = 'theme'
export const THEMES: readonly ThemeName[] = ['light', 'dark']

export function isThemeName(value: unknown): value is ThemeName {
  return THEMES.includes(value as ThemeName)
}

/**
 * Runs inline in <head> before the first paint, so a stored theme never flashes the other one (no FOUC).
 * Static on purpose: F03-T4 allows it in the CSP by hash. Storage may throw (privacy modes); the system theme then applies.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`
