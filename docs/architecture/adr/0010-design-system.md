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

### Decisões da F01-T3 (owner, 2026-10-27)

- **Arquivos versionados no repositório:** WOFF2 do Fontsource 5.3.0 (OFL-1.1, com o `OFL.txt` ao lado) em `public/fonts/v5.3.0/`, com cache `immutable` pela versão no caminho.
  - Fraunces `opsz`+`wght` e Inter `wght`, cada uma em normal e itálico; JetBrains Mono `wght` normal. Todas em `latin` e `latin-ext`.
  - Os provedores remotos do `@nuxt/fonts` estão desligados: nem o build nem o visitante buscam fonte em terceiros.
  - `local()` também está desligado, para não usar uma cópia instalada sem os nossos eixos.
  - A lista fica em `shared/design/fonts.ts`, e o `nuxt.config` gera dela as famílias do `@nuxt/fonts`.
- **Fallback métrico:** o `@nuxt/fonts` gera, por exemplo, `"Inter Fallback: Arial"` com `size-adjust` e `ascent-override`. Em produção ele leva os `@font-face` para um `<style>` no `<head>` (coberto pelo `style-src 'unsafe-inline'` do ADR-0012).
- **Sem preload; fontes depois do `load` no primeiro acesso.** Isso substitui o preload de Fraunces + Inter previsto na design-direction §9.
  - Medido no Lighthouse mobile (perf-log): com os 2 preloads, a nota caiu de 99 para 94 e o LCP subiu de 1,81 para 2,86 s; com preload só da Inter, ficou em 96 e 2,41 s; sem preload, em 95 e 2,41 s.
  - O script inline `FONT_LOADING_SCRIPT` marca `html.fonts-pending`. Enquanto a classe existe, o CSS inline `FONT_PENDING_CSS` faz os tokens `--font-*` apontarem só para os fallbacks.
  - No primeiro frame depois do `load` (F06-T5; antes, no próprio `load`), a classe sai: as fontes baixam e entram sem deslocar o layout (CLS 0,000), e `localStorage.fonts` faz os acessos seguintes usarem as fontes desde a primeira pintura. O frame a mais deixa pintar antes uma imagem que terminou junto com a página (a capa LCP da lista do blog): sem ele, a simulação do Lighthouse contava as fontes no LCP (R2 mobile 89 → 95).
  - Sem JS, nada é segurado, e as fontes carregam como qualquer outra.
  - Custo aceito: no primeiro acesso, a troca de fonte é visível depois do carregamento.

### Decisões da F01-T4 (owner, 2026-10-27)

- **Primitivos em `app/components/ui/`:** Button, Link, Container, Grid, Heading, Prose, Tag, Icon, VisuallyHidden, SkipLink, Field, Input, Textarea, FieldError e StatusMessage. Só tokens; nenhum texto fixo (props e slots).
- **Ícones:** paths de 10 ícones do Lucide (ISC, aviso de licença em `app/utils/icons.ts`), copiados sem instalar pacote. O `UiIcon` desenha `<path :d>`, sem `v-html`; é decorativo por padrão e vira `role="img"` com `label`.
- **Links:**
  - o `UiLink` valida o protocolo com `shared/utils/url.ts` (`safeHref`): http(s), mailto, tel e caminhos do site;
  - qualquer outro alvo (`javascript:`, `data:`, `//host`, barras invertidas, caracteres de controle) vira texto;
  - links externos levam `rel="noopener noreferrer"` e nunca abrem nova aba.
- **Campos:** o `UiField` gera ids (`useId`) e entrega `{ id, describedby, invalid, required }` por slot com escopo, que o controle recebe via `v-bind`.
  - O `UiFieldError` é uma região `aria-live="polite"` sempre presente e nunca `display: none`.
  - O obrigatório é o `required` nativo, com o "*" `aria-hidden`.
- **Mensagens de status:** o `UiStatusMessage` usa `role="alert"` só para `danger`; os outros tons usam `role="status"`.
- **Tokens de estado:**
  - `accent-hover`, `accent-active` e `surface-active` são valores OKLCH explícitos em `light-dark()`, conferidos pelo `check:contrast`, em vez de `color-mix` em tempo de execução;
  - `--icon-size` e `--code-inline-size` (em `em`) evitam valores soltos.
- **Lint:** `UiLink`, `UiLocalizedLink`, `UiTag`, `UiIcon` e `UiVisuallyHidden` são isentos de `vue/singleline-html-element-content-newline` (`externalIgnores`), como `<a>` e `<span>`: uma quebra de linha dentro deles vira um espaço visível no texto.
- **Styleguide:** como `main.css` não varre `app/pages/dev`, a página aplica utilitários por `@apply` no CSS escopado, com `@reference` ao `main.css`, para não levar classes de demonstração ao CSS público.

### Decisões da F01-T5 (owner, 2026-10-29)

- **Moldura única:** `LayoutSiteShell` monta skip link → header → o único `<main id="main" tabindex="-1">` → footer. As páginas não têm `<main>` próprio. Os layouts `default` e `reading` só escolhem a largura do `main`; o `reading` (artigo do blog) usa a medida de leitura e não tem motion.
- **Header estático** (não fixo): nome do site, seções e botão de tema. Ele quebra em duas linhas em telas estreitas. Abaixo de `md`, as seções vão para o menu mobile. O `scroll-padding-block-start` dá um respiro às âncoras.
- **Menu mobile:** `<dialog>` modal aberto por `command="show-modal"`/`commandfor`, que funciona antes da hidratação e sem JS; o clique chama `showModal()` nos navegadores sem invoker commands.
  - O modal deixa a página inerte; `Esc` fecha e o navegador devolve o foco ao botão.
  - O Tab dá a volta dentro do diálogo (o modal nativo deixaria o foco sair para a interface do navegador).
  - `aria-expanded` acompanha o evento `close`; navegar fecha o menu; a página atrás não rola.
- **Footer:** as seções de novo (o caminho pelo site sem JS), a privacidade, o seletor de idioma (uma vez por página, por isso fora do header) e "© {ano} {nome}" com o ano via `Intl`.
- **Páginas de erro:** `app/error.vue` dentro do layout `default`. Mostra o 404 ou a mensagem genérica de servidor para qualquer outro status, com link para a home do idioma, `noindex` e `<html lang>` próprio (o Nuxt não renderiza o `app.vue` no erro). Não usa script inline, o que tirou a exceção da CSP (ADR-0012). Um plugin de servidor troca a mensagem dos erros 5xx no payload pelo texto de status.

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
- F01-T4: `tests/nuxt/ui/*.test.ts` (render, ARIA, ligação dos campos, região viva, protocolo dos links), `tests/unit/url.test.ts`, `tests/a11y-dev/components-keyboard.spec.ts` (Enter/Espaço, Tab pulando desabilitados, skip link, formulário por teclado) e axe na styleguide nos 4 cenários de tema.
- F01-T3: Lighthouse R1/R6 mobile 99 e desktop 100, CLS 0,000 e sem avisos de fonte; `tests/e2e/fonts.spec.ts` (nenhuma requisição externa nos 5 idiomas, faces carregadas cobrindo œ, ß, ñ e latin-ext, nenhuma fonte antes do `load` no primeiro acesso, troca sem deslocamento); `tests/api/fonts.spec.ts`; `tests/unit/fonts.test.ts`.
- F01-T5: `tests/e2e/layout.spec.ts` (skip link como primeiro foco, ordem do header, footer, menu a 390 px com foco preso, `Esc`, foco devolvido e `aria-expanded`, menu sem JS, nenhuma rolagem horizontal a 360 px, medida de leitura, 404 em navegação no cliente), `tests/a11y/layout.spec.ts` (pt-BR e de, claro e escuro, 360/768/1280 px, menu aberto e 404), `tests/api/errors.spec.ts` (404 e 500 nos 5 idiomas) e `tests/nuxt/app.test.ts`.

## Referências

- Tailwind CSS v4 (`@theme`, `@tailwindcss/vite`)
- WAI-ARIA Authoring Practices Guide
- WCAG 2.2 (1.4.3, 1.4.11, 2.4.7, 2.4.11)
