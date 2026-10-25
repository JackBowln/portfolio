---
name: frontend-design
description: Implementa interfaces públicas deste portfólio com fidelidade à direção visual aprovada — design editorial premium, tokens do Tailwind 4, tipografia fluida, temas claro/escuro, responsividade de 360 a 1920 px e acessibilidade WCAG 2.2 AA. Use ao criar ou alterar páginas, layouts, componentes de UI, tokens, fontes, estados (vazio, carregando, erro), imagens responsivas ou ao fazer QA visual.
when_to_use: "Gatilhos: 'criar página', 'componente', 'layout', 'header', 'card', 'estilizar', 'responsivo', 'mobile', 'tema escuro', 'tipografia', 'design system', 'ajustar visual', 'QA visual'."
argument-hint: "[página | componente | rota]"
---

# Frontend Design

Objetivo: interfaces com identidade própria, editoriais e precisas, que sejam rápidas e acessíveis por construção. O motion tem skill própria (`/motion-engineer`); aqui o foco é estrutura, estilo e responsividade.

## Antes de começar

1. Leia `docs/design/design-direction.md` (as escolhas aprovadas estão no §9; sem aprovação, não invente a direção: apresente opções) e [references/design-tokens.md](references/design-tokens.md).
2. Confira se já existe um componente em `app/components/ui/` ou `layout/` que resolva. Reutilize ou estenda antes de criar.
3. Consulte a rota no PRD §9 e os orçamentos em `docs/quality/performance-budgets.md`.

## Regras

- **Só tokens.** Cores, espaços, tamanhos, raios, sombras e durações vêm de `@theme` (sem valores mágicos). Token novo só com motivo, seguindo a convenção de nomes.
- **Mobile-first**, tipografia fluida (`clamp`), container queries em componentes reutilizáveis; nenhuma rolagem horizontal em 320 px.
- **Semântica primeiro:** landmarks, um `h1`, headings em ordem, listas, `button` para ações e `a` para navegação.
- **Acessibilidade:**
  - foco visível (token `focus`) e alvos ≥ 24×24 px (preferencialmente 44);
  - contraste AA nos dois temas;
  - nomes acessíveis e estados ARIA corretos;
  - hover nunca é a única forma de acesso.
- **Textos** sempre por chaves de i18n (`/i18n-manager`); nada de texto hardcoded nem de conteúdo inventado (`[PLACEHOLDER]` quando faltar).
- **Imagens** sempre via `<ResponsiveImage>` (dimensões, `sizes`, `alt` do idioma); `priority` só no LCP.
- **Estados:** vazio, carregando (skeleton sem CLS) e erro, com mensagem útil e caminho de saída.
- **JS mínimo:** componente estático não hidrata; ilha interativa só quando necessário; nada de biblioteca de UI no público.
- **Sem cookies** (tema e preferências em `localStorage`).

Checklist completo por componente: [references/component-checklist.md](references/component-checklist.md).

## QA visual (antes de concluir)

Siga [references/responsive-qa.md](references/responsive-qa.md):
- screenshots em 360, 390, 768, 1024, 1280, 1440 e 1920 px, nos temas claro e escuro, com movimento reduzido;
- zoom de 200% e reflow a 320 px;
- passada completa por teclado;
- axe sem violações sérias ou críticas no template.

## Relatório

Inclua:
- componentes criados ou alterados;
- tokens adicionados (com motivo);
- prints dos breakpoints principais (ou o caminho dos arquivos);
- resultado do axe e do teclado;
- impacto no orçamento (`pnpm check:budgets`);
- pendências de conteúdo real.
