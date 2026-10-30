// Slugs of articles, projects, tags and heading anchors (ADR-0008 §3): lowercase ASCII words joined by "-", with
// the transliterations a German, French or Spanish reader expects (ü → ue, ß → ss, œ → oe) before accents are
// dropped (ç → c, ñ → n, ã → a). Empty when nothing is left, so the caller chooses the fallback
export const MAX_SLUG_LENGTH = 80
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const TRANSLITERATIONS: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  ẞ: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  ł: 'l',
  þ: 'th',
}

export function slugify(text: string, maxLength = MAX_SLUG_LENGTH): string {
  const ascii = text
    .toLowerCase()
    .replace(/[äöüßẞæœøđðłþ]/g, char => TRANSLITERATIONS[char] ?? char)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii.length <= maxLength) {
    return ascii
  }
  // Cut at a word boundary when one is near, never leaving a trailing "-"
  const cut = ascii.slice(0, maxLength)
  const boundary = cut.lastIndexOf('-')
  return (boundary > maxLength / 2 ? cut.slice(0, boundary) : cut).replace(/-+$/, '')
}
