// @ts-check
// Folder boundaries from ADR-0002 and .claude/skills/architecture-guardian/references/boundaries.md.
// When two configs match the same file, flat config replaces a rule's options instead of merging
// them, so every scope below is disjoint and lists all the restrictions that apply to it.
import withNuxt from './.nuxt/eslint.config.mjs'

const CODE = '**/*.{js,mjs,cjs,ts,mts,cts,tsx,vue}'
const ADMIN_AREAS = ['app/**/admin/**', 'app/pages/admin/**', 'app/workers/**']
const MOTION_AREAS = ['app/composables/motion/**', 'app/components/motion/**']

const inside = (...dirs) => dirs.map(dir => `${dir}/${CODE}`)
// Patterns use gitignore syntax, where a leading # starts a comment: Nuxt's #aliases need escaping
const alias = (...names) => names.map(name => `\\${name}`)

const SERVER = {
  group: [...alias('#server', '#server/**'), '**/server', '**/server/**'],
  message: 'app/ não importa server/: o que for comum aos dois vai para shared/.',
}
const APP = {
  group: ['~', '~/**', '@', '@/**', ...alias('#app', '#app/**', '#components', '#vue-router'), '**/app', '**/app/**'],
  message: 'server/ não importa app/: o servidor não depende de código Vue.',
}
const ADMIN = {
  group: ['**/admin', '**/admin/**'],
  message: 'Código público não importa admin/: o admin é uma SPA separada (ADR-0003).',
}
const EDITOR_ONLY = {
  group: ['@tiptap/**', 'shiki', 'shiki/**', '@shikijs/**', '@jsquash/**'],
  message: 'Tiptap, Shiki e codecs WASM são só do admin; o público recebe HAST e variantes prontas (ADR-0006, ADR-0007).',
}
const MOTION = {
  group: ['gsap', 'gsap/**', 'three', 'three/**'],
  allowTypeImports: true,
  message: 'gsap e three só entram por import() dinâmico em app/composables/motion/** ou app/components/motion/** (ADR-0011).',
}
const DB_SCHEMA = {
  group: ['**/db/schema', '**/db/schema/**'],
  message: 'Handlers não usam o schema: as queries ficam nos *.repo.ts de server/services/**.',
}
const IMPURE = {
  group: [
    'vue', 'vue/**', '@vue/**', 'vue-router', 'h3', 'nitropack', 'nitropack/**', 'nitro', 'nitro/**', 'nuxt', 'nuxt/**',
    ...alias('#vue-router', '#imports', '#app', '#app/**', '#components', '#build', '#build/**', '#internal/**'),
    'cloudflare:*', '@cloudflare/**',
  ],
  message: 'shared/ é isomórfico: sem Vue, h3, Nitro, Nuxt nem bindings da Cloudflare.',
}
const OUTSIDE_SHARED = {
  group: ['~', '~/**', '@', '@/**', ...alias('#server', '#server/**'), '**/app', '**/app/**', '**/server', '**/server/**'],
  message: 'shared/ só importa shared/** e bibliotecas puras.',
}

// no-restricted-imports does not see import(); these selectors close that gap
const dynamicImport = (pattern, message) => ({ selector: `ImportExpression[source.value=${pattern}]`, message })
const DYNAMIC = {
  server: dynamicImport(String.raw`/^#server(?:\/|$)|(?:^|\/)server(?:\/|$)/`, SERVER.message),
  app: dynamicImport(String.raw`/^(?:~|@|#app|#components)(?:\/|$)|(?:^|\/)app(?:\/|$)/`, APP.message),
  admin: dynamicImport(String.raw`/(?:^|\/)admin(?:\/|$)/`, ADMIN.message),
  editorOnly: dynamicImport(String.raw`/^(?:@tiptap\/|shiki(?:\/|$)|@shikijs\/|@jsquash\/)/`, EDITOR_ONLY.message),
  motion: dynamicImport(String.raw`/^(?:gsap|three)(?:\/|$)/`, MOTION.message),
}

// Nuxt auto-registers app/components/admin/Foo.vue as <AdminFoo>, which no import rule can see
const ADMIN_COMPONENT = {
  selector: String.raw`VElement[rawName=/^(?:Lazy)?Admin[A-Z]|^(?:lazy-)?admin-/]`,
  message: ADMIN.message,
}

const SHARED_GLOBALS = ['process', 'window', 'document', 'navigator', 'localStorage', 'sessionStorage']

/**
 * @param {string} name
 * @param {{ files: string[], ignores?: string[], imports: object[], syntax?: object[], rules?: object }} scope
 */
function boundary(name, { files, ignores = [], imports, syntax = [], rules = {} }) {
  return {
    name: `portfolio/boundaries/${name}`,
    files,
    ignores,
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: imports }],
      'no-restricted-syntax': ['error', ...syntax],
      ...rules,
    },
  }
}

export default withNuxt(
  boundary('app-public', {
    files: inside('app'),
    ignores: [...ADMIN_AREAS, ...MOTION_AREAS],
    imports: [SERVER, ADMIN, EDITOR_ONLY, MOTION],
    syntax: [DYNAMIC.server, DYNAMIC.admin, DYNAMIC.editorOnly, DYNAMIC.motion],
    rules: { 'vue/no-restricted-syntax': ['error', ADMIN_COMPONENT] },
  }),
  boundary('app-motion', {
    files: MOTION_AREAS,
    imports: [SERVER, ADMIN, EDITOR_ONLY, MOTION],
    syntax: [DYNAMIC.server, DYNAMIC.admin, DYNAMIC.editorOnly],
    rules: { 'vue/no-restricted-syntax': ['error', ADMIN_COMPONENT] },
  }),
  boundary('app-admin', {
    files: ADMIN_AREAS,
    imports: [SERVER, MOTION],
    syntax: [DYNAMIC.server, DYNAMIC.motion],
  }),
  boundary('server', {
    files: inside('server'),
    ignores: ['server/api/**'],
    imports: [APP],
    syntax: [DYNAMIC.app],
  }),
  boundary('server-api', {
    files: inside('server/api'),
    imports: [APP, DB_SCHEMA],
    syntax: [DYNAMIC.app],
  }),
  boundary('shared', {
    files: inside('shared'),
    imports: [IMPURE, OUTSIDE_SHARED],
    rules: {
      'no-restricted-globals': ['error', ...SHARED_GLOBALS.map(name => ({
        name,
        message: 'shared/ é isomórfico: receba esse valor por parâmetro.',
      }))],
    },
  }),
)
