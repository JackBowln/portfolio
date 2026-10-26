# ADR-0015 — Vitest 5 com `@cloudflare/vitest-plugin`

- **Status:** Aceito (2026-10-26). Substitui o §1 do [ADR-0013](0013-testes-e-qualidade.md) na versão do Vitest e no pacote do projeto `workers`, e também a alternativa "Vitest 5" rejeitada nele.
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0013, ADR-0002, [test-strategy](../../quality/test-strategy.md), F00-T4

## Contexto

- O ADR-0013 fixou o Vitest em `~4.1` porque o `@cloudflare/vitest-pool-workers` 0.23 exigia `vitest ^4.1`.
- Ao instalar o pool na F00-T4, o npm o marcou como **depreciado**: o pacote foi renomeado para `@cloudflare/vitest-plugin` e não vai mais receber atualizações.
- O 0.23 também fixava uma cópia própria do wrangler 4.124, com um workerd de 15/08/2026. Esse workerd é anterior à `compatibility_date` do projeto (2026-10-19).
- O `@cloudflare/vitest-plugin` 1.4.7 (MIT, 22/10/2026) aceita `vitest ^4.1 || ^5`. Ele usa o **mesmo wrangler 4.152.0** do projeto, com miniflare e workerd de 19/10/2026.
- O Vitest 5.0.5 (15/10/2026) aceita Node `^24`, Vite `^8` e `@types/node >=24`. O `@nuxt/test-utils` 4.3.4 aceita `vitest ^5`, e a linha 5 já teve cinco correções desde 03/09/2026.

## Decisão

1. **Vitest `~5.0`**, mantendo um único `vitest.config.ts` com os `projects` `unit`, `nuxt` e `workers`.
2. **Projeto `workers` com `@cloudflare/vitest-plugin ~1.4`**, via `cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' }, remoteBindings: false })`.
   - `remoteBindings: false` garante que os testes nunca se conectam à conta Cloudflare (ADR-0013 §9).
   - O `wrangler.jsonc` local não declara `AI`, que não tem emulação local. Código que use IA recebe um provider falso nos testes e no desenvolvimento.
3. O restante do ADR-0013 continua valendo: Playwright, axe, Lighthouse, cobertura e regras de relato.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Manter o pool depreciado com Vitest 4.1 | Sem atualizações, com um workerd dois meses mais velho que o de produção e uma segunda cópia do wrangler |
| `@cloudflare/vitest-plugin` com Vitest 4.1 | Viável, mas mantém o projeto numa linha que deixa de ser a atual sem nenhum bloqueio técnico; o owner escolheu o 5 |

## Consequências

### Positivas
- Uma única versão do Vitest e do wrangler na árvore; os testes de workers rodam no mesmo runtime do build.
- Acesso a recursos e correções da linha 5.

### Negativas e custos
- O Vitest 5 é uma major recente: integrações de terceiros podem demorar a acompanhar.

### Riscos e mitigação
- **Regressão em plugin de teste:** as versões ficam fixadas com `~`, e a revisão trimestral (ADR-0002) confere os peers.

## Validação

| Verificação | Resultado | Data |
|---|---|---|
| F00-T4: `pnpm test` (unit, nuxt, workers) | 3 arquivos e 3 testes passando com Vitest 5.0.5; o teste de workers lê e grava no D1 do miniflare sem nenhuma conexão remota | 2026-10-26 |

## Referências

- [Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- Aviso de depreciação no npm: `@cloudflare/vitest-pool-workers@0.23.0`
