// HTTP Range for media delivery (RFC 9110 §14): a single byte range; multipart ranges are not served
/** One range of `bytes=a-b`, `a-` or `-n` within `size`; undefined when unsatisfiable or not a single range */
export function parseRange(header: string, size: number): { offset: number, length: number } | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || (match[1] === '' && match[2] === '')) {
    return undefined
  }
  if (match[1] === '') {
    const suffix = Number(match[2])
    return suffix > 0 ? { offset: Math.max(0, size - suffix), length: Math.min(suffix, size) } : undefined
  }
  const offset = Number(match[1])
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
  return offset < size && end >= offset ? { offset, length: end - offset + 1 } : undefined
}
