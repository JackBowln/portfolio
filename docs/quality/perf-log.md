# Registro de performance

Protocolo em [performance-budgets](performance-budgets.md) §2 e comandos em `.claude/skills/performance-audit/references/measurement-protocol.md`. Cada linha é a **mediana de 3 execuções**, entre parênteses a variação quando não for zero, sempre com o relatório gerado na mesma sessão (`reports/lighthouse/<data>/`, fora do git).

## Lighthouse

| Data | Commit | Ferramenta / LH | Chrome | Ambiente | Rota | Disp. | Perf | A11y | BP | SEO | LCP | TBT | CLS | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-26 | `490e1eb` | `pnpm lighthouse` / 13.5.0 | Chrome for Testing 156.0.8078.4 | local, `wrangler dev` (build de produção) | R1 `/` | mobile | 100 | 100 | 100 | 90 | 1512 ms | 0 ms | 0 | Baseline do esqueleto. SEO 90: `meta-description` ausente no placeholder, a resolver com o SEO por página na F02. Elemento LCP: `<h1>`. FCP 1212 ms, SI 1212 ms |
| 2026-10-26 | `490e1eb` | `pnpm lighthouse` / 13.5.0 | Chrome for Testing 156.0.8078.4 | local, `wrangler dev` (build de produção) | R1 `/` | desktop | 100 | 100 | 100 | 90 | 412 ms | 0 ms | 0 | Idem. FCP 332 ms, SI 332 ms |

O TTFB local não representa a borda; o número real vem do deploy de preview (F00-T6).

## Orçamentos (`pnpm check:budgets`)

| Data | Commit | Rota | JS inicial (kB gzip) | CSS (kB gzip) | Limites | Notas |
|---|---|---|---|---|---|---|
| 2026-10-26 | `490e1eb` | R1 `/` | 68,56 | 0,00 | 110 / 30 | Entrada + `pages/index.vue` |
| 2026-10-26 | `490e1eb` | E404 (página de erro do Nuxt) | 70,07 | 0,92 | 110 / 30 | Não auditável pelo Lighthouse, que só mede documentos 2xx |
