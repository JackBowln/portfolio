# Registro de performance

Protocolo em [performance-budgets](performance-budgets.md) §2 e comandos em `.claude/skills/performance-audit/references/measurement-protocol.md`. Cada linha é a **mediana de 3 execuções**, entre parênteses a variação quando não for zero, sempre com o relatório gerado na mesma sessão (`reports/lighthouse/<data>/`, fora do git).

## Lighthouse

| Data | Commit | Ferramenta / LH | Chrome | Ambiente | Rota | Disp. | Perf | A11y | BP | SEO | LCP | TBT | CLS | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-26 | `490e1eb` | `pnpm lighthouse` / 13.5.0 | Chrome for Testing 156.0.8078.4 | local, `wrangler dev` (build de produção) | R1 `/` | mobile | 100 | 100 | 100 | 90 | 1512 ms | 0 ms | 0 | Baseline do esqueleto. SEO 90: `meta-description` ausente no placeholder, a resolver com o SEO por página na F02. Elemento LCP: `<h1>`. FCP 1212 ms, SI 1212 ms |
| 2026-10-26 | `490e1eb` | `pnpm lighthouse` / 13.5.0 | Chrome for Testing 156.0.8078.4 | local, `wrangler dev` (build de produção) | R1 `/` | desktop | 100 | 100 | 100 | 90 | 412 ms | 0 ms | 0 | Idem. FCP 332 ms, SI 332 ms |
| 2026-10-26 | F02-T2 (não commitado, base `af5738e`) | `pnpm lighthouse` / 13.5.0 | Chrome 156.0.0.0 | local, `wrangler dev` (build de produção) | R1 `/` | mobile | 99 | 100 | 100 | 90 | 1809 ms | 0 ms | 0 | Com `@nuxtjs/i18n` (+33 KB de JS). FCP 1510 ms (era 1212): o JS maior compete com o HTML na simulação. SEO 90 pelo mesmo motivo da baseline (F02-T3). Elemento LCP: `<h1>` |
| 2026-10-26 | F02-T2 (não commitado, base `af5738e`) | `pnpm lighthouse` / 13.5.0 | Chrome 156.0.0.0 | local, `wrangler dev` (build de produção) | R1 `/` | desktop | 100 | 100 | 100 | 90 | 409 ms | 0 ms | 0 | Idem. FCP 329 ms |
| 2026-10-26 | F02-T3 (não commitado, base `1f3bcd5`) | `pnpm lighthouse` / 13.5.0 | Chrome 156.0.0.0 | local, `pnpm preview:prod` (build de produção, `ENVIRONMENT=production`) | R1 `/` | mobile | 99 (±1) | 100 | 100 | 100 | 1662 ms | 0 ms | 0 | SEO 100 com `usePageSeo` (description, canonical, hreflang). Elemento LCP: `<h1>` |
| 2026-10-26 | F02-T3 (não commitado, base `1f3bcd5`) | `pnpm lighthouse` / 13.5.0 | Chrome 156.0.0.0 | idem | R1 `/` | desktop | 100 | 100 | 100 | 100 | 411 ms | 0 ms | 0 | — |
| 2026-10-26 | F02-T3 (não commitado, base `1f3bcd5`) | `pnpm lighthouse` / 13.5.0 | Chrome 156.0.0.0 | idem | R6 `/sobre` | mobile | 99 (±2) | 100 | 100 | 100 | 1811 ms | 0 ms | 0 | Esqueleto indexável; LCP 11 ms acima da meta de 1,8 s. Elemento LCP: `<h1>` |
| 2026-10-26 | F02-T3 (não commitado, base `1f3bcd5`) | `pnpm lighthouse` / 13.5.0 | Chrome 156.0.0.0 | idem | R6 `/sobre` | desktop | 100 | 100 | 100 | 100 | 382 ms | 0 ms | 0 | — |
| 2026-10-27 | F01-T2 (não commitado, base `25bb042`) | `pnpm lighthouse` / 13.5.0 | Chrome 156.0.0.0 | local, `pnpm preview:prod` | R1 `/` | mobile | 99 (±1) | 100 | 100 | 100 | 1815 ms | 0 ms | 0 | Tailwind 4 + tokens: primeira folha de CSS (3,2 kB gzip), que bloqueia a renderização. FCP 1708 ms. Elemento LCP: link da navegação (o `<h1>` do esqueleto é menor) |
| 2026-10-27 | F01-T2 (não commitado, base `25bb042`) | `pnpm lighthouse` / 13.5.0 | Chrome 156.0.0.0 | idem | R1 `/` | desktop | 100 | 100 | 100 | 100 | 370 ms | 0 ms | 0 | — |
| 2026-10-27 | F01-T2 (não commitado, base `25bb042`) | `pnpm lighthouse` / 13.5.0 | Chrome 156.0.0.0 | idem | R6 `/sobre` | mobile | 99 | 100 | 100 | 100 | 1812 ms | 0 ms | 0 | LCP 12 ms acima da meta de 1,8 s, como na F02-T3; as fontes (F01-T3) e o layout (F01-T5) remedem |
| 2026-10-27 | F01-T2 (não commitado, base `25bb042`) | `pnpm lighthouse` / 13.5.0 | Chrome 156.0.0.0 | idem | R6 `/sobre` | desktop | 100 | 100 | 100 | 100 | 457 ms | 0 ms | 0 | — |

O TTFB local não representa a borda; o número real vem do deploy de preview (F00-T6).

## Orçamentos (`pnpm check:budgets`)

| Data | Commit | Rota | JS inicial (kB gzip) | CSS (kB gzip) | Limites | Notas |
|---|---|---|---|---|---|---|
| 2026-10-26 | `490e1eb` | R1 `/` | 68,56 | 0,00 | 110 / 30 | Entrada + `pages/index.vue` |
| 2026-10-26 | `490e1eb` | E404 (página de erro do Nuxt) | 70,07 | 0,92 | 110 / 30 | Não auditável pelo Lighthouse, que só mede documentos 2xx |
| 2026-10-26 | F02-T2 (não commitado, base `af5738e`) | R1 `/` | 101,86 | 0,00 | 125 / 30 | Com `@nuxtjs/i18n` e `fullInstall: false`; sem o i18n eram 68,56 |
| 2026-10-26 | F02-T2 (não commitado, base `af5738e`) | R2–R7 (esqueletos) | 102,05–102,18 | 0,00 | 125 / 30 | Páginas `[PLACEHOLDER]` com `noindex`; fora do Lighthouse |
| 2026-10-26 | F02-T2 (não commitado, base `af5738e`) | R3 e R8 `/blog/x`, `/de/blog/x` | 102,20 | 0,00 | 120 / 25 | Acima dos 100 KB iniciais; limite revisto pelo owner |
| 2026-10-26 | F02-T2 (não commitado, base `af5738e`) | E404 | 103,38 | 0,92 | 125 / 30 | — |
| 2026-10-26 | F02-T3 (não commitado, base `1f3bcd5`) | R1 / R3 / R6 | 104,92 / 104,87 / 104,87 | 0,00 | 125 / 120 / 125 | `usePageSeo` + helpers de head (+~3 kB) |
| 2026-10-27 | F01-T2 (não commitado, base `25bb042`) | R1 / R3 / R6 | 105,54 / 105,49 / 105,49 | 3,23 | 125 / 120 / 125 | Tailwind 4 (preflight + utilitários usados + tokens `static`) e o toggle de tema (+0,6 kB de JS) |
