// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { version } from './package.json'
import { FONT_FAMILIES, FONT_LOADING_SCRIPT, FONT_PENDING_CSS, fontFaces } from './shared/design/fonts'
import { THEME_INIT_SCRIPT } from './shared/design/theme'

// Policy of every Web Worker script under /_nuxt/ (ADR-0012, F04-T2)
const WORKER_CSP = `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'`

export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxtjs/i18n', '@nuxt/fonts'],

  $production: {
    // Dev-only pages and routes (styleguide, binding diagnostics) never reach the production build
    // Nitro matches server patterns from inside server/, so the server one has no prefix.
    // Test-only routes (server/api/_test) ship only in the Playwright/CI build (PORTFOLIO_TEST_BUILD=1), never in a deploy
    ignore: ['**/pages/dev/**', '**/_dev/**', ...(process.env.PORTFOLIO_TEST_BUILD === '1' ? [] : ['**/_test/**'])],
  },

  devtools: { enabled: true },

  app: {
    head: {
      // Before the first paint: the stored theme (shared/design/theme.ts) and, on a first visit, fallback fonts
      // until `load` (shared/design/fonts.ts)
      script: [
        { innerHTML: THEME_INIT_SCRIPT, tagPosition: 'head' },
        { innerHTML: FONT_LOADING_SCRIPT, tagPosition: 'head' },
      ],
      style: [{ innerHTML: FONT_PENDING_CSS }],
    },
  },

  // ADR-0010 §1: Tailwind 4 through its Vite plugin; tokens live in main.css
  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Private (server-only); returned by GET /api/health
    appVersion: version,
    public: {
      // Canonical, hreflang and JSON-LD base. Set per environment by NUXT_PUBLIC_SITE_URL in wrangler.jsonc, read at
      // runtime from the Worker env; must equal SITE_URL (tests/unit/wrangler-config.test.ts)
      siteUrl: 'http://localhost:3000',
      // Base of public media URLs (base + "/" + R2 key); NUXT_PUBLIC_MEDIA_BASE_URL must equal MEDIA_BASE_URL
      mediaBaseUrl: 'http://localhost:3000',
    },
  },

  // ADR-0003 §2: APIs are never stored; the admin is private and never indexed. Public pages get their policy in
  // server/plugins/cache-policy.ts
  routeRules: {
    '/api/**': { headers: { 'cache-control': 'no-store' } },
    '/api/admin/**': { headers: { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' } },
    // Admin SPA (F03-T5): the HTML is a shell with no data; everything comes from /api/admin after sign-in
    '/admin/**': { ssr: false, headers: { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' } },
    // Prerendered i18n messages: the path carries a hash of the locale files, so a change means a new URL
    '/_i18n/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } },
    // Font files live under a versioned path (shared/design/fonts.ts), so they never change in place
    '/fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } },
    // Static assets bypass the Worker's security headers; these land in _headers (ADR-0012 §1). A CSP on a script
    // response only takes effect when it runs as a Web Worker: the admin image pipeline (F04-T2) may compile its
    // WASM codecs and fetch them from this site, and nothing else; pages keep their own hash-based policy
    '/_nuxt/**': { headers: { 'x-content-type-options': 'nosniff', 'content-security-policy': WORKER_CSP } },
  },

  // The Cloudflare date is capped by the pinned workerd (1.20261019.1); keep it equal to wrangler.jsonc
  compatibilityDate: { default: '2026-10-25', cloudflare: '2026-10-19' },

  // ADR-0002 §2: Workers with Static Assets; bindings come from wrangler.jsonc
  nitro: {
    preset: 'cloudflare_module',
    // A polyfill imported only for its side effect (server/utils/auth.ts); without this Rollup drops it
    moduleSideEffects: ['reflect-metadata'],
    // TEST_AUTH: fakes GitHub's OAuth APIs for the Playwright build only (server/_test/github-mock.ts)
    plugins: process.env.PORTFOLIO_TEST_BUILD === '1' ? [fileURLToPath(new URL('./server/_test/github-mock.ts', import.meta.url))] : [],
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
    },
    // Cron jobs run as Nitro tasks from the Worker's scheduled handler. One trigger every 5 minutes in preview and
    // production (wrangler.jsonc, environments.md); a task that needs less often decides inside itself (F06-T2)
    experimental: { tasks: true },
    scheduledTasks: {
      '*/5 * * * *': ['content:prune-autosaves'],
    },
  },

  vite: {
    plugins: [tailwindcss()],
    // F04-T2: the admin image pipeline runs as an ES module worker; the codecs find their .wasm through
    // import.meta.url, which the dev pre-bundler would break
    worker: { format: 'es' },
    optimizeDeps: { exclude: ['@jsquash/avif', '@jsquash/jpeg', '@jsquash/resize', '@jsquash/webp'] },
  },

  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
      },
    },
    // Binding types generated by `pnpm cf:types` from wrangler.jsonc
    serverTsConfig: {
      include: ['../worker-configuration.d.ts'],
    },
  },

  hooks: {
    // The content renderer never hydrates (StaticContent, F05-T4), so a first visit must not fetch its chunk, not
    // even as an idle prefetch. Nuxt drops hints for never-hydrated modules only when it renders from the client
    // manifest, and production renders from precomputed dependencies, so the chunk is unflagged here instead.
    // A client-side navigation still loads it on demand
    'build:manifest': (manifest) => {
      const renderer = manifest['components/content/ContentRenderer.vue']
      if (renderer) {
        renderer.prefetch = false
        renderer.preload = false
      }
    },
  },

  // ADR-0002 §6: ESLint flat config with stylistic formatting, no Prettier
  eslint: {
    config: {
      stylistic: true,
    },
  },

  // ADR-0010 §4: vendored files only (shared/design/fonts.ts). Remote providers are off, so neither the build nor
  // the visitor ever fetches a font from a third party; @nuxt/fonts writes the @font-face rules and the
  // metric-matched fallbacks (size-adjust) for --font-*. No preload: the fonts load after `load` (fonts.ts)
  fonts: {
    families: FONT_FAMILIES.flatMap(family => fontFaces(family).map(face => ({
      name: family.name,
      src: face.src,
      weight: face.weight,
      style: face.style,
      unicodeRange: face.unicodeRange,
      display: 'swap' as const,
      fallbacks: [...family.fallbacks],
    }))),
    defaults: { preload: false },
    providers: { adobe: false, bunny: false, fontshare: false, fontsource: false, google: false, googleicons: false, npm: false },
    experimental: {
      // No local('…') sources: a visitor's installed copy may lack the axes we ship
      disableLocalFallbacks: true,
    },
  },

  // ADR-0008 §1 and docs/architecture/i18n-seo.md: pt-BR at the root, translated paths in definePageMeta,
  // no browser detection (no cookie, no redirect), so every public response stays cacheable
  i18n: {
    strategy: 'prefix_except_default',
    defaultLocale: 'pt-BR',
    customRoutes: 'meta',
    detectBrowserLanguage: false,
    // Names are autonyms: each language is listed in its own language, on every page
    locales: [
      { code: 'pt-BR', language: 'pt-BR', name: 'Português (Brasil)', file: 'pt-BR.json' },
      { code: 'en', language: 'en', name: 'English', file: 'en.json' },
      { code: 'es', language: 'es', name: 'Español', file: 'es.json' },
      { code: 'de', language: 'de', name: 'Deutsch', file: 'de.json' },
      { code: 'fr', language: 'fr', name: 'Français', file: 'fr.json' },
    ],
    // No <i18n-t> component or v-t directive (unused); the message compiler stays, since messages arrive as JSON
    bundle: { fullInstall: false },
    experimental: {
      // The client always fetches the active locale's messages on hydration. Prerendered, they are static assets
      // at /_i18n/<content-hash>/<locale>/messages.json: served by Static Assets without running the Worker
      prerenderMessages: true,
    },
  },
})
