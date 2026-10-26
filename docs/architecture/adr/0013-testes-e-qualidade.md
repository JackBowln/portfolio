# ADR-0013 — Testes e qualidade: Vitest 4.1, Playwright, axe e Lighthouse 13

- **Status:** Aceito (2026-10-25), com gate F00-T7 para a ferramenta de Lighthouse. O §1, na versão do Vitest e no pacote do projeto `workers`, foi substituído pelo [ADR-0015](0015-vitest-5-e-vitest-plugin.md) (Vitest `~5.0` com `@cloudflare/vitest-plugin`)
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0002, [test-strategy](../../quality/test-strategy.md), [performance-budgets](../../quality/performance-budgets.md), RNF-01, RNF-09, RNF-10

## Contexto

- A stack pedida inclui Vitest, Playwright, axe-core e Lighthouse CI.
- No npm, em 25/10/2026:
  - `vitest@latest` é a 5.0.5, mas o `@cloudflare/vitest-pool-workers` 0.23 exige `vitest ^4.1`;
  - `@nuxt/test-utils` 4.3 aceita a 4 e a 5;
  - `@lhci/cli` 0.15.1 (jun/2025) embute o Lighthouse 12.6.1, enquanto o Chrome atual usa o Lighthouse 13.5;
  - Unlighthouse 0.19 usa o Lighthouse 13.5.
- O workflow proíbe declarar testes aprovados sem executá-los.

## Decisão

1. **Vitest `~4.1`**, com um único `vitest.config.ts` de `projects`:
   - `unit` (ambiente node): `shared/**` e lógica pura de `server/services/**`.
   - `nuxt` (`@nuxt/test-utils`, ambiente `nuxt` com happy-dom): componentes e composables.
   - `workers` (`@cloudflare/vitest-pool-workers`): serviços e repositórios com D1 e R2 reais em miniflare e migrações aplicadas no setup.
2. **Playwright `~1.64`**, contra o build de produção rodando em `wrangler dev`:
   - `api`: integração HTTP, incluindo a matriz de autorização, CSRF, rate limit, uploads e cache headers.
   - `e2e`: jornadas J-01…J-08. Chromium no desktop e WebKit no mobile emulado; passkey via autenticador WebAuthn virtual (CDP, só Chromium).
   - `a11y`: `@axe-core/playwright` em todos os templates × (pt-BR, de) × (claro, escuro) × movimento reduzido. Gate: **0 violações sérias ou críticas**.
   - `visual` (_should_): `toHaveScreenshot` em 360, 768 e 1280 px com movimento reduzido, rodando só no CI Linux, com baselines versionados.
3. **Lighthouse 13** (não o LHCI 0.15).
   - A ferramenta sai do spike F00-T7: **Unlighthouse CI** ou um script mínimo com `lighthouse@13` + `chrome-launcher`.
   - Critérios: mediana de 3 execuções por rota e dispositivo; relatório HTML como artefato; asserção por categoria; tempo total de CI aceitável.
   - Protocolo e tolerância em [performance-budgets](../../quality/performance-budgets.md).
4. **Orçamentos.** `pnpm check:budgets` (script na F00-T7) mede o JS gzip por rota a partir do manifest do build e falha acima do limite.
5. **Meta-testes de segurança.** Um teste lista todas as rotas de `server/api/admin/**` e falha se alguma não declarar permissão (via metadado exportado pelo handler).
6. **Cobertura.**
   - **≥ 90% de branches** nos módulos críticos: permissões, máquina de estados de publicação, segmentador, guarda de custo, validação de upload, schema do documento e CSP.
   - **≥ 70% de linhas** em `server/` e `shared/` no geral.
   - A interface é coberta por E2E e a11y.
7. **CI por PR:**
   - typecheck → lint → `vitest` (os três projetos) → build → `check:budgets` → Playwright `api` + smoke `e2e` → a11y nos templates afetados.
   - Lighthouse em PRs com rótulo `ui` e na `main`.
   - A suíte completa (e2e + a11y + visual + Lighthouse) roda diariamente e antes de release.
8. **Regra de relato.** Toda tarefa cola os comandos executados e o resumo da saída real. Um teste pulado ou instável é declarado, nunca omitido.
9. **Determinismo.** Relógio falso para datas e agendamentos; nenhum provedor real (IA, GitHub, Turnstile) é chamado em testes, só mocks e fakes; seeds fixas.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Vitest 5 | Incompatível com `@cloudflare/vitest-pool-workers` 0.23 |
| `@lhci/cli` 0.15 | Lighthouse 12.6 embutido diverge da medição do Chrome atual; sem release desde jun/2025 |
| Testar handlers só em Node (`@nuxt/test-utils` e2e) | Não reproduz o workerd nem os bindings; fica para os testes de componente |
| Cypress | Sem WebAuthn virtual tão simples; Playwright cobre API, e2e e a11y |

## Consequências

### Positivas
- Bindings reais nos testes; medição de Lighthouse alinhada ao Chrome atual.

### Negativas e custos
- Ficar na Vitest 4.1 adia recursos da v5.
- A suíte completa consome minutos de CI (Q-07 no PRD).

### Riscos e mitigação
- **Flakiness de Lighthouse e visual:** mediana de 3 execuções, CPU throttling fixo e baselines só no CI Linux.

## Validação

- F00-T4: um teste de cada projeto (unit, nuxt, workers) roda verde.
- F00-T7: decisão da ferramenta de Lighthouse registrada nesta seção.
- **F00-T4 (2026-10-26):** `pnpm test` com 3 de 3 (unit, nuxt, workers; ver ADR-0015), `test:api` com 2 de 2, `test:e2e` com 4 de 4 (Chromium desktop e WebKit mobile) e `test:a11y` com 10 de 10 (home em claro e escuro; styleguide nas 8 combinações), sem violações sérias ou críticas. Um teste negativo comprovou que o helper do axe reprova `image-alt` e `color-contrast`.

| Spike F00-T7 | Ferramenta | Variação entre execuções | Tempo de CI | Decisão | Data |
|---|---|---|---|---|---|
| _pendente_ | | | | | |

## Referências

- [Compatibilidade](../../research/2026-10-25-compatibilidade.md) (peer dependencies verificadas)
- Playwright: WebAuthn virtual authenticator via CDP
- axe-core rules (WCAG 2.2 AA tags)
