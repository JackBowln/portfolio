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
   - O tema padrão aguarda a resposta da Q-03 do PRD.
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

- F01-T2: script de contraste sobre os pares de tokens (falha abaixo de AA).
- F01-T3: Lighthouse sem avisos de fonte; CLS = 0 no carregamento de fontes.

## Referências

- Tailwind CSS v4 (`@theme`, `@tailwindcss/vite`)
- WAI-ARIA Authoring Practices Guide
- WCAG 2.2 (1.4.3, 1.4.11, 2.4.7, 2.4.11)
