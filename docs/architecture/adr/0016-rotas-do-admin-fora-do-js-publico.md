# ADR-0016 — Rotas do admin fora do JS público

- **Status:** Aceito (2026-10-30).
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0003 (orçamentos e cache), ADR-0005 (admin como SPA), [performance-budgets](../../quality/performance-budgets.md), F11-T6

## Contexto

- O Nuxt gera uma única tabela de rotas, e ela vai no entry de **toda** página pública. Cada rota leva o caminho, a meta (`{ i18n: false, layout: 'admin', middleware: 'admin' }`) e a lista de dependências para preload.
- Medido na F11-T6: as 14 telas do admin pesavam **0,74 kB gz** em toda rota pública, cerca de 0,05 kB por tela. Na F07-T1, isso levou o R3 a 120,07/120, e o owner subiu o limite para 121 de forma temporária.
- O admin já é uma SPA (`ssr: false` em `/admin/**`, ADR-0005). As rotas dele só precisam existir no navegador de quem abre o admin.

## Decisão

1. **Módulo local `modules/admin-routes.ts`**, que roda no build:
   - no `pages:resolved`, registrado depois de todos os módulos (`modules:done`) para rodar depois do `@nuxtjs/i18n` e da extração da meta das páginas, tira da tabela pública as páginas de `/admin/**`;
   - põe no lugar uma rota-ponte `admin-bridge` (`/admin/:rest(.*)*`, `app/admin/RouteBridge.vue`, sem layout e sem conteúdo);
   - gera o template `#build/admin-routes.mjs` com as rotas reais. A meta vem do `?macro=true` de cada página mais os campos extraídos (como `middleware`); o componente é carregado sob demanda.
2. **Middleware global `app/middleware/admin-routes.global.ts`:** na primeira navegação para `/admin/**`, importa `#build/admin-routes.mjs`, registra as rotas, remove a ponte e refaz a navegação para a mesma URL. Se nenhuma tela casar, responde 404, como antes.
3. As páginas continuam em `app/pages/admin/**` com o seu `definePageMeta`. URLs, layout, middleware e guards de saída do editor não mudam.
4. O `check:budgets` proíbe nomes de rota do admin (`admin-artigos`) no JS das rotas públicas, e o R3/R8 voltam a **120 KB**.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Um app Nuxt separado para o admin | Outra build, outro deploy e configuração duplicada; desproporcional para o projeto |
| Uma página única `/admin/[...path]` com um roteador próprio | Os guards de saída (`onBeforeRouteLeave`) não disparam entre telas da mesma rota, e o autosave do editor depende deles |
| Manter as rotas e subir o orçamento a cada tela nova | O custo cresce com o admin e pesa sobre os leitores, que nunca o abrem |

## Consequências

### Positivas
- −0,79 kB gz em toda rota pública (R3: 120,31 → 119,52). Telas novas do admin não pesam mais no público.

### Negativas e custos
- Uma peça de build a mais, que depende de hooks do Nuxt (`pages:resolved`, `modules:done`) e da forma dos templates de rota.
- O primeiro acesso ao admin faz uma importação a mais (a tabela de rotas, 1,4 kB gz) antes de abrir a tela.

### Riscos e mitigação
- **Uma atualização do Nuxt mudar a ordem dos hooks ou a extração da meta.** Mitigação: `tests/e2e/admin-routes.spec.ts` (URL profunda, recarregamento, navegação do público para o admin, 404 e nenhuma tabela do admin numa página pública), as suítes do admin e o `check:budgets`.
- **Rotas do admin aninhadas não são suportadas:** o módulo falha o build se aparecerem.

## Validação

- F11-T6: `pnpm check:budgets` com o R3 em 119,52/120; suíte completa verde; `tests/e2e/admin-routes.spec.ts`.
