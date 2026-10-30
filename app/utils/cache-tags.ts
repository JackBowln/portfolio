// A page's Cache-Tag header collects the tags of everything it shows (ADR-0003 §2): the layout's settings and the
// page's own data each add theirs, so neither overwrites the other
export function mergeCacheTags(current: string | number | readonly string[] | null | undefined, tags: readonly string[]): string {
  const existing = Array.isArray(current) ? current.join(',') : String(current ?? '')
  return [...new Set([...existing.split(',').filter(Boolean), ...tags])].join(',')
}
