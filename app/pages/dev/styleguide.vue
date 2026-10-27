<script setup lang="ts">
// Dev-only page: `$production.ignore` in nuxt.config keeps it out of production builds, and main.css keeps its markup
// out of the public CSS. It documents the final tokens of app/assets/css/main.css (F01-T2): colors and contrast are
// read from that file, the type scale and motion from shared/design/tokens.ts (whose match with the CSS is tested).
// Fonts come from the site itself (@nuxt/fonts, shared/design/fonts.ts), like on every other page.
import mainCss from '~/assets/css/main.css?raw'
import { AA_MINIMUM, checkContrast, isInSrgbGamut } from '#shared/design/contrast'
import type { ContrastUse, Oklch } from '#shared/design/contrast'
import { themeColors } from '#shared/design/css-tokens'
import type { ThemeName } from '#shared/design/css-tokens'
import { FONT_BASE_PATH, FONT_FAMILIES, fontFaces } from '#shared/design/fonts'
import { DISPLAY_FROM_STEP, DISTANCES, DURATIONS, EASINGS, FLUID_VIEWPORT, TYPE_SCALE } from '#shared/design/tokens'

// Dev tool, not part of the localized site
definePageMeta({ i18n: false })

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

// File sizes (bytes) of the vendored WOFF2 files, measured on 2026-10-27
const FILE_BYTES: Record<string, number> = {
  'fraunces-latin-opsz-normal.woff2': 67304,
  'fraunces-latin-ext-opsz-normal.woff2': 59388,
  'fraunces-latin-opsz-italic.woff2': 81520,
  'fraunces-latin-ext-opsz-italic.woff2': 71460,
  'inter-latin-wght-normal.woff2': 48256,
  'inter-latin-ext-wght-normal.woff2': 85068,
  'inter-latin-wght-italic.woff2': 51832,
  'inter-latin-ext-wght-italic.woff2': 91900,
  'jetbrains-mono-latin-wght-normal.woff2': 40404,
  'jetbrains-mono-latin-ext-wght-normal.woff2': 15196,
}

const ROLE: Record<string, string> = {
  'Fraunces': 'Display',
  'Inter': 'Texto e UI',
  'JetBrains Mono': 'Código e rótulos',
}

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

// Fraunces ships with its opsz and wght axes; browsers set opsz from the font size (font-optical-sizing: auto)
const DISPLAY_WEIGHTS = [300, 400, 600, 800] as const

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

const ratioFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const kbFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const leadingFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

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

const fileName = (src: string) => src.split('/').at(-1) ?? src
const fontRows = FONT_FAMILIES.flatMap(family => fontFaces(family).map(face => ({
  key: face.src,
  role: ROLE[family.name] ?? family.name,
  family: family.name,
  file: fileName(face.src),
  axes: family.axes === 'opsz' ? 'opsz e wght' : 'wght',
  kb: (FILE_BYTES[fileName(face.src)] ?? 0) / 1024,
  firstScreen: face.subset === 'latin' && face.style === 'normal',
})))
const firstScreenKb = fontRows.filter(row => row.firstScreen).reduce((sum, row) => sum + row.kb, 0)

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

// Component demos (F01-T4)
const presses = ref(0)
const demoEmail = ref('')
const demoMessage = ref('')
const demoErrors = reactive<{ email?: string | undefined, message?: string | undefined }>({})
const demoStatus = ref<'info' | 'success' | 'danger'>('info')
const demoStatusText = ref('[PLACEHOLDER] Preencha e valide o formulário de exemplo.')

function validateDemo() {
  demoErrors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(demoEmail.value) ? undefined : '[PLACEHOLDER] Informe um e-mail válido.'
  demoErrors.message = demoMessage.value.trim() ? undefined : '[PLACEHOLDER] Escreva uma mensagem.'
  const ok = !demoErrors.email && !demoErrors.message
  demoStatus.value = ok ? 'success' : 'danger'
  demoStatusText.value = ok ? '[PLACEHOLDER] Tudo certo (nada foi enviado).' : '[PLACEHOLDER] Corrija os campos marcados.'
}

const ICON_NAMES = Object.keys(ICONS) as IconName[]
const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost'] as const
const STATUS_TONES = ['info', 'success', 'warning', 'danger'] as const
// The utilities are applied in this page's scoped CSS (main.css does not scan dev pages)
const GRID_SPANS = [
  { class: 'sg-span-a', label: 'col-span-4 lg:col-span-8' },
  { class: 'sg-span-b', label: 'col-span-4 lg:col-span-4' },
  { class: 'sg-span-c', label: 'col-span-2 md:col-span-4 lg:col-span-3' },
  { class: 'sg-span-d', label: 'col-span-2 md:col-span-4 lg:col-span-9' },
] as const

useHead({ title: 'Styleguide (dev)' })
</script>

<template>
  <div class="sg">
    <header class="sg-header">
      <p class="sg-eyebrow">
        F01-T4 · só em desenvolvimento
      </p>
      <h1 class="sg-title">
        Styleguide
      </h1>
      <p class="sg-lede">
        Tokens finais de <code class="sg-mono">app/assets/css/main.css</code>: tipografia A (Fraunces, Inter e JetBrains Mono), paleta B "Noite e rosa" e cantos retos. O tema segue o sistema até você usar o botão de tema no topo.
      </p>
    </header>

    <main id="main">
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
          Pesos da Fraunces (opsz automático pelo tamanho)
        </p>
        <ul class="sg-axes">
          <li
            v-for="weight in DISPLAY_WEIGHTS"
            :key="weight"
            class="sg-scale__row"
          >
            <p class="sg-eyebrow">
              Peso {{ weight }}
            </p>
            <p
              class="sg-specimen sg-font-display"
              :style="{ ...stepStyle(5), fontWeight: weight }"
            >
              {{ SAMPLE.title }} <em>{{ SAMPLE.chapter }}</em>
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
        <UiProse>
          <p
            v-for="paragraph in SAMPLE.paragraphs"
            :key="paragraph"
          >
            {{ paragraph }}
          </p>
          <p>
            [PLACEHOLDER] Frase de teste com <a href="#sg-colors">um link</a>, um termo em <em>itálico</em>, um <strong>destaque</strong> e código inline como <code>getHealth()</code>.
          </p>
          <ul>
            <li>[PLACEHOLDER] Item de lista</li>
            <li>[PLACEHOLDER] Outro item</li>
          </ul>
          <blockquote>
            <p>[PLACEHOLDER] Uma citação em destaque.</p>
          </blockquote>
          <p class="sg-note">
            [PLACEHOLDER] Texto de exemplo: {{ SAMPLE.source }}
          </p>
        </UiProse>
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
          Componentes base
        </h2>
        <p class="sg-note">
          Primitivos de <code class="sg-mono">app/components/ui/</code> (F01-T4). Passe o mouse, use Tab e as setas para ver hover, foco e active; os textos daqui são de demonstração.
        </p>

        <div class="sg-demo">
          <h3 class="sg-panel__title">
            UiButton
          </h3>
          <div
            v-for="variant in BUTTON_VARIANTS"
            :key="variant"
            class="sg-row"
          >
            <UiButton
              :variant="variant"
              data-testid="sg-button"
              @click="presses++"
            >
              {{ variant }}
            </UiButton>
            <UiButton
              :variant="variant"
              size="sm"
              @click="presses++"
            >
              {{ variant }} sm
            </UiButton>
            <UiButton
              :variant="variant"
              @click="presses++"
            >
              Com ícone
              <template #icon>
                <UiIcon name="arrow-right" />
              </template>
            </UiButton>
            <UiButton
              :variant="variant"
              disabled
            >
              Desabilitado
            </UiButton>
          </div>
          <p class="sg-note">
            Acionados: <output data-testid="sg-presses">{{ presses }}</output>
          </p>
        </div>

        <div class="sg-demo">
          <h3 class="sg-panel__title">
            UiLink e UiSkipLink
          </h3>
          <p>
            Texto com <UiLink href="#sg-colors">link inline</UiLink>, e um alvo inseguro que vira texto: <UiLink href="javascript:alert(1)">javascript:alert(1)</UiLink>.
          </p>
          <div class="sg-row">
            <UiLink
              href="#sg-colors"
              variant="standalone"
            >
              Interno
            </UiLink>
            <UiLink
              href="https://github.com"
              variant="standalone"
            >
              Externo
            </UiLink>
          </div>
          <UiSkipLink target="#sg-components">
            Pular para os componentes (aparece no foco)
          </UiSkipLink>
        </div>

        <div class="sg-demo">
          <h3 class="sg-panel__title">
            UiTag, UiIcon e UiVisuallyHidden
          </h3>
          <div class="sg-row">
            <UiTag>Nuxt</UiTag>
            <UiTag tone="accent">
              Destaque
            </UiTag>
          </div>
          <ul class="sg-row">
            <li
              v-for="name in ICON_NAMES"
              :key="name"
              class="sg-icon"
            >
              <UiIcon :name="name" />
              <code class="sg-mono">{{ name }}</code>
            </li>
          </ul>
          <p>
            <UiIcon
              name="check"
              label="Concluído"
            /> ícone com nome acessível<UiVisuallyHidden> (e este trecho só existe para leitores de tela)</UiVisuallyHidden>.
          </p>
        </div>

        <div class="sg-demo">
          <h3 class="sg-panel__title">
            UiHeading, UiContainer e UiGrid
          </h3>
          <UiHeading
            :level="3"
            :size="5"
          >
            h3 com tamanho do passo 5
          </UiHeading>
          <UiHeading :level="4">
            h4 no tamanho padrão
          </UiHeading>
          <UiContainer
            size="reading"
            class="sg-frame"
          >
            UiContainer reading (68ch)
          </UiContainer>
          <UiGrid class="sg-grid">
            <div
              v-for="span in GRID_SPANS"
              :key="span.class"
              :class="span.class"
            >
              <code class="sg-mono">{{ span.label }}</code>
            </div>
          </UiGrid>
        </div>

        <div class="sg-demo">
          <h3 class="sg-panel__title">
            UiField, UiInput, UiTextarea, UiFieldError e UiStatusMessage
          </h3>
          <form
            class="sg-form"
            novalidate
            @submit.prevent="validateDemo"
          >
            <UiField
              v-slot="field"
              label="[PLACEHOLDER] E-mail"
              description="[PLACEHOLDER] Só para responder à mensagem."
              :error="demoErrors.email"
              required
            >
              <UiInput
                v-model="demoEmail"
                v-bind="field"
                type="email"
                name="email"
                autocomplete="email"
              />
            </UiField>
            <UiField
              v-slot="field"
              label="[PLACEHOLDER] Mensagem"
              :error="demoErrors.message"
              required
            >
              <UiTextarea
                v-model="demoMessage"
                v-bind="field"
                name="message"
              />
            </UiField>
            <UiButton type="submit">
              Validar
            </UiButton>
            <UiStatusMessage :tone="demoStatus">
              {{ demoStatusText }}
            </UiStatusMessage>
          </form>
          <UiStatusMessage
            v-for="tone in STATUS_TONES"
            :key="tone"
            :tone="tone"
          >
            [PLACEHOLDER] Mensagem de status: {{ tone }}
          </UiStatusMessage>
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
          Todas sob a SIL Open Font License 1.1, do Fontsource 5.3.0, servidas pelo próprio site em <code class="sg-mono">{{ FONT_BASE_PATH }}</code> (@nuxt/fonts gera o @font-face e o fallback métrico). O latin-ext e os itálicos só são baixados quando a página usa esses caracteres ou estilos.
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
                  Arquivo
                </th>
                <th scope="col">
                  Eixos
                </th>
                <th scope="col">
                  Tamanho
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in fontRows"
                :key="row.key"
              >
                <td>{{ row.role }}</td>
                <td>{{ row.family }}</td>
                <td><code class="sg-mono">{{ row.file }}</code></td>
                <td>{{ row.axes }}</td>
                <td>{{ formatKb(row.kb) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="sg-note">
          Sem preload (decisão da F01-T3): no primeiro acesso, a página pinta com os fallbacks métricos e as fontes só entram depois do evento <code class="sg-mono">load</code>, sem deslocar o layout; nos acessos seguintes elas vêm do cache desde a primeira pintura. Latin normal das 3 famílias: {{ formatKb(firstScreenKb) }}, fora do caminho do LCP.
        </p>
      </section>
    </main>
  </div>
</template>

<style scoped>
@reference "../../assets/css/main.css";

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

.sg-note {
  margin: 0;
  max-inline-size: var(--container-reading);
  color: var(--color-text-muted);
  font-size: var(--text-step--1);
  line-height: var(--text-step--1--line-height);
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
.sg-demo {
  display: grid;
  gap: var(--sg-gap-md);
  padding-block: var(--sg-gap-lg);
  border-block-start: var(--border-hairline) solid var(--color-border);
}

.sg-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sg-gap-md);
}

.sg-icon {
  display: inline-flex;
  align-items: center;
  gap: var(--sg-gap-sm);
  font-size: var(--text-step-1);
}

.sg-icon code {
  font-size: var(--text-step--1);
}

.sg-frame,
.sg-grid > * {
  padding-block: var(--sg-gap-sm);
  border: var(--border-hairline) dashed var(--color-border);
  font-size: var(--text-step--1);
}

.sg-form {
  display: grid;
  gap: var(--sg-gap-lg);
  justify-items: start;
  max-inline-size: var(--container-reading);
}

.sg-form > * {
  inline-size: 100%;
}

.sg-form > button {
  inline-size: auto;
}
.sg-span-a {
  @apply col-span-4 lg:col-span-8;
}

.sg-span-b {
  @apply col-span-4 lg:col-span-4;
}

.sg-span-c {
  @apply col-span-2 md:col-span-4 lg:col-span-3;
}

.sg-span-d {
  @apply col-span-2 md:col-span-4 lg:col-span-9;
}
</style>
