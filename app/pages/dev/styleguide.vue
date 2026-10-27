<script setup lang="ts">
// Dev-only page: `$production.ignore` in nuxt.config keeps it out of production builds, and main.css keeps its markup
// out of the public CSS. It documents the final tokens of app/assets/css/main.css (F01-T2): colors and contrast are
// read from that file, the type scale and motion from shared/design/tokens.ts (whose match with the CSS is tested).
// The @fontsource packages are temporary devDependencies; F01-T3 replaces them with @nuxt/fonts.
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/inter/wght-italic.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import mainCss from '~/assets/css/main.css?raw'
import { AA_MINIMUM, checkContrast, isInSrgbGamut } from '#shared/design/contrast'
import type { ContrastUse, Oklch } from '#shared/design/contrast'
import { themeColors } from '#shared/design/css-tokens'
import type { ThemeName } from '#shared/design/css-tokens'
import { DISPLAY_FROM_STEP, DISTANCES, DURATIONS, EASINGS, FLUID_VIEWPORT, TYPE_SCALE } from '#shared/design/tokens'

// Dev tool, not part of the localized site
definePageMeta({ i18n: false })

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

const THEMES = ['light', 'dark'] as const satisfies readonly ThemeName[]

const THEME_LABEL: Record<ThemeName, string> = {
  light: 'Claro',
  dark: 'Escuro',
}

const USE_LABEL: Record<ContrastUse, string> = {
  'text': 'texto',
  'large-text': 'texto grande',
  'ui': 'UI',
}

// Latin WOFF2 sizes measured in the 5.3.0 packages (2026-10-25); pairing A chosen on 2026-10-25 (design-direction §9)
const FONTS: readonly FontFact[] = [
  {
    role: 'Display',
    family: 'Fraunces',
    pkg: '@fontsource-variable/fraunces',
    files: [
      { axes: 'opsz, SOFT, WONK e wght (esta página)', kb: 118.2 },
      { axes: 'opsz e wght (alvo da F01-T3)', kb: 65.7 },
      { axes: 'wght', kb: 35.8 },
    ],
  },
  { role: 'Texto e UI', family: 'Inter', pkg: '@fontsource-variable/inter', files: [{ axes: 'wght', kb: 47.1 }] },
  { role: 'Código e rótulos', family: 'JetBrains Mono', pkg: '@fontsource-variable/jetbrains-mono', files: [{ axes: 'wght', kb: 39.5 }] },
]

// performance-budgets §4: at most 2 font files and 120 KB on the first screen
const FONT_BUDGET_KB = 120
const FONT_BUDGET_FILES = 2
const PRELOAD = { label: 'Fraunces (opsz e wght) + Inter', kb: [65.7, 47.1] } as const

const SPACING_STEPS = [1, 2, 3, 4, 6, 8, 12, 16] as const

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
const toCss = ({ l, c, h }: Oklch) => `oklch(${l} ${c} ${h})`

function stepStyle(step: number) {
  return {
    fontSize: `var(--text-step-${step})`,
    lineHeight: `var(--text-step-${step}--line-height)`,
    letterSpacing: `var(--text-step-${step}--letter-spacing, normal)`,
  }
}

const SCALE_ROWS = TYPE_SCALE.toReversed().map(step => ({
  ...step,
  range: `${step.minPx}–${step.maxPx} px`,
  leadingLabel: leadingFormat.format(step.leading),
  display: step.step >= DISPLAY_FROM_STEP,
}))

const preloadTotal = PRELOAD.kb.reduce((sum, kb) => sum + kb, 0)
const preloadWithinBudget = PRELOAD.kb.length <= FONT_BUDGET_FILES && preloadTotal <= FONT_BUDGET_KB

// The values shipped in main.css, checked like `pnpm check:contrast` does
const colors = themeColors(mainCss)
const report = checkContrast(colors)

const contrastPanels = THEMES.map(theme => ({
  theme,
  label: THEME_LABEL[theme],
  swatches: Object.entries(colors[theme]).map(([token, color]) => ({ token, value: toCss(color), inGamut: isInSrgbGamut(color) })),
  rows: report.results.filter(result => result.theme === theme).map(result => ({
    ...result,
    key: `${result.foreground}-${result.background}`,
    ratioLabel: formatRatio(result.ratio),
    minimum: formatRatio(AA_MINIMUM[result.use]),
  })),
}))

const motionRows = [
  ...Object.entries(DURATIONS).map(([name, ms]) => ({ token: `--dur-${name}`, value: `${ms} ms` })),
  ...Object.entries(EASINGS).map(([name, value]) => ({ token: `--ease-${name}`, value })),
  ...Object.entries(DISTANCES).map(([name, px]) => ({ token: `--distance-${name}`, value: `${px} px` })),
]

useHead({ title: 'Styleguide (dev)' })
</script>

<template>
  <div class="sg">
    <header class="sg-header">
      <p class="sg-eyebrow">
        F01-T2 · só em desenvolvimento
      </p>
      <h1 class="sg-title">
        Styleguide
      </h1>
      <p class="sg-lede">
        Tokens finais de <code class="sg-mono">app/assets/css/main.css</code>: tipografia A (Fraunces, Inter e JetBrains Mono), paleta B "Noite e rosa" e cantos retos. O tema segue o sistema até você usar o botão de tema no topo.
      </p>
    </header>

    <main>
      <section
        class="sg-section"
        aria-labelledby="sg-scale"
      >
        <p class="sg-eyebrow">
          01
        </p>
        <h2
          id="sg-scale"
          class="sg-section__title"
        >
          Escala tipográfica
        </h2>
        <p class="sg-note">
          Tamanhos fluidos entre {{ FLUID_VIEWPORT.minPx }} e {{ FLUID_VIEWPORT.maxPx }} px de largura; display a partir do passo {{ DISPLAY_FROM_STEP }}. Utilitários <code class="sg-mono">text-step--1</code> a <code class="sg-mono">text-step-7</code>.
        </p>
        <ul class="sg-scale">
          <li
            v-for="step in SCALE_ROWS"
            :key="step.step"
            class="sg-scale__row"
          >
            <p class="sg-eyebrow">
              Passo {{ step.step }} · {{ step.range }} · entrelinha {{ step.leadingLabel }}
            </p>
            <p
              class="sg-specimen"
              :class="step.display ? 'sg-font-display' : 'sg-font-sans'"
              :style="stepStyle(step.step)"
            >
              {{ step.display ? SAMPLE.title : SAMPLE.opening }}
            </p>
          </li>
        </ul>
      </section>

      <section
        class="sg-section"
        aria-labelledby="sg-headings"
      >
        <p class="sg-eyebrow">
          02
        </p>
        <h2
          id="sg-headings"
          class="sg-section__title"
        >
          Títulos
        </h2>
        <div class="sg-specimens">
          <div
            v-for="heading in HEADING_SPECIMENS"
            :key="heading.level"
            class="sg-scale__row"
          >
            <p class="sg-eyebrow">
              {{ heading.level }} · {{ heading.display ? 'display' : 'sans' }} · passo {{ heading.step }}
            </p>
            <p
              class="sg-specimen"
              :class="heading.display ? 'sg-font-display' : 'sg-font-sans sg-specimen--strong'"
              :style="stepStyle(heading.step)"
            >
              {{ heading.text }}
            </p>
          </div>
        </div>
        <p class="sg-eyebrow">
          Eixos variáveis da Fraunces
        </p>
        <ul class="sg-axes">
          <li
            v-for="axis in DISPLAY_AXES"
            :key="axis.label"
            class="sg-scale__row"
          >
            <p class="sg-eyebrow">
              {{ axis.label }}
            </p>
            <p
              class="sg-specimen sg-font-display"
              :style="{ ...stepStyle(5), fontVariationSettings: axis.settings }"
            >
              {{ SAMPLE.title }}
            </p>
          </li>
        </ul>
      </section>

      <section
        class="sg-section"
        aria-labelledby="sg-text"
      >
        <p class="sg-eyebrow">
          03
        </p>
        <h2
          id="sg-text"
          class="sg-section__title"
        >
          Texto corrido
        </h2>
        <div class="sg-prose">
          <p
            v-for="paragraph in SAMPLE.paragraphs"
            :key="paragraph"
          >
            {{ paragraph }}
          </p>
          <p>
            [PLACEHOLDER] Frase de teste com <a
              class="sg-link"
              href="#sg-colors"
            >um link</a>, um termo em <em>itálico</em>, um <strong>destaque</strong> e código inline como <code class="sg-mono">getHealth()</code>.
          </p>
          <p class="sg-note">
            [PLACEHOLDER] Texto de exemplo: {{ SAMPLE.source }}
          </p>
        </div>
      </section>

      <section
        class="sg-section"
        aria-labelledby="sg-code"
      >
        <p class="sg-eyebrow">
          04
        </p>
        <h2
          id="sg-code"
          class="sg-section__title"
        >
          Bloco de código
        </h2>
        <figure class="sg-figure">
          <div
            class="sg-code"
            role="region"
            tabindex="0"
            aria-label="Exemplo de código em TypeScript"
          >
            <pre><code>{{ CODE_SAMPLE }}</code></pre>
          </div>
          <figcaption class="sg-note">
            server/services/health/health.service.ts
          </figcaption>
        </figure>
      </section>

      <section
        class="sg-section"
        aria-labelledby="sg-components"
      >
        <p class="sg-eyebrow">
          05
        </p>
        <h2
          id="sg-components"
          class="sg-section__title"
        >
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
            <button
              type="button"
              class="sg-button sg-button--primary"
            >
              Primário
            </button>
            <button
              type="button"
              class="sg-button sg-button--secondary"
            >
              Secundário
            </button>
            <button
              type="button"
              class="sg-button sg-button--primary"
              disabled
            >
              Desabilitado
            </button>
          </div>
          <p class="sg-note">
            Passe o mouse ou use Tab para ver hover e foco.
          </p>
          <p>
            <a
              class="sg-link"
              href="#sg-colors"
            >Ir para cores e contraste</a>
          </p>
          <ul class="sg-status">
            <li class="sg-status__item sg-status__item--success">
              [PLACEHOLDER] Publicado
            </li>
            <li class="sg-status__item sg-status__item--warning">
              [PLACEHOLDER] Tradução desatualizada
            </li>
            <li class="sg-status__item sg-status__item--danger">
              [PLACEHOLDER] Falha ao salvar
            </li>
          </ul>
        </div>
      </section>

      <section
        class="sg-section"
        aria-labelledby="sg-colors"
      >
        <p class="sg-eyebrow">
          06
        </p>
        <h2
          id="sg-colors"
          class="sg-section__title"
        >
          Cores e contraste
        </h2>
        <p class="sg-note">
          Tokens semânticos lidos do main.css (light-dark), cada painel fixado num tema. Mínimos AA: texto 4,5:1; UI 3:1. O mesmo cálculo roda em <code class="sg-mono">pnpm check:contrast</code>.
        </p>
        <div class="sg-panels">
          <section
            v-for="panel in contrastPanels"
            :key="panel.theme"
            class="sg-panel"
            :style="{ colorScheme: panel.theme }"
            :aria-labelledby="`sg-panel-${panel.theme}`"
          >
            <h3
              :id="`sg-panel-${panel.theme}`"
              class="sg-panel__title"
            >
              {{ panel.label }}
            </h3>
            <ul class="sg-swatches">
              <li
                v-for="swatch in panel.swatches"
                :key="swatch.token"
                class="sg-swatch"
              >
                <span
                  class="sg-swatch__chip"
                  aria-hidden="true"
                  :style="{ background: `var(--color-${swatch.token})` }"
                />
                <code class="sg-mono">{{ swatch.token }}</code>
                <span class="sg-mono sg-swatch__value">{{ swatch.value }}</span>
                <strong v-if="!swatch.inGamut">fora do gamut sRGB</strong>
              </li>
            </ul>
            <div
              class="sg-table-wrap"
              role="region"
              tabindex="0"
              :aria-label="`Contraste no tema ${panel.label.toLowerCase()}`"
            >
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
                  <tr
                    v-for="row in panel.rows"
                    :key="row.key"
                  >
                    <td><code class="sg-mono">{{ row.foreground }}</code> × <code class="sg-mono">{{ row.background }}</code></td>
                    <td>{{ USE_LABEL[row.use] }} (≥ {{ row.minimum }})</td>
                    <td>{{ row.ratioLabel }}</td>
                    <td>{{ row.pass ? '✓ passa' : '✗ não passa' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      <section
        class="sg-section"
        aria-labelledby="sg-space"
      >
        <p class="sg-eyebrow">
          07
        </p>
        <h2
          id="sg-space"
          class="sg-section__title"
        >
          Espaço, forma e motion
        </h2>
        <p class="sg-note">
          Base de 4 px (<code class="sg-mono">--spacing</code>), mais <code class="sg-mono">--spacing-gutter</code> e <code class="sg-mono">--spacing-section</code> fluidos. Cantos retos (<code class="sg-mono">--radius-control/card/chip: 0</code>); a estrutura vem das hairlines.
        </p>
        <ul class="sg-spacing">
          <li
            v-for="step in SPACING_STEPS"
            :key="step"
            class="sg-spacing__row"
          >
            <code class="sg-mono">{{ step }}</code>
            <span
              class="sg-spacing__bar"
              aria-hidden="true"
              :style="{ inlineSize: `calc(var(--spacing) * ${step})` }"
            />
          </li>
        </ul>
        <div
          class="sg-table-wrap"
          role="region"
          tabindex="0"
          aria-label="Tokens de motion"
        >
          <table class="sg-table">
            <thead>
              <tr>
                <th scope="col">
                  Token
                </th>
                <th scope="col">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in motionRows"
                :key="row.token"
              >
                <td><code class="sg-mono">{{ row.token }}</code></td>
                <td><code class="sg-mono">{{ row.value }}</code></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="sg-note">
          Com movimento reduzido, as durações acima de <code class="sg-mono">--dur-fast</code> caem para ela e as distâncias vão a zero.
        </p>
      </section>

      <section
        class="sg-section"
        aria-labelledby="sg-languages"
      >
        <p class="sg-eyebrow">
          08
        </p>
        <h2
          id="sg-languages"
          class="sg-section__title"
        >
          Diacríticos nos 5 idiomas
        </h2>
        <dl class="sg-languages">
          <div
            v-for="pangram in PANGRAMS"
            :key="pangram.lang"
            class="sg-language"
          >
            <dt
              class="sg-eyebrow"
              :lang="pangram.lang"
            >
              {{ pangram.label }}
            </dt>
            <dd :lang="pangram.lang">
              <p
                class="sg-specimen sg-font-display"
                :style="stepStyle(3)"
              >
                {{ pangram.text }}
              </p>
              <p class="sg-language__text">
                {{ pangram.text }}
              </p>
            </dd>
          </div>
        </dl>
      </section>

      <section
        class="sg-section"
        aria-labelledby="sg-fonts"
      >
        <p class="sg-eyebrow">
          09
        </p>
        <h2
          id="sg-fonts"
          class="sg-section__title"
        >
          Fontes e orçamento
        </h2>
        <p class="sg-note">
          Todas sob a SIL Open Font License 1.1; aqui via Fontsource 5.3.0, self-hosted pelo @nuxt/fonts na F01-T3. Tamanhos do subset latin em WOFF2; o latin-ext só é baixado quando a página usa esses caracteres.
        </p>
        <div
          class="sg-table-wrap"
          role="region"
          tabindex="0"
          aria-label="Arquivos de fonte"
        >
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
              <template
                v-for="font in FONTS"
                :key="font.family"
              >
                <tr
                  v-for="file in font.files"
                  :key="`${font.family}-${file.axes}`"
                >
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
        <p class="sg-note">
          Preload da primeira tela (até {{ FONT_BUDGET_FILES }} arquivos e {{ formatKb(FONT_BUDGET_KB) }}): {{ PRELOAD.label }}, {{ formatKb(preloadTotal) }} · {{ preloadWithinBudget ? '✓ dentro do orçamento' : '✗ acima do orçamento' }}
        </p>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* Only tokens from main.css; `--sg-*` are layout sizes of this page alone */
.sg {
  --sg-gap-xs: calc(var(--spacing) * 1);
  --sg-gap-sm: calc(var(--spacing) * 2);
  --sg-gap-md: calc(var(--spacing) * 4);
  --sg-gap-lg: calc(var(--spacing) * 6);
  --sg-gap-xl: calc(var(--spacing) * 8);
  --sg-gap-2xl: calc(var(--spacing) * 12);
  --sg-panel-min: 22rem;
  --sg-swatch-min: 7.5rem;
  --sg-card-max: 26rem;

  max-inline-size: var(--container-max);
  margin-inline: auto;
  padding: var(--sg-gap-2xl) var(--spacing-gutter);
}

.sg-header {
  display: grid;
  gap: var(--sg-gap-lg);
  padding-block-end: var(--sg-gap-2xl);
}

.sg-eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-step--1);
  line-height: var(--text-step--1--line-height);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.sg-title,
.sg-section__title,
.sg-card__title,
.sg-font-display {
  font-family: var(--font-display);
  font-weight: var(--font-weight-regular);
}

.sg-title {
  margin: 0;
  font-size: var(--text-step-7);
  line-height: var(--text-step-7--line-height);
  letter-spacing: var(--text-step-7--letter-spacing);
  text-wrap: balance;
}

.sg-lede {
  margin: 0;
  max-inline-size: var(--container-reading);
  font-size: var(--text-step-1);
  line-height: var(--text-step-1--line-height);
  text-wrap: pretty;
}

.sg-section {
  display: grid;
  gap: var(--sg-gap-lg);
  padding-block: var(--sg-gap-2xl);
  border-block-start: var(--border-hairline) solid var(--color-border);
}

.sg-section__title {
  margin: 0;
  font-size: var(--text-step-4);
  line-height: var(--text-step-4--line-height);
  letter-spacing: var(--text-step-4--letter-spacing);
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
.sg-specimens {
  display: grid;
  gap: var(--sg-gap-xl);
}

.sg-scale__row {
  display: grid;
  gap: var(--sg-gap-sm);
}

.sg-specimen {
  margin: 0;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.sg-specimen--strong {
  font-weight: var(--font-weight-strong);
}

.sg-prose {
  display: grid;
  gap: var(--sg-gap-md);
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
  line-height: var(--text-step--1--line-height);
}

.sg-link {
  color: var(--color-accent);
  text-decoration-line: underline;
  transition: background-color var(--dur-instant) var(--ease-out), color var(--dur-instant) var(--ease-out);
}

.sg-link:hover {
  background-color: var(--color-accent);
  color: var(--color-accent-contrast);
}

.sg-figure {
  display: grid;
  gap: var(--sg-gap-sm);
  margin: 0;
}

.sg-code {
  overflow-x: auto;
  padding: var(--sg-gap-lg);
  border: var(--border-hairline) solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.sg-code pre {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-step--1);
  line-height: var(--text-step-0--line-height);
  tab-size: 2;
}

.sg-components {
  display: grid;
  gap: var(--sg-gap-xl);
  justify-items: start;
}

.sg-card {
  display: grid;
  gap: calc(var(--spacing) * 3);
  inline-size: 100%;
  max-inline-size: var(--sg-card-max);
  padding: var(--sg-gap-lg);
  border: var(--border-hairline) solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.sg-card__title {
  margin: 0;
  font-size: var(--text-step-3);
  line-height: var(--text-step-3--line-height);
  letter-spacing: var(--text-step-3--letter-spacing);
  text-wrap: balance;
}

.sg-card__title a {
  color: var(--color-text);
  text-decoration: none;
}

.sg-card__title a:hover {
  text-decoration-line: underline;
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
  gap: var(--sg-gap-md);
}

.sg-button {
  min-block-size: var(--target-comfortable);
  padding-inline: var(--sg-gap-lg);
  border: var(--border-hairline) solid transparent;
  border-radius: var(--radius-control);
  font-family: var(--font-sans);
  font-size: var(--text-step-0);
  font-weight: var(--font-weight-strong);
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

.sg-button--secondary {
  border-color: var(--color-text);
  background: transparent;
  color: var(--color-text);
}

.sg-button--secondary:hover:enabled {
  background: var(--color-surface);
}

.sg-button:disabled {
  cursor: not-allowed;
  opacity: var(--opacity-disabled);
}

.sg-status {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sg-gap-md);
}

.sg-status__item {
  padding: var(--sg-gap-xs) var(--sg-gap-sm);
  border: var(--border-hairline) solid currentcolor;
  border-radius: var(--radius-chip);
  font-family: var(--font-mono);
  font-size: var(--text-step--1);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.sg-status__item--success {
  color: var(--color-success);
}

.sg-status__item--warning {
  color: var(--color-warning);
}

.sg-status__item--danger {
  color: var(--color-danger);
}

.sg-panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--sg-panel-min)), 1fr));
  gap: var(--sg-gap-lg);
}

/* color-scheme pins the panel to one theme; its colors resolve light-dark() again inside it */
.sg-panel {
  display: grid;
  align-content: start;
  gap: var(--sg-gap-lg);
  padding: var(--sg-gap-lg);
  border: var(--border-hairline) solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-bg);
  color: var(--color-text);
}

.sg-panel__title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-step-1);
  font-weight: var(--font-weight-strong);
  line-height: var(--text-step-1--line-height);
}

.sg-swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--sg-swatch-min), 1fr));
  gap: var(--sg-gap-md);
}

.sg-swatch {
  display: grid;
  gap: var(--sg-gap-xs);
  font-size: var(--text-step--1);
  line-height: var(--text-step--1--line-height);
}

.sg-swatch__chip {
  block-size: var(--sg-gap-2xl);
  border: var(--border-hairline) solid var(--color-border);
  border-radius: var(--radius-chip);
}

.sg-swatch__value {
  color: var(--color-text-muted);
  overflow-wrap: anywhere;
}

.sg-spacing {
  display: grid;
  gap: var(--sg-gap-sm);
}

.sg-spacing__row {
  display: flex;
  align-items: center;
  gap: var(--sg-gap-md);
}

.sg-spacing__row code {
  min-inline-size: var(--sg-gap-xl);
}

.sg-spacing__bar {
  block-size: var(--sg-gap-md);
  background: var(--color-accent);
}

.sg-table-wrap {
  overflow-x: auto;
}

.sg-table {
  inline-size: 100%;
  border-collapse: collapse;
  font-size: var(--text-step--1);
  line-height: var(--text-step--1--line-height);
  font-variant-numeric: tabular-nums;
}

.sg-table th,
.sg-table td {
  padding: var(--sg-gap-sm) calc(var(--spacing) * 3);
  border-block-end: var(--border-hairline) solid var(--color-border);
  text-align: start;
  vertical-align: top;
}

.sg-table th {
  font-weight: var(--font-weight-strong);
}

.sg-languages {
  display: grid;
  gap: var(--sg-gap-xl);
  margin: 0;
}

.sg-language {
  display: grid;
  gap: var(--sg-gap-sm);
}

.sg-language dd {
  display: grid;
  gap: var(--sg-gap-sm);
  margin: 0;
}

.sg-language__text {
  margin: 0;
  max-inline-size: var(--container-reading);
}
</style>
