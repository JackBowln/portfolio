# Protocolo de medição — comandos

> A ferramenta final (Unlighthouse CI ou script com `lighthouse@13`) é decidida no F00-T7 e registrada no ADR-0013. Os comandos abaixo são o contrato dos scripts do `package.json`.

## Preparação

```bash
pnpm build                 # build de produção (preset cloudflare_module)
pnpm preview               # wrangler dev servindo .output (porta registrada no script)
```

Para medir o TTFB real da borda, use a URL de preview (o deploy exige autorização do owner).

## Execução

```bash
pnpm check:budgets                         # JS gzip por rota vs performance-budgets.json
pnpm lighthouse --routes=R1,R3 --runs=3    # mobile + desktop; mediana por categoria
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
