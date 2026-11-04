// What a highlight counter may count (storyboard-home §9, F10-T4 decision 2): only a value the owner wrote as a
// number, with an optional symbol before (+, ~, a currency) and any text after ("40%", "3x", "1.200 visitas",
// "R$ 2,5 mi"). Anything else (a placeholder, a word) is never animated. The counter always ends on the original text
export interface Count {
  prefix: string
  value: number
  decimals: number
  /** The thousands and decimal separators as the owner wrote them */
  group: string
  point: string
  suffix: string
}

const NUMBER = /^(\p{Sc}|R\$|[+\-~≈<>])?(\s?)(\d{1,3}(?:([.,\s])\d{3})+(?:([.,])\d+)?|\d+(?:([.,])\d+)?)(.*)$/u

export function parseCount(text: string): Count | null {
  const match = NUMBER.exec(text.trim())
  if (!match) {
    return null
  }
  const [, symbol = '', space = '', digits = '', group = '', groupedPoint, plainPoint, suffix = ''] = match
  const point = groupedPoint ?? plainPoint ?? ''
  // "1.200" groups thousands; "1,5" is a decimal: a separator is a group only with exactly three digits after it
  const [whole = '', fraction = ''] = point ? splitLast(digits, point) : [digits, '']
  const value = Number(`${whole.replace(/[.,\s]/g, '')}${fraction ? `.${fraction}` : ''}`)
  if (!Number.isFinite(value) || value === 0) {
    return null
  }
  return { prefix: symbol + space, value, decimals: fraction.length, group, point, suffix }
}

function splitLast(text: string, separator: string): [string, string] {
  const index = text.lastIndexOf(separator)
  return [text.slice(0, index), text.slice(index + 1)]
}

/** The text of a count at some value on its way, written like the original */
export function formatCount(count: Count, value: number): string {
  const fixed = value.toFixed(count.decimals)
  const [whole = '', fraction] = fixed.split('.')
  const grouped = count.group ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, count.group) : whole
  return `${count.prefix}${grouped}${fraction ? `${count.point}${fraction}` : ''}${count.suffix}`
}
