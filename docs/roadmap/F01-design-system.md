# F01 — Design system e shell público

**Objetivo da fase:** uma identidade visual própria e aprovada, com tokens, fontes, componentes base e o layout do site (header, navegação, footer, páginas de erro), tudo acessível e dentro do orçamento.

**Pré-requisitos:** o gate da F00 cumprido. Para a F01-T1, as referências visuais (Q-02) e a preferência de tema (Q-03). A F01-T5 depende da F02-T2 (i18n).

**Leitura obrigatória:** [design-direction](../design/design-direction.md), [ADR-0010](../architecture/adr/0010-design-system.md), [accessibility](../quality/accessibility.md), [performance-budgets](../quality/performance-budgets.md).

**Gate de saída:** design-direction §9 preenchido com as suas escolhas, e o shell público com axe sem violações sérias ou críticas em 360, 768 e 1280 px.

---

### F01-T1 — Direção visual e styleguide de desenvolvimento

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| em andamento | F00 (gate) | RX-01, RNF-10, RNF-11 | `/frontend-design` |

> Iniciada em 2026-10-25 antes do gate da F00, por decisão do owner. O `pnpm lint` (F00-T2), o axe e o E2E do 404 (F00-T4) rodam quando essas tarefas existirem; a tarefa só é concluída depois deles e da escolha do owner.

**Objetivo.** Montar a rota `/dev/styleguide`, que existe **só em desenvolvimento**, com duas variações de par tipográfico e paleta para você escolher.

**Arquivos prováveis.** `app/pages/dev/styleguide.vue` (registrada só em dev), `app/assets/css/styleguide-variants.css` (temporário), `docs/design/design-direction.md` (§9).

**Fora do escopo.** Tokens definitivos (T2) e componentes de produção (T4).

**Critérios de aceite**
- [x] Duas variações navegáveis: escala tipográfica, títulos, parágrafo longo, bloco de código, card, botão, link e cores em claro e escuro.
- [x] Conteúdo real fornecido por você, ou `[PLACEHOLDER]` marcado; nenhuma biografia inventada.
- [x] Contraste calculado e mostrado para cada par texto/fundo; licença de cada fonte registrada.
- [x] A rota não existe no build de produção (404). Conferido com `curl` no preview; o teste E2E entra com a F00-T4.
- [x] **Você escolhe** a variação, e a escolha é registrada no §9 com data. Par tipográfico A (escolha do owner) e paleta B (por delegação), em 2026-10-25.

**Testes**
- E2E: `/dev/styleguide` retorna 404 no build de produção.
- axe na styleguide (em dev) sem violações sérias ou críticas.

---

### F01-T2 — Tokens do Tailwind 4 e temas claro e escuro

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F01-T1 | RX-01, RNF-10 | `/frontend-design`, `/architecture-guardian` |

**Objetivo.** Instalar `tailwindcss ~4.3` com `@tailwindcss/vite` e definir os tokens finais em `@theme`, com os temas por `data-theme` e `prefers-color-scheme`.

**Arquivos prováveis.** `app/assets/css/main.css`, `nuxt.config.ts` (vite plugin, css), `shared/design/tokens.ts`, `app/plugins/theme.client.ts`, script inline de tema (head), `scripts/check-contrast.mjs`, `package.json` (`check:contrast`).

**Fora do escopo.** Fontes (T3); a CSP do script inline (F03-T4, que calcula o hash).

**Critérios de aceite**
- [ ] Tokens de cor (OKLCH), tipografia fluida, espaço, raios, camadas, breakpoints e motion conforme o ADR-0010, com nomes semânticos.
- [ ] `pnpm check:contrast` valida todos os pares e falha abaixo de AA (falha demonstrada com um par ruim).
- [ ] Trocar de tema não causa FOUC; a preferência fica em `localStorage` e **nenhum cookie é emitido**.
- [ ] Sem valores mágicos fora dos tokens (revisão pelo `/frontend-design`).
- [ ] O `app/assets/css/styleguide-variants.css` (temporário da F01-T1) foi removido, e a styleguide lê os tokens finais; o `check:contrast` reaproveita `shared/design/contrast.ts`.

**Testes**
- Unit: as funções de contraste do script.
- Nuxt: o toggle de tema grava e lê a preferência e respeita `prefers-color-scheme`.
- API: a resposta da home não contém `Set-Cookie`.

---

### F01-T3 — Fontes self-hosted com fallback métrico

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F01-T2 | RX-01, RNF-01, RNF-03 | `/frontend-design`, `/performance-audit` |

**Objetivo.** Configurar `@nuxt/fonts` com o par escolhido: WOFF2, subsets `latin` e `latin-ext` (este via `unicode-range`), preload de no máximo 2 arquivos e fallback com `size-adjust`.

**Arquivos prováveis.** `nuxt.config.ts` (fonts), `app/assets/css/main.css` (famílias nos tokens), `public/fonts/` (se forem arquivos locais).

**Fora do escopo.** Mudar o par tipográfico (já aprovado na T1).

**Critérios de aceite**
- [ ] Nenhuma requisição de fonte a terceiros.
- [ ] Primeira tela com ≤ 2 arquivos e ≤ 120 KB de fonte.
- [ ] CLS = 0 atribuível a fontes (trace ou Lighthouse); diacríticos de pt, es, de e fr renderizados corretamente, incluindo "œ", "ß" e "ñ".
- [ ] Os pacotes `@fontsource*` temporários da F01-T1 foram removidos das devDependencies.

**Testes**
- `/performance-audit` na home placeholder (relatório anexado).
- E2E: a página com texto de teste em 5 idiomas não dispara requisições a domínios externos.

---

### F01-T4 — Componentes base acessíveis

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F01-T2 | RX-01, RNF-10, RNF-11 | `/frontend-design`, `/test-engineer` |

**Objetivo.** Criar os primitivos em `app/components/ui/`: Button, Link, Container, Grid, Heading, Prose, Tag, Icon (SVG inline), VisuallyHidden, SkipLink, Field, Input, Textarea, FieldError e StatusMessage.

**Arquivos prováveis.** `app/components/ui/*.vue`, `app/assets/icons/*.svg`, `tests/nuxt/ui/*.test.ts`, seção de componentes na styleguide.

**Fora do escopo.** O link localizado (F02-T2 cria o wrapper sobre `NuxtLinkLocale`); componentes de domínio.

**Critérios de aceite**
- [ ] Todo componente tem os estados hover, `focus-visible`, active e disabled (quando aplicável), alvo ≥ 24×24 px e nome acessível.
- [ ] Os campos de formulário associam label, descrição e erro (`aria-describedby`); o erro é anunciado por `aria-live`.
- [ ] Os textos chegam por props ou slots (nenhum texto de interface hardcoded).
- [ ] Cada componente aparece na styleguide com as variantes.

**Testes**
- Nuxt: render e atributos ARIA por componente; interação por teclado no Button e no Link.
- a11y: axe na styleguide.

---

### F01-T5 — Layout público, navegação e páginas de erro

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F01-T4, F02-T2 | RF-01.8, RX-01, RNF-10, RNF-11 | `/frontend-design`, `/i18n-manager` |

**Objetivo.** Criar o header (nome e navegação), o menu mobile (dialog acessível), o footer, o encaixe do seletor de idioma, os layouts `default` e `reading` e o `error.vue` (404/500 localizados).

**Arquivos prováveis.** `app/components/layout/*.vue`, `app/layouts/default.vue`, `app/layouts/reading.vue`, `app/error.vue`, chaves `layout.*`/`errors.*` em `i18n/locales/*.json`.

**Fora do escopo.** O conteúdo das páginas (F06–F08); motion (F10).

**Critérios de aceite**
- [ ] Skip link como primeiro foco; landmarks corretos; `nav` com rótulo.
- [ ] Menu mobile com foco preso, `Esc` fecha, foco devolvido ao botão e `aria-expanded` correto.
- [ ] O header fixo (se houver) não cobre o foco (`scroll-padding-top`).
- [ ] 404 e 500 localizados nos 5 idiomas, com link para a home do idioma; status HTTP correto.
- [ ] Responsivo de 360 a 1920 px sem rolagem horizontal; JS do layout dentro do orçamento (`check:budgets`).

**Testes**
- E2E: navegação por teclado completa; menu mobile em viewport de 390 px.
- a11y: axe no layout em pt-BR e de, nos temas claro e escuro.
- API: 404 em rota inexistente de cada idioma.

---

## Prompt da fase

```text
Fase F01 — Design system e shell público. Projeto: ~/Desktop/dev/portfolio.

Leia CLAUDE.md, docs/roadmap/F01-design-system.md, docs/design/design-direction.md e o ADR-0010. Pegue a primeira tarefa "pendente" com dependências concluídas (a F01-T5 depende da F02-T2).

Antes de editar: apresente objetivo, arquivos, abordagem, dependências novas (checklist do /architecture-guardian), testes e riscos. Aguarde minha aprovação.

Regras desta fase:
- Não escolha a direção visual por mim: na F01-T1 apresente as variações e espere minha escolha.
- Nenhuma biografia, métrica ou texto inventado: use conteúdo que eu fornecer ou [PLACEHOLDER].
- Só tokens (sem valores mágicos), nenhum cookie e nenhum texto de interface hardcoded.
- Use /frontend-design em todas as tarefas; /performance-audit na F01-T3.

Depois de implementar: rode typecheck, lint, os testes relevantes e o axe; cole a saída real; atualize o status e os docs; entregue o relatório da Definition of Done. Não faça commit sem eu pedir.
```
