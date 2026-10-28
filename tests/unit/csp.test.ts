// F03-T4: CSP by hash (ADR-0012 §1): which inline scripts count, their hashes and the policy text
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CLIENT_ONLY_SCRIPT_HASHES, inlineScripts, mediaOriginFor, NON_PAGE_CSP, pageCsp, scriptHash } from '../../server/utils/csp'

describe('inlineScripts', () => {
  it('keeps the scripts the browser runs, in order, and their exact text', () => {
    const html = [
      '<script>window.a=1</script>',
      '<script type="module">import "x"\nconsole.log(1)</script>',
      `<script type='importmap'>{"imports":{}}</script>`,
      '<script type=text/javascript data-x="1">b()</script>',
      '<SCRIPT TYPE="Module">c()</SCRIPT >',
    ].join('')

    expect(inlineScripts(html)).toEqual(['window.a=1', 'import "x"\nconsole.log(1)', '{"imports":{}}', 'b()', 'c()'])
  })

  it('skips external scripts and data blocks', () => {
    const html = [
      '<script type="module" src="/_nuxt/entry.js" crossorigin></script>',
      '<script src=/a.js></script>',
      '<script type="application/json" id="__NUXT_DATA__">[1]</script>',
      '<script type="application/ld+json">{"@type":"Person"}</script>',
    ].join('')

    expect(inlineScripts(html)).toEqual([])
  })

  it('is not fooled by attributes that only end in src or type', () => {
    expect(inlineScripts('<script data-src="/x.js" data-type="application/json">run()</script>')).toEqual(['run()'])
  })

  it('counts an empty inline script, which still needs its hash', () => {
    expect(inlineScripts('<script></script>')).toEqual([''])
  })
})

describe('scriptHash', () => {
  it('is the base64 SHA-256 of the UTF-8 text', async () => {
    // printf '%s' 'alert(1)' | openssl dgst -sha256 -binary | base64
    expect(await scriptHash('alert(1)')).toBe(`'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='`)
    expect(await scriptHash('alert(1)')).toBe(await scriptHash('alert(1)'))
    expect(await scriptHash('alert("é")')).not.toBe(await scriptHash('alert("e")'))
  })
})

describe('CLIENT_ONLY_SCRIPT_HASHES', () => {
  it('matches the script of the installed Nuxt default 404 page', async () => {
    const nuxtDir = dirname(createRequire(import.meta.url).resolve('nuxt/package.json'))
    const component = readFileSync(join(nuxtDir, 'dist/app/components/error-404.vue'), 'utf8')
    const script = /script: \[\s*\{\s*innerHTML: `([^`]*)`/.exec(component)?.[1]

    expect(script).toBeTruthy()
    expect(CLIENT_ONLY_SCRIPT_HASHES).toEqual([await scriptHash(script!)])
  })
})

describe('pageCsp', () => {
  const base = { scriptHashes: [`'sha256-a'`, `'sha256-b'`, `'sha256-a'`], upgradeInsecureRequests: false }

  it('allows scripts only from the site and the listed hashes', () => {
    const scriptSrc = pageCsp(base).split('; ').find(directive => directive.startsWith('script-src'))
    expect(scriptSrc).toBe(`script-src 'self' 'sha256-a' 'sha256-b'`)
    expect(pageCsp(base)).not.toContain('unsafe-eval')
  })

  it('locks down everything else the ADR lists', () => {
    const directives = pageCsp(base).split('; ')
    expect(directives).toEqual(expect.arrayContaining([
      `default-src 'self'`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data:`,
      `media-src 'self'`,
      `font-src 'self'`,
      `connect-src 'self'`,
      `object-src 'none'`,
      `base-uri 'none'`,
      `form-action 'self'`,
      `frame-ancestors 'none'`,
    ]))
    expect(directives).not.toContain('upgrade-insecure-requests')
  })

  it('adds the media origin and the https upgrade when they apply', () => {
    const policy = pageCsp({ ...base, mediaOrigin: 'https://media.example.com', upgradeInsecureRequests: true })
    expect(policy).toContain(`img-src 'self' data: https://media.example.com`)
    expect(policy).toContain(`media-src 'self' https://media.example.com`)
    expect(policy.endsWith('upgrade-insecure-requests')).toBe(true)
  })

  it('gives non-page responses a policy that loads nothing', () => {
    expect(NON_PAGE_CSP).toBe(`default-src 'none'; frame-ancestors 'none'`)
  })
})

describe('mediaOriginFor', () => {
  it('names another origin, but not the site itself', () => {
    expect(mediaOriginFor('https://example.com', 'https://media.example.com/files')).toBe('https://media.example.com')
    expect(mediaOriginFor('https://example.com', 'https://example.com/media')).toBeUndefined()
    expect(mediaOriginFor('https://example.com', undefined)).toBeUndefined()
  })
})
