# F00 — Fundação técnica e spikes de viabilidade

**Objetivo da fase:** um esqueleto executável com toolchain, lint, testes, bindings da Cloudflare e CI, e a validação das duas hipóteses que podem mudar a arquitetura: a CPU do SSR com o Workers Cache no plano Free e a ferramenta de Lighthouse 13.

**Pré-requisitos:** a preparação (docs, skills, CLAUDE.md) concluída. Para a F00-T5, o repositório no GitHub (Q-07). Para a F00-T6, a conta Cloudflare e **sua autorização** para criar recursos de preview e fazer deploy de preview.

**Leitura obrigatória:** [ADR-0002](../architecture/adr/0002-plataforma-e-toolchain.md), [ADR-0003](../architecture/adr/0003-renderizacao-cache-e-cpu.md), [ADR-0013](../architecture/adr/0013-testes-e-qualidade.md), [compatibilidade](../research/2026-10-25-compatibilidade.md), [test-strategy](../quality/test-strategy.md), [performance-budgets](../quality/performance-budgets.md).

**Gate de saída:** a seção "Validação" do ADR-0003 e do ADR-0013 preenchida com números e data, e a sua decisão registrada: seguir no Free ou adotar a alternativa.

---

### F00-T1 — Scaffold do Nuxt 4.6 com TypeScript 6 strict

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | — | RNF-09 | `/architecture-guardian` |

**Objetivo.** Criar o projeto Nuxt `~4.6` com pnpm, Node 24 e TypeScript `~6.0` em modo strict, na estrutura de pastas do [overview](../architecture/overview.md#3-estrutura-do-repositório-criada-na-f00).

**Arquivos prováveis.** `package.json` (`packageManager`, `engines`, scripts `dev`/`build`/`preview`/`typecheck`), `pnpm-lock.yaml`, `.nvmrc`, `.npmrc`, `nuxt.config.ts` (`compatibilityDate`, `typescript.strict`), `tsconfig.json`, `app/app.vue`, `app/pages/index.vue` (placeholder), `server/api/health.get.ts`, `server/services/health/health.service.ts`.

**Fora do escopo.** Tailwind, i18n, Cloudflare, frameworks de teste.

**Critérios de aceite**
- [x] Antes de instalar, `npm view` confirma as versões da pesquisa (registrar qualquer mudança no doc de compatibilidade).
- [x] `pnpm install` gera o lockfile; `pnpm why typescript` mostra 6.0.x; `nuxt` 4.6.x; nenhum `h3`/`nitropack` instalado diretamente.
- [x] `tsconfig` com `strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes` (ou justificativa registrada se algum quebrar tipos do Nuxt).
- [x] `pnpm dev` serve a página placeholder; `GET /api/health` → `{ "status": "ok", "version": "<package version>" }`.
- [x] `pnpm build` conclui sem warnings de tipos.

**Testes**
- `pnpm typecheck` e `pnpm build` verdes (saída colada).
- `curl` no `/api/health` com o resultado colado. Os testes automatizados entram na F00-T4.

---

### F00-T2 — ESLint 10, formatação e regras de fronteira

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F00-T1 | RNF-09 | `/architecture-guardian` |

**Objetivo.** Lint e formatação unificados com `@nuxt/eslint` (flat config + `stylistic`), mais as regras de fronteira da [boundaries](../../.claude/skills/architecture-guardian/references/boundaries.md).

**Arquivos prováveis.** `eslint.config.mjs`, `package.json` (scripts `lint`, `lint:fix`), `.editorconfig`, `.vscode/settings.json` (opcional).

**Fora do escopo.** Regras de i18n (F02-T2).

**Critérios de aceite**
- [x] `pnpm lint` passa no esqueleto; `pnpm lint:fix` formata.
- [x] `no-restricted-imports` (ou equivalente) bloqueia:
  - `app/**` → `server/**`;
  - `server/**` → `app/**`;
  - `shared/**` → Vue, h3 ou bindings;
  - componentes, páginas e composables públicos → `**/admin/**` e `@tiptap/*`;
  - imports estáticos de `gsap`/`three` fora de `app/composables/motion/**`.
- [x] Cada regra é demonstrada com um fixture temporário que falha (saída colada) e é removido em seguida.

**Testes**
- Execução de `pnpm lint` com e sem os fixtures de violação (saídas coladas).

---

### F00-T3 — Cloudflare: preset, wrangler, bindings locais e tipos

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F00-T1 | RNF-08, RNF-09 | `/architecture-guardian` |

**Objetivo.** Configurar o preset `cloudflare_module` (`deployConfig`, `nodeCompat`), um `wrangler.jsonc` com os ambientes `preview` e `production` e os bindings de [environments](../operations/environments.md), a emulação local no `nuxt dev` e os tipos gerados.

**Arquivos prováveis.** `wrangler.jsonc`, `nuxt.config.ts` (nitro preset/cloudflare), `.dev.vars.example`, `worker-configuration.d.ts` (via `wrangler types`), `server/utils/env.ts` (acesso tipado a `event.context.cloudflare.env`), `package.json` (scripts `cf:types`, `preview`).

**Fora do escopo.** Criar recursos remotos (isso é na F00-T6, com autorização); schema do banco (F02-T1).

**Critérios de aceite**
- [x] `wrangler` é devDependency (`^4.152`) e `compatibility_date` fica fixada e registrada no ADR-0002.
- [x] Bindings `DB`, `MEDIA`, `AI`, `RL_AUTH`, `RL_PUBLIC` e `RL_ADMIN` declarados. Os IDs remotos ficam como placeholders comentados até a F00-T6. `cache` e `observability` são configurados por ambiente.
- [x] No `nuxt dev`, uma rota de diagnóstico **só de dev** lê e grava no D1 local e no R2 local. A rota é removida ou bloqueada no build de produção.
- [x] `pnpm build && pnpm preview` (`wrangler dev`) serve a página e o `/api/health`.
- [x] `.dev.vars.example` só com os nomes das variáveis; `.dev.vars` no `.gitignore`.

**Testes**
- Saídas coladas de `pnpm cf:types`, `pnpm typecheck` e de uma chamada à rota de diagnóstico em dev.
- `pnpm preview` com `curl` do health.

---

### F00-T4 — Harness de testes: Vitest 4.1 (unit, nuxt, workers), Playwright e axe

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F00-T3 | RNF-09, RNF-10 | `/test-engineer` |

**Objetivo.** Montar as camadas de teste da [estratégia](../quality/test-strategy.md), com um teste real por camada.

**Arquivos prováveis.** `vitest.config.ts` (projects `unit`, `nuxt`, `workers`), `tests/unit/health.service.test.ts`, `tests/nuxt/app.test.ts`, `tests/workers/d1-smoke.test.ts`, `playwright.config.ts` (projects `api`, `e2e`, `a11y`; webServer = build + `wrangler dev`), `tests/api/health.spec.ts`, `tests/e2e/home.spec.ts`, `tests/a11y/home.spec.ts`, `package.json` (scripts da estratégia).

**Fora do escopo.** Testes de funcionalidades ainda inexistentes; CI (F00-T5).

**Critérios de aceite**
- [x] `vitest` fixado em `~4.1`, compatível com `@cloudflare/vitest-pool-workers ~0.23` e `@nuxt/test-utils ~4.3` (peer deps conferidos). **Substituído pelo ADR-0015:** o pool foi depreciado, e o projeto usa `vitest ~5.0` com `@cloudflare/vitest-plugin ~1.4`, com os peers conferidos.
- [x] O projeto `workers` lê o `wrangler.jsonc`; o teste cria uma tabela temporária e lê e grava no D1 do miniflare.
- [x] Os projetos Playwright sobem o build de produção em `wrangler dev`; o teste a11y roda axe na home com tags WCAG 2.2 AA.
- [x] `pnpm test`, `pnpm test:api`, `pnpm test:e2e` e `pnpm test:a11y` funcionam localmente.

**Testes**
- Saída colada de cada comando acima, com a contagem de testes.

---

### F00-T5 — CI no GitHub Actions e Dependabot

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F00-T2, F00-T4 | RNF-09, RNF-13 | `/test-engineer` |

**Objetivo.** Rodar os checks do ADR-0013 em todo PR e na `main`, sem nenhum deploy.

**Arquivos prováveis.** `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.github/pull_request_template.md` (com o relatório da DoD).

**Fora do escopo.** Workflows de deploy (F12-T4/T5) e de Lighthouse (F00-T7/F11-T5).

**Critérios de aceite**
- [x] O job roda com Node 24 e pnpm em cache e executa `install --frozen-lockfile` → `typecheck` → `lint` → `test` → `build` → Playwright `api` + smoke `e2e` + `a11y` → `pnpm audit --audit-level high`.
- [x] Os relatórios do Playwright saem como artefatos; o tempo total fica registrado (Q-07: minutos de CI).
- [x] Um PR de teste com erro de lint proposital falha; corrigido, passa (links ou logs no relatório).
- [x] Dependabot semanal para npm e github-actions, sem auto-merge.

**Testes**
- Execução real do workflow num PR (você cria o repositório e autoriza o push).

---

### F00-T6 — Spike: CPU do SSR e Workers Cache no plano Free

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F00-T3 | RNF-01, RNF-05, RNF-08 | `/performance-audit` |

**Objetivo.** Medir no Workers Free:
- a CPU do SSR em cache-miss numa página representativa;
- se o Workers Cache está disponível no plano;
- se ele faz os assets contarem no limite;
- o tempo de purge por tag.

Os números vão para o ADR-0003.

**Arquivos prováveis.** Uma branch descartável `spike/F00-T6`: página representativa (artigo `[PLACEHOLDER]` com ~2.000 palavras, 6 blocos de código já com HAST, 5 imagens, cabeçalho e rodapé) e `scripts/spikes/ssr-load.mjs` (requisições sequenciais com cache-miss forçado). Só a documentação e os ajustes de configuração voltam para a `main`.

**Fora do escopo.** Implementar o renderer real (F05-T4).

**Critérios de aceite**
- [ ] **Sua autorização explícita** antes de: criar `portfolio-preview` (D1/R2), configurar segredos e fazer deploy de preview.
- [ ] CPU p50/p95/p99 em miss para home e artigo (≥ 200 requisições cada), tirada do Workers Observability, com prints ou export no relatório.
- [ ] Workers Cache: `Cf-Cache-Status` observado (HIT/MISS), com `cache.enabled` funcionando ou não no Free; efeito na contagem de requisições de assets verificado no painel.
- [ ] Purge por tag via `ctx.cache.purge`: tempo até o reflexo medido.
- [ ] Tabela do ADR-0003 preenchida, com a recomendação e o fallback aplicável. **Você decide** antes de prosseguir: Free confirmado ou alternativa.

**Testes**
- O script de carga é reproduzível, com comandos e parâmetros documentados no ADR.
- Sem testes automatizados permanentes (é um spike).

---

### F00-T7 — Spike: Lighthouse 13, orçamento de JS e registro de performance

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F00-T4 | RNF-01, RNF-03 | `/performance-audit` |

**Objetivo.** Escolher entre Unlighthouse CI e um script com `lighthouse@13` + `chrome-launcher`, criar `pnpm lighthouse` e `pnpm check:budgets`, e registrar a baseline do esqueleto.

**Arquivos prováveis.** `scripts/lighthouse.mjs` ou configuração do Unlighthouse, `scripts/check-budgets.mjs`, `performance-budgets.json`, `docs/quality/perf-log.md`, `package.json`.

**Fora do escopo.** Job de Lighthouse no CI com asserções (F11-T5).

**Critérios de aceite**
- [ ] As duas opções foram testadas em 2 rotas × mobile/desktop × 3 execuções; variação, tempo e facilidade de asserção comparados numa tabela no ADR-0013; decisão registrada.
- [ ] `pnpm lighthouse` gera os relatórios (HTML/JSON) em `reports/lighthouse/` e imprime a mediana por categoria.
- [ ] `pnpm check:budgets` lê o manifest do build, calcula o JS gzip por rota e falha acima do `performance-budgets.json`; a falha é demonstrada com um limite artificialmente baixo.
- [ ] `perf-log.md` criado, com a baseline do esqueleto (versões do Chrome e do Lighthouse, commit, data).

**Testes**
- Teste unitário do cálculo do `check:budgets` (com manifest de fixture).
- Saídas coladas dos dois comandos.

---

## Prompt da fase

```text
Fase F00 — Fundação técnica e spikes. Projeto: ~/Desktop/dev/portfolio.

Leia CLAUDE.md, docs/roadmap/F00-fundacao.md, docs/research/2026-10-25-compatibilidade.md e os ADRs 0002, 0003 e 0013.
Pegue a primeira tarefa "pendente" desta fase cujas dependências estejam concluídas.

Antes de editar: rode `npm view` nas dependências que a tarefa vai instalar e compare com a pesquisa; apresente objetivo, arquivos, abordagem, dependências (com o checklist do /architecture-guardian), testes e riscos. Aguarde minha aprovação.

Regras desta fase:
- TypeScript ~6.0 (não 7), Vitest ~4.1 (não 5), sem h3/nitropack/NuxtHub instalados diretamente.
- Nenhum recurso remoto da Cloudflare, segredo, deploy ou push sem minha autorização explícita (F00-T5 e F00-T6 dependem disso: pergunte antes).
- Nos spikes (T6, T7), trabalhe em branch spike/…; só a documentação e os ajustes de configuração voltam para a main.

Depois de implementar: rode typecheck, lint e os testes relevantes e cole a saída real; atualize o status da tarefa e os ADRs; entregue o relatório da Definition of Done. Não faça commit sem eu pedir.
```
