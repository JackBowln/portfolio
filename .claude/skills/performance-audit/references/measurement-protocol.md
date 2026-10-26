# Protocolo de medição — comandos

> Ferramenta decidida no F00-T7 (ADR-0013): o script `scripts/lighthouse.ts`, com `lighthouse@13` e `chrome-launcher`, usando o Chrome for Testing do Playwright (ou `CHROME_PATH`). As rotas, os orçamentos e as notas mínimas ficam em `performance-budgets.json`.

## Preparação

```bash
pnpm build                 # build de produção (preset cloudflare_module)
pnpm preview:prod          # wrangler dev servindo .output em http://localhost:8788 com ENVIRONMENT=production
```

O `pnpm lighthouse` mede por padrão a porta 8788. Fora de produção, toda resposta leva `X-Robots-Tag: noindex, nofollow` (ADR-0008 §6), e o Lighthouse reprovaria o SEO (`is-crawlable`) no `pnpm preview` comum (8787). A instância "como produção" usa um nome e um estado local próprios (`portfolio-prodlike`, `.wrangler/state-prod`), sem nenhum recurso remoto.

Para medir o TTFB real da borda, use a URL de preview (o deploy exige autorização do owner).

## Execução

```bash
pnpm check:budgets                         # JS gzip por rota vs performance-budgets.json
pnpm lighthouse --routes R1 --runs 3 --assert   # mobile + desktop; mediana por categoria; --assert aplica a política §3
pnpm lighthouse --base https://<preview>             # mede outro host (por exemplo, o deploy de preview)
```

Saída esperada do `pnpm lighthouse`:
- relatórios HTML/JSON em `reports/lighthouse/<data>/<rota>-<dispositivo>-<n>.(html|json)`;
- tabela de medianas no stdout (copie para o relatório e para o `perf-log.md`).

## Condições

- Lighthouse 13.x fixado; Chrome stable com a versão registrada.
- Presets padrão do Lighthouse para mobile (throttling simulado) e desktop.
- Perfil limpo, sem extensões; primeira carga sem cache do navegador.
- Workers Cache aquecido com 1 request antes, salvo se o objetivo for medir o miss.
- 3 execuções por rota e dispositivo; reporte a **mediana** e o desvio, se for grande.

## Registro (`docs/quality/perf-log.md`)

| Data | Commit | Ferramenta/LH | Chrome | Ambiente | Rota | Disp. | Perf | A11y | BP | SEO | LCP | TBT | CLS | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

## Campo (após o lançamento)

Os Core Web Vitals no p75 por rota (Cloudflare Web Analytics, se aprovado na Q-08) são revisados mensalmente. Uma regressão vira tarefa.
