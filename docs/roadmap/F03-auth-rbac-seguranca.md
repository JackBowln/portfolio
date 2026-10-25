# F03 — Autenticação, RBAC e segurança base

**Objetivo da fase:** um admin acessível só pelo owner (passkey + GitHub restrito), RBAC aplicado no servidor em toda rota administrativa e a camada de segurança completa (CSP por hash, CSRF, rate limit, auditoria).

**Pré-requisitos:** F02 concluída e F01-T4 concluída (componentes do formulário de login).

**Leitura obrigatória:** [ADR-0005](../architecture/adr/0005-autenticacao-e-rbac.md), [ADR-0012](../architecture/adr/0012-seguranca.md), [security-model](../architecture/security-model.md), [test-strategy](../quality/test-strategy.md).

**Gate de saída:** a matriz de autorização (papel × permissão × rota) toda verde, o meta-teste de cobertura de permissões verde e o `/security-audit` do escopo da fase sem achados altos ou críticos.

---

### F03-T1 — Better Auth: instância por request, schema, handler e sessão

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F02-T1, F02-T4 | RF-02.1, RF-03.3, RNF-07 | `/security-audit`, `/architecture-guardian` |

**Objetivo.** Instalar `better-auth ~1.7` com o adapter Drizzle. Gerar o schema de auth (modelos no plural) e a migração, criar `createAuth(env)` e o handler `server/api/auth/[...all].ts`, e configurar cookies, expiração, `cookieCache`, `trustedOrigins` e `freshAge`.

**Arquivos prováveis.** `server/utils/auth.ts`, `server/api/auth/[...all].ts`, `server/db/schema/auth.ts`, `server/db/migrations/0001_*.sql`, `app/utils/auth-client.ts` (`better-auth/vue`).

**Fora do escopo.** Métodos de login (T2) e papéis (T3).

**Critérios de aceite**
- [ ] `emailAndPassword` desligado; nenhuma rota de cadastro utilizável (testado).
- [ ] Cookie de sessão com `__Secure-` (exceto em localhost), `HttpOnly`, `Secure`, `SameSite=Lax`; expiração de 7 dias renovada a cada 24 h; `cookieCache` de 5 min.
- [ ] Decisões registradas no data-model e no ADR-0005: rastreamento de IP do Better Auth (desligado ou só hash) e tratamento dos tokens OAuth (descartados ou criptografados).
- [ ] Nenhum segredo em `runtimeConfig.public`.

**Testes**
- API: tentativa de cadastro → erro; flags do cookie numa sessão criada em teste.
- Workers: tabelas de auth criadas pela migração.

---

### F03-T2 — Passkey + GitHub (allowlist) e bootstrap do owner

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F03-T1 | RF-03.1, RF-03.2 | `/security-audit`, `/test-engineer` |

**Objetivo.** Ativar `@better-auth/passkey` e o GitHub OAuth com a allowlist `OWNER_GITHUB_ID`, criar o fluxo `/admin/setup` (exige ausência de owner + `BOOTSTRAP_TOKEN`), a tela de login e a gestão de passkeys (listar, adicionar, remover com sessão fresca).

**Arquivos prováveis.** `server/utils/auth.ts` (plugins e hooks), `server/api/admin/setup.post.ts`, `app/pages/admin/login.vue`, `app/pages/admin/setup.vue`, `app/pages/admin/conta/passkeys.vue`, `tests/e2e/auth.spec.ts`.

**Fora do escopo.** UI de convites para outros usuários (backlog).

**Critérios de aceite**
- [ ] Registro e login por passkey funcionando (RP ID e origin por ambiente).
- [ ] Login GitHub de ID fora da allowlist → rejeitado sem criar usuário, com o evento auditado.
- [ ] `/admin/setup` responde só sem owner **e** com o token correto; depois retorna 404 (testado).
- [ ] Remover passkey exige sessão fresca; não é possível remover a última passkey sem um GitHub vinculado.
- [ ] Login, falha de login e passkey adicionada ou removida aparecem no `audit_log`.

**Testes**
- E2E (Chromium): autenticador WebAuthn virtual para registro + login + logout.
- API: GitHub OAuth mockado com ID permitido e com ID negado; bootstrap nos três estados (sem token, com token, depois do owner).

---

### F03-T3 — RBAC: permissões, papéis e `requirePermission`

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F03-T1 | RF-03.4, RNF-06 | `/security-audit`, `/test-engineer` |

**Objetivo.** Implementar:
- `shared/auth/permissions.ts` (statements e papéis exatamente como a matriz do [security-model](../architecture/security-model.md#4-matriz-de-autorização-padrão));
- o plugin `admin` do Better Auth com controle de acesso;
- o middleware de sessão em `/api/admin/**`;
- `defineAdminHandler({ permission, handler })`, que exporta o metadado da permissão, e `assertOwnership`.

**Arquivos prováveis.** `shared/auth/permissions.ts`, `server/utils/authz.ts`, `server/middleware/admin-session.ts`, `tests/unit/permissions.test.ts`, `tests/api/authz-matrix.spec.ts`, `tests/unit/admin-routes-meta.test.ts`.

**Fora do escopo.** UI de gestão de papéis.

**Critérios de aceite**
- [ ] Sem sessão → 401 em qualquer `/api/admin/**`; sem permissão → 403; com permissão → 2xx.
- [ ] A matriz de testes é **gerada** a partir de `permissions.ts` (sem casos escritos à mão para cada célula).
- [ ] O meta-teste falha se algum arquivo em `server/api/admin/**` não usar `defineAdminHandler` com permissão.
- [ ] `author` não altera conteúdo de outro autor (`assertOwnership`).

**Testes**
- Unit: resolução de permissões por papel.
- API: matriz completa com rotas de exemplo (até haver rotas reais).
- Unit: o meta-teste.

---

### F03-T4 — Hardening: CSP por hash, CSRF, rate limit e auditoria

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F03-T3, F01-T2 | RNF-07, RNF-12 | `/security-audit` |

**Objetivo.** Implementar:
- a CSP por hash, calculada no hook de renderização a partir dos scripts inline do HTML final;
- os headers completos do ADR-0012 por tipo de rota;
- o middleware de origem e `Content-Type` nas mutações;
- os limites de body;
- os bindings `RL_AUTH` e `RL_ADMIN`;
- o utilitário de auditoria com hash de IP.

**Arquivos prováveis.** `server/plugins/csp.ts`, `server/plugins/security-headers.ts`, `server/middleware/origin-check.ts`, `server/middleware/rate-limit.ts`, `server/utils/audit.ts`, `server/utils/ip-hash.ts`.

**Fora do escopo.** `RL_PUBLIC` e Turnstile (F08-T3); `frame-src` dos embeds (F05-T5).

**Critérios de aceite**
- [ ] `script-src` sem `unsafe-inline` e sem `unsafe-eval`; os hashes batem com os scripts inline (tema, `motion-ok` quando existir, config do Nuxt).
- [ ] **Nenhuma violação de CSP** no console nas páginas públicas e no admin.
- [ ] POST/PUT/PATCH/DELETE com `Origin` de outro site → 403; `Content-Type` inválido → 415; body acima do limite → 413.
- [ ] Rate limit retorna 429 com `Retry-After`; o login fica limitado por IP + rota.
- [ ] O IP nunca é gravado em claro; o `audit_log` registra ator, ação, entidade e hash de IP.

**Testes**
- Unit: extração de scripts inline e cálculo dos hashes.
- API: headers por tipo de rota, CSRF, 413, 415 e 429.
- E2E: listener de `securitypolicyviolation` sem eventos nas rotas principais.

---

### F03-T5 — Shell do admin: SPA, login, dashboard, sessões e auditoria

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F03-T2, F03-T3 | RF-02.1, RF-02.2, RF-02.3, RF-02.4, RF-03.5 | `/frontend-design`, `/security-audit` |

**Objetivo.** Configurar `routeRules['/admin/**'] = { ssr: false }`, o layout do admin, o middleware de rota (só UX), o dashboard (contadores como placeholder), a lista e revogação de sessões e a visualização do `audit_log` (filtros por período, ator e ação).

**Arquivos prováveis.** `app/layouts/admin.vue`, `app/middleware/admin-auth.ts`, `app/pages/admin/index.vue`, `app/pages/admin/conta/sessoes.vue`, `app/pages/admin/auditoria.vue`, `server/api/admin/audit.get.ts`, `server/api/admin/sessions/*.ts`.

**Fora do escopo.** Telas de conteúdo (F06+).

**Critérios de aceite**
- [ ] `/admin/**` responde com `private, no-store` e `X-Robots-Tag: noindex, nofollow`, e o HTML não contém dados.
- [ ] **Nenhum chunk do admin** é referenciado pelas páginas públicas (checagem do manifest no `check:budgets`, ou teste próprio).
- [ ] Revogar uma sessão encerra o acesso dela na requisição seguinte (o `cookieCache` respeita a revogação dentro de 5 min, ou a revogação força a invalidação; o comportamento fica documentado).
- [ ] axe no admin sem violações sérias ou críticas; navegação por teclado.

**Testes**
- E2E: login → dashboard → revogar outra sessão → a sessão revogada perde o acesso.
- API: `audit.get` exige `audit:read`.
- Checagem do manifest: separação entre os bundles público e admin.

---

## Prompt da fase

```text
Fase F03 — Autenticação, RBAC e segurança base. Projeto: ~/Desktop/dev/portfolio.

Leia CLAUDE.md, docs/roadmap/F03-auth-rbac-seguranca.md, docs/architecture/security-model.md e os ADRs 0005 e 0012. Pegue a primeira tarefa "pendente" com dependências concluídas.

Antes de editar: apresente objetivo, arquivos, abordagem, dependências novas (checklist do /architecture-guardian), testes e riscos. Aguarde minha aprovação.

Regras desta fase:
- Sem senha e sem cadastro público. GitHub só para IDs da allowlist.
- Toda rota em server/api/admin/** usa defineAdminHandler com permissão; a segurança nunca depende da interface.
- Segredos só em .dev.vars (local) ou wrangler secret (remoto, com meu pedido). Não leia .dev.vars nem .env*.
- Rode /security-audit no escopo de cada tarefa e só conclua sem achados altos ou críticos abertos.

Depois de implementar: rode typecheck, lint, test (unit, workers), test:api e o e2e de auth; cole a saída real; atualize o status e os ADRs 0005 e 0012 se houver decisão; entregue o relatório da Definition of Done. Não faça commit sem eu pedir.
```
