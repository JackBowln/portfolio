// D1 binds at most 100 parameters per query: long `IN (…)` lists are split into groups of 90
export const IN_LIMIT = 90

export function chunked<T>(items: readonly T[]): T[][] {
  const out: T[][] = []
  for (let start = 0; start < items.length; start += IN_LIMIT) {
    out.push(items.slice(start, start + IN_LIMIT))
  }
  return out
}
