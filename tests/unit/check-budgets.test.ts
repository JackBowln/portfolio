import { describe, expect, it } from 'vitest'
import { evaluateRoute, findChunkKey, staticClosure } from '../../scripts/budgets/compute'
import type { Manifest } from '../../scripts/budgets/compute'

const manifest: Manifest = {
  'node_modules/nuxt/dist/app/entry.js': { file: 'entry.js', isEntry: true, imports: ['_shared.js'], dynamicImports: ['pages/index.vue', 'components/admin/Editor.vue'] },
  '_shared.js': { file: 'shared.js', css: ['shared.css'] },
  'pages/index.vue': { file: 'index.js', isDynamicEntry: true, imports: ['node_modules/nuxt/dist/app/entry.js'], dynamicImports: ['components/motion/Hero.vue'] },
  'components/motion/Hero.vue': { file: 'hero.js', isDynamicEntry: true },
  'components/admin/Editor.vue': { file: 'editor.js', isDynamicEntry: true, imports: ['node_modules/@tiptap/core/index.js'] },
  'node_modules/@tiptap/core/index.js': { file: 'tiptap.js' },
  'pages/leaky.vue': { file: 'leaky.js', isDynamicEntry: true, imports: ['components/admin/Editor.vue'] },
  'layouts/default.vue': { file: 'default.js', isDynamicEntry: true, imports: ['node_modules/nuxt/dist/app/entry.js', '_menu.js'] },
  '_menu.js': { file: 'menu.js' },
}

const sizes: Record<string, number> = {
  'entry.js': 60_000,
  'shared.js': 5_000,
  'shared.css': 2_000,
  'index.js': 1_000,
  'hero.js': 40_000,
  'editor.js': 30_000,
  'tiptap.js': 90_000,
  'leaky.js': 500,
  'default.js': 3_000,
  'menu.js': 2_000,
}
const gzipBytes = (file: string) => sizes[file] ?? 0
const forbidden = ['/admin/', '@tiptap/']

describe('budget computation', () => {
  it('matches page keys exactly or by path suffix', () => {
    expect(findChunkKey(manifest, 'pages/index.vue')).toBe('pages/index.vue')
    expect(findChunkKey(manifest, 'nuxt/dist/app/entry.js')).toBe('node_modules/nuxt/dist/app/entry.js')
    expect(findChunkKey(manifest, 'pages/missing.vue')).toBeUndefined()
  })

  it('follows static imports only', () => {
    const keys = staticClosure(manifest, ['pages/index.vue'])
    expect([...keys].sort()).toEqual(['_shared.js', 'node_modules/nuxt/dist/app/entry.js', 'pages/index.vue'])
  })

  it('counts entry, page and static imports but not dynamic chunks', () => {
    const report = evaluateRoute('R1', { path: '/', page: 'pages/index.vue', js: 70, css: 5 }, manifest, gzipBytes, forbidden)

    expect(report.jsKb).toBe(66)
    expect(report.cssKb).toBe(2)
    expect(report.files).not.toContain('hero.js')
    expect(report.ok).toBe(true)
  })

  it('fails when the initial JS exceeds the limit', () => {
    const report = evaluateRoute('R1', { path: '/', page: 'pages/index.vue', js: 65, css: 5 }, manifest, gzipBytes, forbidden)

    expect(report.ok).toBe(false)
  })

  it('fails when a public route statically pulls admin or editor chunks', () => {
    const report = evaluateRoute('X', { path: '/leaky', page: 'pages/leaky.vue', js: 1000, css: 100 }, manifest, gzipBytes, forbidden)

    expect(report.forbidden).toEqual(['components/admin/Editor.vue', 'node_modules/@tiptap/core/index.js'])
    expect(report.ok).toBe(false)
  })

  it('fails when a public route ships a vendor chunk whose code holds an editor marker (F05-T3)', () => {
    // editor.js holds the markers but is only a dynamic import of the entry, never loaded by the route
    const files: Record<string, string> = { 'entry.js': 'x', 'index.js': 'y', 'editor.js': 'class y{} "ProseMirror"' }
    const content = { read: (file: string) => files[file] ?? '', markers: ['ProseMirror', 'codeToHast'] }
    const clean = evaluateRoute('R1', { path: '/', page: 'pages/index.vue', js: 1000, css: 100 }, manifest, gzipBytes, forbidden, content)
    expect(clean.forbidden).toEqual([])

    files['entry.js'] = 'const a="ProseMirror";b.codeToHast()'
    const leaky = evaluateRoute('R1', { path: '/', page: 'pages/index.vue', js: 1000, css: 100 }, manifest, gzipBytes, forbidden, content)
    expect(leaky.forbidden).toEqual(['entry.js (ProseMirror)', 'entry.js (codeToHast)'])
    expect(leaky.ok).toBe(false)
  })

  it('throws when the page chunk is missing', () => {
    expect(() => evaluateRoute('R9', { path: '/x', page: 'pages/missing.vue', js: 1, css: 1 }, manifest, gzipBytes, forbidden))
      .toThrow('page chunk "pages/missing.vue" not found')
  })

  // F01-T5: the header, footer and menu live in the layout, a dynamic chunk every public page loads first
  it('adds the layout and its static imports when the route names one', () => {
    const report = evaluateRoute('R1', { path: '/', page: 'pages/index.vue', layout: 'layouts/default.vue', js: 100, css: 5 }, manifest, gzipBytes, forbidden)
    expect(report.jsKb).toBe(71)
    expect(report.files).toEqual(expect.arrayContaining(['default.js', 'menu.js']))
  })

  it('counts the entry and the layout alone for a route without a page chunk (the error page)', () => {
    const report = evaluateRoute('E404', { path: '/x', layout: 'layouts/default.vue', js: 100, css: 5 }, manifest, gzipBytes, forbidden)
    expect(report.jsKb).toBe(70)
    expect(() => evaluateRoute('E404', { path: '/x', layout: 'layouts/missing.vue', js: 1, css: 1 }, manifest, gzipBytes, forbidden))
      .toThrow('layout chunk "layouts/missing.vue" not found')
  })
})
