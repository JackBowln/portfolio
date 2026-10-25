<script setup lang="ts">
// Dev-only page (F01-T1): `$production.ignore` in nuxt.config keeps it out of production builds.
// The @fontsource packages are temporary devDependencies; F01-T3 replaces them with @nuxt/fonts.
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/inter/wght-italic.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/instrument-sans/index.css'
import '@fontsource-variable/instrument-sans/wght-italic.css'
import '@fontsource-variable/geist-mono/index.css'
import '~/assets/css/styleguide-variants.css'
import { AA_MINIMUM, contrastRatio, isInSrgbGamut, meetsAA } from '#shared/design/contrast'
import type { ContrastUse, Oklch } from '#shared/design/contrast'

type VariantId = 'a' | 'b'
type ThemeName = 'light' | 'dark'
type ColorToken = 'bg' | 'surface' | 'text' | 'text-muted' | 'border' | 'link' | 'accent' | 'accent-contrast' | 'focus'
type QueryState = Partial<Record<'type' | 'palette' | 'theme', string | undefined>>

interface PaletteTheme {
  colors: Record<ColorToken, Oklch>
  note?: string
}

interface Palette {
  name: string
  reference: string
  themes: Record<ThemeName, PaletteTheme>
}

interface FontFile {
  axes: string
  kb: number
}

interface FontFact {
  role: string
  family: string
  pkg: string
  files: readonly FontFile[]
}

interface TypePairing {
  short: string
  name: string
  reference: string
  fonts: readonly FontFact[]
  preload: readonly { label: string, kb: readonly number[] }[]
}

interface TypeStep {
  step: number
  minPx: number
  maxPx: number
  leading: number
}

interface ContrastPair {
  foreground: ColorToken
  background: ColorToken
  use: ContrastUse
}

const VARIANTS = ['a', 'b'] as const satisfies readonly VariantId[]
const THEMES = ['light', 'dark'] as const satisfies readonly ThemeName[]

// Direction chosen on 2026-10-25 (design-direction §9): type pairing A with palette B
const CHOSEN_TYPE: VariantId = 'a'
const CHOSEN_PALETTE: VariantId = 'b'

const PALETTES: Record<VariantId, Palette> = {
  a: {
    name: 'Papel e marca-texto',
    reference: 'ingrassiadaniel.it',
    themes: {
      light: {
        colors: {
          'bg': { l: 0.965, c: 0.006, h: 135 },
          'surface': { l: 0.93, c: 0.008, h: 135 },
          'text': { l: 0.24, c: 0.008, h: 135 },
          'text-muted': { l: 0.5, c: 0.012, h: 140 },
          'border': { l: 0.62, c: 0.01, h: 140 },
          'link': { l: 0.24, c: 0.008, h: 135 },
          'accent': { l: 0.87, c: 0.17, h: 96 },
          'accent-contrast': { l: 0.24, c: 0.008, h: 135 },
          'focus': { l: 0.46, c: 0.085, h: 96 },
        },
        note: 'No claro, o amarelo só preenche (botão, marca-texto no hover): sobre o papel ele fica abaixo de 3:1. Os links usam a tinta, sublinhados, e o foco usa um oliva derivado do acento.',
      },
      dark: {
        colors: {
          'bg': { l: 0.19, c: 0.006, h: 135 },
          'surface': { l: 0.24, c: 0.008, h: 135 },
          'text': { l: 0.95, c: 0.006, h: 110 },
          'text-muted': { l: 0.72, c: 0.01, h: 130 },
          'border': { l: 0.52, c: 0.01, h: 135 },
          'link': { l: 0.87, c: 0.17, h: 96 },
          'accent': { l: 0.87, c: 0.17, h: 96 },
          'accent-contrast': { l: 0.19, c: 0.006, h: 135 },
          'focus': { l: 0.87, c: 0.17, h: 96 },
        },
      },
    },
  },
  b: {
    name: 'Noite e rosa',
    reference: 'junkbranding.com',
    themes: {
      light: {
        colors: {
          'bg': { l: 0.955, c: 0.012, h: 75 },
          'surface': { l: 0.915, c: 0.015, h: 75 },
          'text': { l: 0.21, c: 0.03, h: 250 },
          'text-muted': { l: 0.48, c: 0.03, h: 245 },
          'border': { l: 0.6, c: 0.025, h: 245 },
          'link': { l: 0.52, c: 0.17, h: 358 },
          'accent': { l: 0.52, c: 0.17, h: 358 },
          'accent-contrast': { l: 0.97, c: 0.01, h: 75 },
          'focus': { l: 0.52, c: 0.17, h: 358 },
        },
        note: 'No claro, o rosa escurece para funcionar como texto e foco; o rosa vivo fica para o tema escuro.',
      },
      dark: {
        colors: {
          'bg': { l: 0.16, c: 0.03, h: 250 },
          'surface': { l: 0.22, c: 0.035, h: 235 },
          'text': { l: 0.94, c: 0.012, h: 75 },
          'text-muted': { l: 0.74, c: 0.025, h: 240 },
          'border': { l: 0.5, c: 0.035, h: 240 },
          'link': { l: 0.81, c: 0.115, h: 355 },
          'accent': { l: 0.81, c: 0.115, h: 355 },
          'accent-contrast': { l: 0.16, c: 0.03, h: 250 },
          'focus': { l: 0.81, c: 0.115, h: 355 },
        },
      },
    },
  },
}

// Latin WOFF2 sizes measured in the 5.3.0 packages (2026-10-25)
const TYPE_PAIRINGS: Record<VariantId, TypePairing> = {
  a: {
    short: 'Fraunces + Inter',
    name: 'Fraunces + Inter + JetBrains Mono',
    reference: 'par A da design-direction §3',
    fonts: [
      {
        role: 'Display',
        family: 'Fraunces',
        pkg: '@fontsource-variable/fraunces',
        files: [
          { axes: 'opsz, SOFT, WONK e wght (esta página)', kb: 118.2 },
          { axes: 'opsz e wght', kb: 65.7 },
          { axes: 'wght', kb: 35.8 },
        ],
      },
      { role: 'Texto e UI', family: 'Inter', pkg: '@fontsource-variable/inter', files: [{ axes: 'wght', kb: 47.1 }] },
      { role: 'Código e rótulos', family: 'JetBrains Mono', pkg: '@fontsource-variable/jetbrains-mono', files: [{ axes: 'wght', kb: 39.5 }] },
    ],
    preload: [
      { label: 'Fraunces (opsz e wght) + Inter', kb: [65.7, 47.1] },
      { label: 'Fraunces completa + Inter', kb: [118.2, 47.1] },
    ],
  },
  b: {
    short: 'Instrument',
    name: 'Instrument Serif + Instrument Sans + Geist Mono',
    reference: 'junkbranding.com usa a Instrument Serif',
    fonts: [
      { role: 'Display', family: 'Instrument Serif', pkg: '@fontsource/instrument-serif', files: [{ axes: '400 estática (itálico em arquivo à parte)', kb: 20.5 }] },
      { role: 'Texto e UI', family: 'Instrument Sans', pkg: '@fontsource-variable/instrument-sans', files: [{ axes: 'wght', kb: 29.4 }] },
      { role: 'Código e rótulos', family: 'Geist Mono', pkg: '@fontsource-variable/geist-mono', files: [{ axes: 'wght', kb: 22.6 }] },
    ],
    preload: [
      { label: 'Instrument Serif + Instrument Sans', kb: [20.5, 29.4] },
    ],
  },
}

// performance-budgets §4: at most 2 font files and 120 KB on the first screen
const FONT_BUDGET_KB = 120
const FONT_BUDGET_FILES = 2

const TYPE_SCALE: readonly TypeStep[] = [
  { step: -1, minPx: 13, maxPx: 14, leading: 1.5 },
  { step: 0, minPx: 17, maxPx: 20, leading: 1.65 },
  { step: 1, minPx: 20, maxPx: 24, leading: 1.5 },
  { step: 2, minPx: 24, maxPx: 32, leading: 1.3 },
  { step: 3, minPx: 28, maxPx: 42, leading: 1.2 },
  { step: 4, minPx: 34, maxPx: 56, leading: 1.1 },
  { step: 5, minPx: 40, maxPx: 76, leading: 1.05 },
  { step: 6, minPx: 48, maxPx: 104, leading: 1 },
  { step: 7, minPx: 56, maxPx: 160, leading: 0.95 },
]
const FLUID_VIEWPORT = { minPx: 360, maxPx: 1440 } as const
const ROOT_PX = 16
const DISPLAY_FROM_STEP = 3

const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { foreground: 'text', background: 'bg', use: 'text' },
  { foreground: 'text', background: 'surface', use: 'text' },
  { foreground: 'text-muted', background: 'bg', use: 'text' },
  { foreground: 'text-muted', background: 'surface', use: 'text' },
  { foreground: 'link', background: 'bg', use: 'text' },
  { foreground: 'link', background: 'surface', use: 'text' },
  { foreground: 'accent-contrast', background: 'accent', use: 'text' },
  { foreground: 'accent', background: 'bg', use: 'ui' },
  { foreground: 'focus', background: 'bg', use: 'ui' },
  { foreground: 'focus', background: 'surface', use: 'ui' },
  { foreground: 'border', background: 'bg', use: 'ui' },
]

const USE_LABEL: Record<ContrastUse, string> = {
  'text': 'texto',
  'large-text': 'texto grande',
  'ui': 'UI',
}

const THEME_LABEL: Record<ThemeName, string> = {
  light: 'Claro',
  dark: 'Escuro',
}

// [PLACEHOLDER] until the owner provides real copy
const SAMPLE = {
  source: 'Machado de Assis, Dom Casmurro, cap. I (Rio de Janeiro: H. Garnier, 1899), via Wikisource. Domínio público, ortografia original.',
  title: 'Dom Casmurro',
  chapter: 'Do titulo',
  nextChapter: 'Do livro',
  opening: 'Uma noite destas, vindo da cidade para o Engenho Novo',
  paragraphs: [
    'Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central um rapaz aqui do bairro, que eu conheço de vista e de chapéo. Comprimentou-me, sentou-se ao pé de mim, falou da lua e dos ministros, e acabou recitando-me versos. A viagem era curta, e os versos pôde ser que não fossem inteiramente maus. Succedeu, porém, que como eu estava cançado, fechei os olhos tres ou quatro vezes; tanto bastou para que elle interrompesse a leitura e mettesse os versos no bolso.',
    '— Continue, disse eu accordando.',
    '— Já acabei, murmurou elle.',
    '— São muito bonitos.',
    'Vi-lhe fazer um gesto para tiral-os outra vez do bolso, mas não passou do gesto; estava amuado. No dia seguinte entrou a dizer de mim nomes feios, e acabou alcunhando-me Dom Casmurro. Os visinhos, que não gostam dos meus hábitos reclusos e calados, deram curso á alcunha, que afinal pegou. Nem por isso me zanguei. Contei a anecdota aos amigos da cidade, e elles, por graça, chamam-me assim, alguns em bilhetes: «Dom Casmurro, domingo vou jantar com você.» — «Vou para Petropolis, Dom Casmurro; a casa é a mesma da Rhenania; vê se deixas essa caverna do Engenho Novo, e vae lá passar uns quinze dias commigo.» — «Meu caro Dom Casmurro, não cuide que o dispenso do theatro amanhã; venha e dormirá aqui na cidade; dou-lhe camarote, dou-lhe chá, dou-lhe cama; só não lhe dou moça.»',
  ],
}

const HEADING_SPECIMENS = [
  { level: 'H1', step: 6, display: true, text: SAMPLE.title },
  { level: 'H2', step: 4, display: true, text: SAMPLE.chapter },
  { level: 'H3', step: 3, display: true, text: SAMPLE.nextChapter },
  { level: 'H4', step: 1, display: false, text: SAMPLE.opening },
] as const

const DISPLAY_AXES = [
  { label: 'Padrão (opsz automático)', settings: 'normal' },
  { label: 'SOFT 100', settings: '"SOFT" 100' },
  { label: 'WONK 1', settings: '"WONK" 1' },
  { label: 'SOFT 100 + WONK 1', settings: '"SOFT" 100, "WONK" 1' },
] as const

const PANGRAMS = [
  { lang: 'pt-BR', label: 'Português', text: 'À noite, vovô Kowalsky vê o ímã cair no pé do pinguim queixoso e vovó põe açúcar no chá de tâmaras do jabuti feliz.' },
  { lang: 'es', label: 'Español', text: 'El veloz murciélago hindú comía feliz cardillo y kiwi. La cigüeña tocaba el saxofón detrás del palenque de paja.' },
  { lang: 'de', label: 'Deutsch', text: 'Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich.' },
  { lang: 'fr', label: 'Français', text: 'Voix ambiguë d’un cœur qui, au zéphyr, préfère les jattes de kiwis.' },
  { lang: 'en', label: 'English', text: 'The quick brown fox jumps over the lazy dog.' },
] as const

const CODE_SAMPLE = `export interface HealthStatus {
  status: 'ok'
  version: string
}

export function getHealth(version: string): HealthStatus {
  return { status: 'ok', version }
}`

const CARD_DATE = '2026-10-25'

const ratioFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const kbFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const leadingFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const cardDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${CARD_DATE}T00:00:00Z`))

// Truncated, so a ratio just under the AA minimum never displays as passing
const formatRatio = (ratio: number) => `${ratioFormat.format(Math.floor(ratio * 100) / 100)}:1`
const formatKb = (kb: number) => `${kbFormat.format(kb)} KB`
const round = (value: number) => Number(value.toFixed(4))

function fluidSize({ minPx, maxPx }: TypeStep): string {
  const slope = (maxPx - minPx) / (FLUID_VIEWPORT.maxPx - FLUID_VIEWPORT.minPx)
  const intercept = minPx - slope * FLUID_VIEWPORT.minPx
  return `clamp(${round(minPx / ROOT_PX)}rem, ${round(intercept / ROOT_PX)}rem + ${round(slope * 100)}vw, ${round(maxPx / ROOT_PX)}rem)`
}

function toCss({ l, c, h }: Oklch): string {
  return `oklch(${l} ${c} ${h})`
}

function declarations(entries: readonly (readonly [string, string])[]): string {
  return entries.map(([name, value]) => `${name}:${value};`).join('')
}

function colorDeclarations(theme: ThemeName, colors: Record<ColorToken, Oklch>): string {
  const tokens = Object.keys(colors) as ColorToken[]
  return declarations([...tokens.map(token => [`--color-${token}`, toCss(colors[token])] as const), ['color-scheme', theme]])
}

// System theme by default; `data-theme` on <html> forces one; `data-sg-panel` pins a panel to a theme
function paletteCss(id: VariantId): string {
  const scope = `html[data-sg][data-palette="${id}"]`
  const { light, dark } = PALETTES[id].themes
  return [
    `${scope},${scope} [data-sg-panel="light"]{${colorDeclarations('light', light.colors)}}`,
    `@media (prefers-color-scheme: dark){${scope}:not([data-theme="light"]){${colorDeclarations('dark', dark.colors)}}}`,
    `${scope}[data-theme="dark"],${scope} [data-sg-panel="dark"]{${colorDeclarations('dark', dark.colors)}}`,
  ].join('\n')
}

const typeScaleCss = `html[data-sg]{${declarations(TYPE_SCALE.flatMap(step => [
  [`--text-step-${step.step}`, fluidSize(step)] as const,
  [`--leading-step-${step.step}`, String(step.leading)] as const,
]))}}`

const TOKENS_CSS = [typeScaleCss, ...VARIANTS.map(paletteCss)].join('\n')

const SCALE_ROWS = TYPE_SCALE.toReversed().map(step => ({
  ...step,
  range: `${step.minPx}–${step.maxPx} px`,
  leadingLabel: leadingFormat.format(step.leading),
  display: step.step >= DISPLAY_FROM_STEP,
}))

function stepStyle(step: number) {
  return { fontSize: `var(--text-step-${step})`, lineHeight: `var(--leading-step-${step})` }
}

function pick<T extends string>(value: unknown, options: readonly T[]): T | undefined {
  return options.find(option => option === value)
}

const route = useRoute()
const type = computed<VariantId>(() => pick(route.query.type, VARIANTS) ?? CHOSEN_TYPE)
const explicitPalette = computed(() => pick(route.query.palette, VARIANTS))
const palette = computed<VariantId>(() => explicitPalette.value ?? CHOSEN_PALETTE)
const theme = computed(() => pick(route.query.theme, THEMES))

// Plain links with a query string: works without JS and keeps aria-current accurate
function hrefWith(change: QueryState): string {
  const state: QueryState = { type: type.value, palette: explicitPalette.value, theme: theme.value, ...change }
  const entries = Object.entries(state).filter((entry): entry is [string, string] => entry[1] !== undefined)
  return `?${new URLSearchParams(entries).toString()}`
}

const controls = computed(() => [
  {
    id: 'type',
    label: 'Tipografia',
    options: VARIANTS.map(id => ({
      label: `${id.toUpperCase()} · ${TYPE_PAIRINGS[id].short}${id === CHOSEN_TYPE ? ' · escolhida' : ''}`,
      href: hrefWith({ type: id }),
      current: type.value === id,
    })),
  },
  {
    id: 'palette',
    label: 'Paleta',
    options: VARIANTS.map(id => ({
      label: `${id.toUpperCase()} · ${PALETTES[id].name}${id === CHOSEN_PALETTE ? ' · escolhida' : ''}`,
      href: hrefWith({ palette: id }),
      current: palette.value === id,
    })),
  },
  {
    id: 'theme',
    label: 'Tema',
    options: [
      { label: 'Sistema', href: hrefWith({ theme: undefined }), current: theme.value === undefined },
      ...THEMES.map(id => ({ label: THEME_LABEL[id], href: hrefWith({ theme: id }), current: theme.value === id })),
    ],
  },
])

const pairing = computed(() => TYPE_PAIRINGS[type.value])

const preloadRows = computed(() => pairing.value.preload.map((estimate) => {
  const total = estimate.kb.reduce((sum, kb) => sum + kb, 0)
  return {
    label: estimate.label,
    total: formatKb(total),
    withinBudget: estimate.kb.length <= FONT_BUDGET_FILES && total <= FONT_BUDGET_KB,
  }
}))

const contrastPanels = computed(() => THEMES.map((themeName) => {
  const { colors, note } = PALETTES[palette.value].themes[themeName]
  const tokens = Object.keys(colors) as ColorToken[]
  return {
    theme: themeName,
    label: THEME_LABEL[themeName],
    note,
    swatches: tokens.map(token => ({ token, value: toCss(colors[token]), inGamut: isInSrgbGamut(colors[token]) })),
    rows: CONTRAST_PAIRS.map((pair) => {
      const ratio = contrastRatio(colors[pair.foreground], colors[pair.background])
      return {
        ...pair,
        key: `${pair.foreground}-${pair.background}`,
        ratio: formatRatio(ratio),
        minimum: formatRatio(AA_MINIMUM[pair.use]),
        passes: meetsAA(ratio, pair.use),
      }
    }),
  }
}))

useHead({
  title: 'Styleguide (dev)',
  htmlAttrs: {
    'data-sg': '',
    'data-type': type,
    'data-palette': palette,
    'data-theme': theme,
  },
  style: [{ key: 'sg-tokens', textContent: TOKENS_CSS }],
})
</script>

<template>
  <div class="sg">
    <header class="sg-header">
      <p class="sg-eyebrow">
        F01-T1 · só em desenvolvimento
      </p>
      <h1 class="sg-title">
        Styleguide
      </h1>
      <p class="sg-lede">
        Duas direções candidatas, a partir da design-direction e das referências. Tipografia e paleta trocam separadamente; o tema segue o sistema até você escolher um.
      </p>
      <nav class="sg-controls" aria-label="Controles da styleguide">
        <div v-for="control in controls" :key="control.id">
          <p :id="`sg-control-${control.id}`" class="sg-eyebrow">
            {{ control.label }}
          </p>
          <ul class="sg-control__options" :aria-labelledby="`sg-control-${control.id}`">
            <li v-for="option in control.options" :key="option.href">
              <a class="sg-option" :href="option.href" :aria-current="option.current ? 'true' : undefined">{{ option.label }}</a>
            </li>
          </ul>
        </div>
      </nav>
    </header>

    <main>
      <section class="sg-section" aria-labelledby="sg-scale">
        <p class="sg-eyebrow">
          01
        </p>
        <h2 id="sg-scale" class="sg-section__title">
          Escala tipográfica
        </h2>
        <p class="sg-note">
          {{ pairing.name }}. Tamanhos fluidos entre {{ FLUID_VIEWPORT.minPx }} e {{ FLUID_VIEWPORT.maxPx }} px de largura; display a partir do passo {{ DISPLAY_FROM_STEP }}.
        </p>
        <ul class="sg-scale">
          <li v-for="step in SCALE_ROWS" :key="step.step" class="sg-scale__row">
            <p class="sg-eyebrow">
              Passo {{ step.step }} · {{ step.range }} · entrelinha {{ step.leadingLabel }}
            </p>
            <p class="sg-specimen" :class="step.display ? 'sg-font-display' : 'sg-font-sans'" :style="stepStyle(step.step)">
              {{ step.display ? SAMPLE.title : SAMPLE.opening }}
            </p>
          </li>
        </ul>
      </section>

      <section class="sg-section" aria-labelledby="sg-headings">
        <p class="sg-eyebrow">
          02
        </p>
        <h2 id="sg-headings" class="sg-section__title">
          Títulos
        </h2>
        <div class="sg-specimens">
          <div v-for="heading in HEADING_SPECIMENS" :key="heading.level" class="sg-scale__row">
            <p class="sg-eyebrow">
              {{ heading.level }} · {{ heading.display ? 'display' : 'sans' }} · passo {{ heading.step }}
            </p>
            <p class="sg-specimen" :class="heading.display ? 'sg-font-display' : 'sg-font-sans sg-specimen--strong'" :style="stepStyle(heading.step)">
              {{ heading.text }}
            </p>
          </div>
        </div>
        <template v-if="type === 'a'">
          <p class="sg-eyebrow">
            Eixos variáveis da Fraunces
          </p>
          <ul class="sg-axes">
            <li v-for="axis in DISPLAY_AXES" :key="axis.label" class="sg-scale__row">
              <p class="sg-eyebrow">
                {{ axis.label }}
              </p>
              <p class="sg-specimen sg-font-display" :style="{ ...stepStyle(5), fontVariationSettings: axis.settings }">
                {{ SAMPLE.title }}
              </p>
            </li>
          </ul>
        </template>
      </section>

      <section class="sg-section" aria-labelledby="sg-text">
        <p class="sg-eyebrow">
          03
        </p>
        <h2 id="sg-text" class="sg-section__title">
          Texto corrido
        </h2>
        <div class="sg-prose">
          <p v-for="paragraph in SAMPLE.paragraphs" :key="paragraph">
            {{ paragraph }}
          </p>
          <p>
            [PLACEHOLDER] Frase de teste com <a class="sg-link" href="#sg-colors">um link</a>, um termo em <em>itálico</em>, um <strong>destaque</strong> e código inline como <code class="sg-mono">getHealth()</code>.
          </p>
          <p class="sg-note">
            [PLACEHOLDER] Texto de exemplo: {{ SAMPLE.source }}
          </p>
        </div>
      </section>

      <section class="sg-section" aria-labelledby="sg-code">
        <p class="sg-eyebrow">
          04
        </p>
        <h2 id="sg-code" class="sg-section__title">
          Bloco de código
        </h2>
        <figure class="sg-figure">
          <div class="sg-code" role="region" tabindex="0" aria-label="Exemplo de código em TypeScript">
            <pre><code>{{ CODE_SAMPLE }}</code></pre>
          </div>
          <figcaption class="sg-note">
            server/services/health/health.service.ts
          </figcaption>
        </figure>
      </section>

      <section class="sg-section" aria-labelledby="sg-components">
        <p class="sg-eyebrow">
          05
        </p>
        <h2 id="sg-components" class="sg-section__title">
          Card, botões e links
        </h2>
        <div class="sg-components">
          <article class="sg-card">
            <p class="sg-eyebrow">
              [PLACEHOLDER] Tema
            </p>
            <h3 class="sg-card__title">
              <a href="#sg-text">[PLACEHOLDER] Título de um artigo</a>
            </h3>
            <p class="sg-card__meta">
              <time :datetime="CARD_DATE">{{ cardDate }}</time>
            </p>
          </article>
          <div class="sg-buttons">
            <button type="button" class="sg-button sg-button--primary">
              Primário
            </button>
            <button type="button" class="sg-button sg-button--secondary">
              Secundário
            </button>
            <button type="button" class="sg-button sg-button--primary" disabled>
              Desabilitado
            </button>
          </div>
          <p class="sg-note">
            Passe o mouse ou use Tab para ver hover e foco.
          </p>
          <p>
            <a class="sg-link" href="#sg-colors">Ir para cores e contraste</a>
          </p>
        </div>
      </section>

      <section class="sg-section" aria-labelledby="sg-colors">
        <p class="sg-eyebrow">
          06
        </p>
        <h2 id="sg-colors" class="sg-section__title">
          Cores e contraste
        </h2>
        <p class="sg-note">
          Paleta {{ palette.toUpperCase() }} · {{ PALETTES[palette].name }}, inspirada em {{ PALETTES[palette].reference }}. Mínimos AA: texto 4,5:1; UI 3:1.
        </p>
        <div class="sg-panels">
          <section
            v-for="panel in contrastPanels"
            :key="panel.theme"
            class="sg-panel"
            :data-sg-panel="panel.theme"
            :aria-labelledby="`sg-panel-${panel.theme}`"
          >
            <h3 :id="`sg-panel-${panel.theme}`" class="sg-panel__title">
              {{ panel.label }}
            </h3>
            <ul class="sg-swatches">
              <li v-for="swatch in panel.swatches" :key="swatch.token" class="sg-swatch">
                <span class="sg-swatch__chip" aria-hidden="true" :style="{ background: `var(--color-${swatch.token})` }" />
                <code class="sg-mono">{{ swatch.token }}</code>
                <span class="sg-mono sg-swatch__value">{{ swatch.value }}</span>
                <strong v-if="!swatch.inGamut">fora do gamut sRGB</strong>
              </li>
            </ul>
            <div class="sg-table-wrap" role="region" tabindex="0" :aria-label="`Contraste no tema ${panel.label.toLowerCase()}`">
              <table class="sg-table">
                <thead>
                  <tr>
                    <th scope="col">
                      Par
                    </th>
                    <th scope="col">
                      Uso
                    </th>
                    <th scope="col">
                      Razão
                    </th>
                    <th scope="col">
                      AA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in panel.rows" :key="row.key">
                    <td><code class="sg-mono">{{ row.foreground }}</code> × <code class="sg-mono">{{ row.background }}</code></td>
                    <td>{{ USE_LABEL[row.use] }} (≥ {{ row.minimum }})</td>
                    <td>{{ row.ratio }}</td>
                    <td>{{ row.passes ? '✓ passa' : '✗ não passa' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="panel.note" class="sg-note">
              {{ panel.note }}
            </p>
          </section>
        </div>
      </section>

      <section class="sg-section" aria-labelledby="sg-languages">
        <p class="sg-eyebrow">
          07
        </p>
        <h2 id="sg-languages" class="sg-section__title">
          Diacríticos nos 5 idiomas
        </h2>
        <dl class="sg-languages">
          <div v-for="pangram in PANGRAMS" :key="pangram.lang" class="sg-language">
            <dt class="sg-eyebrow" :lang="pangram.lang">
              {{ pangram.label }}
            </dt>
            <dd :lang="pangram.lang">
              <p class="sg-specimen sg-font-display" :style="stepStyle(3)">
                {{ pangram.text }}
              </p>
              <p class="sg-language__text">
                {{ pangram.text }}
              </p>
            </dd>
          </div>
        </dl>
      </section>

      <section class="sg-section" aria-labelledby="sg-fonts">
        <p class="sg-eyebrow">
          08
        </p>
        <h2 id="sg-fonts" class="sg-section__title">
          Fontes e orçamento
        </h2>
        <p class="sg-note">
          {{ pairing.name }} ({{ pairing.reference }}). Todas sob a SIL Open Font License 1.1, self-hosted via Fontsource 5.3.0. Tamanhos do subset latin em WOFF2; o latin-ext só é baixado quando a página usa esses caracteres.
        </p>
        <div class="sg-table-wrap" role="region" tabindex="0" aria-label="Arquivos de fonte">
          <table class="sg-table">
            <thead>
              <tr>
                <th scope="col">
                  Papel
                </th>
                <th scope="col">
                  Família
                </th>
                <th scope="col">
                  Pacote
                </th>
                <th scope="col">
                  Eixos do arquivo
                </th>
                <th scope="col">
                  latin (WOFF2)
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="font in pairing.fonts" :key="font.family">
                <tr v-for="file in font.files" :key="`${font.family}-${file.axes}`">
                  <td>{{ font.role }}</td>
                  <td>{{ font.family }}</td>
                  <td><code class="sg-mono">{{ font.pkg }}</code></td>
                  <td>{{ file.axes }}</td>
                  <td>{{ formatKb(file.kb) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <h3 class="sg-panel__title">
          Preload da primeira tela (até {{ FONT_BUDGET_FILES }} arquivos e {{ formatKb(FONT_BUDGET_KB) }})
        </h3>
        <ul class="sg-budget">
          <li v-for="row in preloadRows" :key="row.label">
            {{ row.label }}: {{ row.total }} · {{ row.withinBudget ? '✓ dentro do orçamento' : '✗ acima do orçamento' }}
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.sg {
  max-inline-size: var(--container-max);
  margin-inline: auto;
  padding: var(--space-12) var(--space-gutter);
}

.sg-header {
  display: grid;
  gap: var(--space-6);
  padding-block-end: var(--space-12);
}

.sg-eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-step--1);
  line-height: var(--leading-step--1);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.sg-title,
.sg-section__title,
.sg-card__title,
.sg-font-display {
  font-family: var(--font-display);
  font-weight: var(--weight-display);
  letter-spacing: var(--tracking-display);
}

.sg-title {
  margin: 0;
  font-size: var(--text-step-7);
  line-height: var(--leading-step-7);
  text-wrap: balance;
}

.sg-lede {
  margin: 0;
  max-inline-size: var(--container-reading);
  font-size: var(--text-step-1);
  line-height: var(--leading-step-1);
  text-wrap: pretty;
}

.sg-controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

.sg-control__options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}

.sg-option {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--target-min);
  padding-inline: var(--space-4);
  border: var(--border-hairline) solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--text-step--1);
  letter-spacing: var(--tracking-label);
  text-decoration: none;
  text-transform: uppercase;
  transition: border-color var(--dur-instant) var(--ease-out);
}

.sg-option:hover {
  border-color: var(--color-text);
}

.sg-option[aria-current='true'] {
  border-color: var(--color-text);
  background: var(--color-text);
  color: var(--color-bg);
}

.sg-section {
  display: grid;
  gap: var(--space-6);
  padding-block: var(--space-12);
  border-block-start: var(--border-hairline) solid var(--color-border);
}

.sg-section__title {
  margin: 0;
  font-size: var(--text-step-4);
  line-height: var(--leading-step-4);
  text-wrap: balance;
}

.sg-font-sans {
  font-family: var(--font-sans);
}

.sg-mono {
  font-family: var(--font-mono);
}

.sg-scale,
.sg-axes,
.sg-swatches,
.sg-budget {
  margin: 0;
  padding: 0;
  list-style: none;
}

.sg-scale,
.sg-axes,
.sg-specimens {
  display: grid;
  gap: var(--space-8);
}

.sg-scale__row {
  display: grid;
  gap: var(--space-2);
}

.sg-specimen {
  margin: 0;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.sg-specimen--strong {
  font-weight: var(--weight-strong);
}

.sg-prose {
  display: grid;
  gap: var(--space-4);
  max-inline-size: var(--container-reading);
}

.sg-prose p {
  margin: 0;
  text-wrap: pretty;
}

.sg-note {
  margin: 0;
  max-inline-size: var(--container-reading);
  color: var(--color-text-muted);
  font-size: var(--text-step--1);
  line-height: var(--leading-step--1);
}

.sg-link {
  color: var(--color-link);
  text-decoration-line: underline;
  text-decoration-thickness: var(--underline-thickness);
  text-underline-offset: var(--underline-offset);
  transition: background-color var(--dur-instant) var(--ease-out), color var(--dur-instant) var(--ease-out);
}

.sg-link:hover {
  background-color: var(--color-accent);
  color: var(--color-accent-contrast);
}

.sg-figure {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.sg-code {
  overflow-x: auto;
  padding: var(--space-6);
  border: var(--border-hairline) solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.sg-code pre {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-step--1);
  line-height: var(--leading-step-0);
  tab-size: 2;
}

.sg-components {
  display: grid;
  gap: var(--space-8);
  justify-items: start;
}

.sg-card {
  display: grid;
  gap: var(--space-3);
  inline-size: 100%;
  max-inline-size: var(--sg-card-max);
  padding: var(--space-6);
  border: var(--border-hairline) solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.sg-card__title {
  margin: 0;
  font-size: var(--text-step-3);
  line-height: var(--leading-step-3);
  text-wrap: balance;
}

.sg-card__title a {
  color: var(--color-text);
  text-decoration: none;
}

.sg-card__title a:hover {
  text-decoration-line: underline;
  text-decoration-thickness: var(--underline-thickness);
  text-underline-offset: var(--underline-offset);
}

.sg-card__meta {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-step--1);
  font-variant-numeric: tabular-nums;
}

.sg-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.sg-button {
  min-block-size: var(--target-min);
  padding-inline: var(--space-6);
  border: var(--border-hairline) solid transparent;
  border-radius: var(--radius-control);
  font-family: var(--font-sans);
  font-size: var(--text-step-0);
  font-weight: var(--weight-strong);
  line-height: var(--leading-none);
  cursor: pointer;
  transition: background-color var(--dur-instant) var(--ease-out);
}

.sg-button--primary {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.sg-button--primary:hover:enabled {
  background: color-mix(in oklch, var(--color-accent), var(--color-text) var(--state-hover-mix));
}

.sg-button--primary:active:enabled {
  background: color-mix(in oklch, var(--color-accent), var(--color-text) var(--state-active-mix));
}

.sg-button--secondary {
  border-color: var(--color-text);
  background: transparent;
  color: var(--color-text);
}

.sg-button--secondary:hover:enabled {
  background: var(--color-surface);
}

.sg-button--secondary:active:enabled {
  background: color-mix(in oklch, var(--color-surface), var(--color-text) var(--state-hover-mix));
}

.sg-button:disabled {
  cursor: not-allowed;
  opacity: var(--opacity-disabled);
}

.sg-panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--sg-panel-min)), 1fr));
  gap: var(--space-6);
}

.sg-panel {
  display: grid;
  align-content: start;
  gap: var(--space-6);
  padding: var(--space-6);
  border: var(--border-hairline) solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-bg);
  color: var(--color-text);
}

.sg-panel__title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-step-1);
  font-weight: var(--weight-strong);
  line-height: var(--leading-step-1);
}

.sg-swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--sg-swatch-min), 1fr));
  gap: var(--space-4);
}

.sg-swatch {
  display: grid;
  gap: var(--space-1);
  font-size: var(--text-step--1);
  line-height: var(--leading-step--1);
}

.sg-swatch__chip {
  block-size: var(--space-12);
  border: var(--border-hairline) solid var(--color-border);
  border-radius: var(--radius-chip);
}

.sg-swatch__value {
  color: var(--color-text-muted);
  overflow-wrap: anywhere;
}

.sg-table-wrap {
  overflow-x: auto;
}

.sg-table {
  inline-size: 100%;
  border-collapse: collapse;
  font-size: var(--text-step--1);
  line-height: var(--leading-step--1);
  font-variant-numeric: tabular-nums;
}

.sg-table th,
.sg-table td {
  padding: var(--space-2) var(--space-3);
  border-block-end: var(--border-hairline) solid var(--color-border);
  text-align: start;
  vertical-align: top;
}

.sg-table th {
  font-weight: var(--weight-strong);
}

.sg-languages {
  display: grid;
  gap: var(--space-8);
  margin: 0;
}

.sg-language {
  display: grid;
  gap: var(--space-2);
}

.sg-language dd {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.sg-language__text {
  margin: 0;
  max-inline-size: var(--container-reading);
}

.sg-budget {
  display: grid;
  gap: var(--space-2);
}
</style>
