// F01-T4: link targets are validated by protocol (CLAUDE.md "Sem XSS")
import { describe, expect, it } from 'vitest'
import { isExternalHref, safeHref } from '../../shared/utils/url'

describe('safeHref', () => {
  it('keeps http(s), mailto, tel and links on this site', () => {
    expect(safeHref('https://example.com/a?b=1#c')).toBe('https://example.com/a?b=1#c')
    expect(safeHref('HTTP://Example.com')).toBe('http://example.com/')
    expect(safeHref('mailto:someone@example.com')).toBe('mailto:someone@example.com')
    expect(safeHref('tel:+5511999999999')).toBe('tel:+5511999999999')
    expect(safeHref('/blog')).toBe('/blog')
    expect(safeHref('  #main ')).toBe('#main')
    expect(safeHref('?page=2')).toBe('?page=2')
    expect(safeHref('../sobre')).toBe('../sobre')
  })

  it('rejects script and data URLs in every disguise', () => {
    for (const href of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      '  javascript:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'blob:https://example.com/uuid',
    ]) {
      expect(safeHref(href), JSON.stringify(href)).toBeUndefined()
    }
  })

  it('rejects ambiguous targets: empty, protocol-relative and backslashes', () => {
    for (const href of ['', '   ', '//evil.example', '/\\evil.example', 'https:\\\\evil.example']) {
      expect(safeHref(href), JSON.stringify(href)).toBeUndefined()
    }
  })
})

describe('isExternalHref', () => {
  it('treats other origins as external and relative links as internal', () => {
    expect(isExternalHref('https://github.com/x', 'https://example.com')).toBe(true)
    expect(isExternalHref('https://example.com/blog', 'https://example.com')).toBe(false)
    expect(isExternalHref('/blog', 'https://example.com')).toBe(false)
    expect(isExternalHref('mailto:a@b.c', 'https://example.com')).toBe(false)
    expect(isExternalHref('https://github.com/x')).toBe(true)
  })
})
