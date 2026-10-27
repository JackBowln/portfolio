# ADR-0010 — Design system: Tailwind CSS 4, tokens e fontes self-hosted

- **Status:** Aceito (2026-10-25)
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0011, [design-direction](../../design/design-direction.md), RX-01, RX-04, RNF-01, RNF-10, RNF-11

## Contexto

- O pedido é um design editorial premium e próprio, com tipografia marcante, leitura excelente, contraste AA, CLS zero e CSS enxuto.
- Tailwind 4.3 tem configuração CSS-first (`@theme`) e plugin Vite oficial. O `@nuxtjs/tailwindcss` é da geração v3.
- `@nuxt/fonts` 1.2 faz self-hosting e fallback métrico.

## Decisão

1. **Tailwind CSS `~4.3`** via `@tailwindcss/vite` em `vite.plugins`, com a entrada em `app/assets/css/main.css` (`@import "tailwindcss";` + `@theme`). Sem `tailwind.config.js` e sem o módulo `@nuxtjs/tailwindcss`.
2. **Tokens** como variáveis CSS em `@theme`, espelhadas em `shared/design/tokens.ts` só no que o JS precisa (motion e breakpoints):
   - **Cor (OKLCH):** neutros em 11 passos e um acento, mais os semânticos `bg`, `surface`, `text`, `text-muted`, `border`, `accent`, `accent-contrast`, `focus`, `success`, `warning` e `danger`. Todo par texto/fundo é verificado para AA (texto normal ≥ 4,5:1; grande ≥ 3:1; UI ≥ 3:1).
   - **Tipografia:** famílias `display` (serifada ou expressiva), `sans` (texto e UI) e `mono` (código). Escala fluida com `clamp()` (passos −1 a 7). Medida de leitura de 60–75 caracteres. `line-height` por passo.
   - **Espaço e layout:** escala base de 4 px mais espaços fluidos de seção. Grid editorial de 12 colunas no desktop e 4 no mobile. Container queries para os componentes.
   - **Outros:** raios, sombras mínimas, camadas (`z-index`) nomeadas e breakpoints `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536.
   - **Motion:** durações (120, 200, 320, 500, 800 ms) e easings nomeados, compartilhados com o GSAP ([ADR-0011](0011-motion.md)).
3. **Temas claro e escuro.**
   - Seguem `prefers-color-scheme` por padrão; o toggle manual fica em `localStorage`, nunca em cookie.
   - Um script inline mínimo no `<head>` aplica `data-theme` antes da pintura e é permitido na CSP por hash ([ADR-0012](0012-seguranca.md)).
   - O padrão segue o sistema (Q-03, respondida em 2026-10-25).
4. **Fontes.**
   - Licença livre (OFL, Google Fonts, Fontshare, ou outra explicitamente gratuita para web), self-hosted pelo `@nuxt/fonts`, em WOFF2, com subsets `latin` e `latin-ext` (diacríticos de pt, es, de e fr).
   - `font-display: swap` com fallback métrico (`size-adjust`) e **no máximo 2 arquivos com preload**. Fontes variáveis são preferidas.
   - O par final sai da F01-T1 ([design-direction](../../design/design-direction.md)).
5. **Componentes próprios**, sem kit visual.
   - Os primitivos ficam em `app/components/ui/` (auto-import com prefixo `Ui`).
   - Padrões interativos seguem o WAI-ARIA APG: disclosure, dialog do menu móvel e tabs do admin.
   - Ícones são SVG inline versionados, sem fonte de ícones.
6. **Admin.** Usa os mesmos tokens e componentes mais densos. Uma biblioteca headless para o admin (por exemplo, para comboboxes) só entra com justificativa na tarefa e nunca no bundle público.
7. **Proibido:** valores mágicos (cores, espaços e tamanhos fora dos tokens); `!important` fora de utilitários de acessibilidade; CSS que esconda conteúdo à espera de JS ([ADR-0011](0011-motion.md)).

### Decisões da F01-T2 (owner, 2026-10-27)

- **Temas com `light-dark()`:**
  - cada token semântico é declarado uma vez, `light-dark(<claro>, <escuro>)`, sobre a paleta bruta;
  - o `:root` tem `color-scheme: light dark`, e `[data-theme]` força um dos dois;
  - não há bloco duplicado entre a media query e o atributo, e sem JS o sistema decide.
- **Toggle de 2 estados:** `LayoutThemeToggle` é um botão com `aria-pressed` ("Tema escuro").
  - Grava `localStorage.theme`; não há como voltar a "seguir o sistema" depois de escolher.
  - Fica invisível até montar, porque sem JS não funcionaria; o `visibility` preserva o espaço e evita CLS.
  - O script inline (`THEME_INIT_SCRIPT` em `shared/design/theme.ts`) é estático, para o hash da CSP na F03-T4.
- **Só tokens do projeto:**
  - `@theme static { --*: initial; … }` apaga os padrões do Tailwind, então só os tokens geram utilitários;
  - o `static` emite todas as variáveis, para componentes, a styleguide e o JS;
  - valores arbitrários (`p-[13px]`) ficam proibidos por revisão.
- **`@source not "../../pages/dev"`:** a styleguide usa CSS escopado e não adiciona utilitários ao CSS público.
- **Nomes:**
  - paleta bruta `night` (11 passos, com os valores aprovados na F01-T1), `paper`, `rose`, `green`, `amber` e `red`;
  - semânticos `bg`, `surface`, `text`, `text-muted`, `border`, `accent` (também cor de link), `accent-contrast`, `focus`, `success`, `warning` e `danger`;
  - `success`, `warning` e `danger` são novos; o owner pode revisá-los na styleguide;
  - escala `--text-step--1…7` com `--line-height` e, do passo 3 em diante, `--letter-spacing`;
  - espaço `--spacing` (4 px), `--spacing-gutter` e `--spacing-section`;
  - em `:root`: `--dur-*`, `--distance-*`, `--z-*`, os tokens de foco, alvo (`--target-min` 24 px e `--target-comfortable` 44 px) e estado (`--state-hover-mix`, `--state-active-mix`, `--opacity-disabled`).
- **Movimento reduzido:** as durações acima de `--dur-fast` caem para ela e as distâncias vão a zero.
- **Fonte única do contraste:** `pnpm check:contrast` e a styleguide leem as cores do próprio `main.css` (`shared/design/css-tokens.ts`). `shared/design/tokens.ts` espelha o motion, os breakpoints e a escala, e um teste compara os dois.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| `@nuxtjs/tailwindcss` | Integração da v3; o plugin Vite é o caminho oficial da v4 |
| UnoCSS | Bom, mas a stack pediu Tailwind 4 |
| Nuxt UI ou outro kit | Visual genérico e peso extra no público |
| Fontes do Google por CDN | Requisição de terceiros e risco de privacidade e performance |

## Consequências

### Positivas
- CSS mínimo gerado sob demanda; tokens únicos para CSS e JS; zero CLS de fonte.

### Negativas e custos
- Todos os componentes interativos são escritos e testados por nós (a11y incluída).

### Riscos e mitigação
- **Deriva visual entre páginas:** o styleguide só de dev (F01-T1) e o QA visual da skill `/frontend-design`.

## Validação

- F01-T2: `pnpm check:contrast` com 16 pares × 2 temas, que falha abaixo de AA (falha demonstrada em `tests/unit/check-contrast.test.ts`); espelho TS × CSS em `tests/unit/design-tokens.test.ts`; sem FOUC e sem cookie (`tests/e2e/theme.spec.ts`, `tests/api/theme.spec.ts`); axe nos temas do sistema e forçados.
- F01-T3: Lighthouse sem avisos de fonte; CLS = 0 no carregamento de fontes.

## Referências

- Tailwind CSS v4 (`@theme`, `@tailwindcss/vite`)
- WAI-ARIA Authoring Practices Guide
- WCAG 2.2 (1.4.3, 1.4.11, 2.4.7, 2.4.11)
