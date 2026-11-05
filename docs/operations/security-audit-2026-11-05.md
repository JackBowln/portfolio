# Auditoria de segurança — escopo completo — 05/11/2026 (F12-T3)

**Base:** `main` após a F12-T2.
- **Referências:** [security-model](../architecture/security-model.md) §2 e §5, ADR-0005, ADR-0012 e a checklist da skill `/security-audit`.
- **Ambientes verificados:** o build de teste (`pnpm preview:test`) e o prod-like (`pnpm preview:prod`, `ENVIRONMENT=production`).
- **Fora do escopo:** testes de intrusão na infraestrutura da Cloudflare.

**Resumo:** críticos 0, altos 0, médios 2 (1 corrigido, 1 aceito pelo owner), baixos 0. A suíte de segurança está verde (§4).

| # | Severidade | Superfície | Achado | Evidência | Estado |
|---|---|---|---|---|---|
| 1 | Média | Auth (passkey) | A passkey aceitava cerimônias sem verificação do usuário (uma chave só de presença, sem PIN nem biometria). O plugin pede `preferred` ao navegador e verifica com `requireUserVerification: false` no registro e no login | `@better-auth/passkey` 1.7.13, `dist/index.mjs` (verificações de registro e de login); `server/services/auth/options.ts` (`passkeyOptions`) | **Corrigido.** O registro pede `userVerification: 'required'`, e os ganchos `registration`/`authentication.afterVerification` recusam no servidor qualquer resposta sem a flag UV (`requireUserVerified`). Testes: `tests/unit/auth-options.test.ts`; `tests/auth-flow/auth-flow.spec.ts`: a mesma credencial assina duas cerimônias; com `userVerification: 'discouraged'` a resposta assinada vem sem a flag UV e o servidor responde 401 `USER_VERIFICATION_REQUIRED`, com `auth.login_failed`; com `required`, entra. **Sem a correção, o teste falha: o login sem UV passava (200)** |
| 2 | Média | Dependências (`nuxt` < 4.6.3) | GHSA "Dot segments in the request path bypass `server/middleware`". Os middlewares de origem, rate limit e redirects decidem pelo caminho | Sondado no build de teste com `curl --path-as-is` em 8 formas (`/api/public/../admin/…`, `%2e%2e`, `..%2f`, `/./`, `//`): todas responderam 403 do middleware de origem. A autorização não depende de middleware: cada rota do admin confere sessão e permissão no próprio handler (`defineAdminHandler`) | **Aceito pelo owner (05/11/2026).** O 4.6.3 corrige, mas acrescenta ~0,3 kB de JS em toda rota e leva o R7 a 128,03/128. Rever na próxima atualização do Nuxt que caiba no orçamento, ou quando o owner aceitar subir o R7 |

Também corrigido, fora da tabela de achados: o `node-forge` (≤ 1.4.0, 5 avisos altos, só no servidor de desenvolvimento via `nitropack` → `listhen`) passou a ser forçado para 1.4.2 com `pnpm.overrides`. A exceção `ignoreGhsas` da F00-T5 saiu, como ela mesma previa. Com isso, o `pnpm audit --audit-level high` ficou limpo pela primeira vez.

## 1. Varreduras

| Verificação | Comando | Resultado |
|---|---|---|
| Segredos no histórico | `gitleaks git --redact --log-opts="--all"` (8.30.1) | 301 commits, 5,36 MB, **nenhum vazamento** (os 2 restantes de 303 não têm conteúdo próprio) |
| Arquivos de segredo versionados | `git log --all --name-only` | só `.dev.vars.example`; `.dev.vars` e `.env*` estão no `.gitignore` e nunca foram versionados (o conteúdo deles não foi lido) |
| `v-html` | `grep -rn v-html app` | 0 usos (3 menções em comentários) |
| SQL cru | `grep sql.raw server` | 0; as 73 interpolações `sql\`` do Drizzle viram parâmetros |
| `runtimeConfig.public` | `nuxt.config.ts` | só `siteUrl`, `mediaBaseUrl`, `turnstileSiteKey` |
| `defineEventHandler` em `server/api/admin` | grep | 0 (meta-teste `admin-routes-meta` verde) |
| Log de segredo | grep `logger`/`console` com token/secret/cookie | 0 valores; só avisos com o nome do segredo que falta |
| SSRF | `fetch`/`Request` no servidor | só endereços fixos: siteverify do Turnstile e OAuth do GitHub (Better Auth); Workers AI por binding |
| `innerHTML` | grep | só o JSON-LD (`useJsonLd`), serializado com escape de `< > &` e U+2028/9 (F11-T1) |
| Login de teste fora da produção | `pnpm check:prod-build` (novo) | build de produção: 713 arquivos, **nenhum código de teste**; no build de teste o script falha, como deve. O passo entrou no job de Lighthouse do CI |
| Dependências | `pnpm audit` | 0 crítico, 0 alto, 10 moderados, 1 baixo, todos em ferramentas de build e dev (`esbuild` do `drizzle-kit`, `glob`, `minimatch`, `deepmerge` e os avisos do servidor de dev do Nuxt), nenhum no output do Worker (procurado em `.output/server`: só caminhos de sourcemap). Mais o achado 2 |

## 2. Headers (prod-like)

Medidos em páginas (`/`, `/blog/x`, `/admin`, `/admin/login`, 404), dados (`/api/public/settings`, `/sitemap.xml`) e mídia. Um teste novo, `tests/api-prod/headers.spec.ts`, fixa:
- **Em tudo:** HSTS `max-age=63072000; includeSubDomains`, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, COOP `same-origin` e `Permissions-Policy` fechada.
- **Páginas:** CSP com `script-src 'self'` e hashes, sem `unsafe-inline` nem `unsafe-eval`; `object-src`, `base-uri` e `frame-ancestors` `'none'`; `form-action 'self'`.
- **Dados:** `default-src 'none'; frame-ancestors 'none'` e sem `Set-Cookie`.
- **Admin:** `noindex` e `private, no-store`.

**Pendente com o owner:** conferir os mesmos headers no preview depois do deploy, com o mesmo teste (`PROD_LIKE_URL` apontando para o preview) ou com `curl -I`.

## 3. Matriz de autorização contra o código

As 76 rotas de `server/api/admin` foram listadas com a permissão declarada e as checagens de propriedade e de sessão fresca, e comparadas com o security-model §4:
- **Propriedade:** todo 🟡 tem `assertOwnership`. Isso vale para editar, restaurar, salvar versão e excluir rascunho de artigo, projeto e página; para excluir mídia própria; e para o link de preview e a imagem de compartilhamento (F11-T2).
- **Uploads:** o envio e a finalização de mídia conferem o autor no serviço (`pendingOwnedBy`).
- **Sessão fresca:** `ai_translation` exige sessão fresca (`requireFreshSession`).
- **Ordem de projetos:** exige `project:publish`.
- **Sem linha própria na matriz:**
  - `POST /api/admin/cache/purge` (F11-T4) exige `settings:update`. Registrado no security-model.
  - As rotas de OG da F11-T2 seguem `*:read` e `*:update` com propriedade.
- **Testes que cobrem:** `tests/unit/permissions.test.ts` (célula a célula contra a tabela), `tests/api/authz-matrix.spec.ts` e o meta-teste de cobertura.

## 4. Checklist por superfície

| Superfície | Itens | Evidência |
|---|---|---|
| Autenticação e sessão | `emailAndPassword` desligado; GitHub por ID numérico; passkey com `rpID` e `origin` do ambiente e, **desde esta auditoria, UV exigida**; bootstrap com token comparado por HMAC e 404 depois; cookie `HttpOnly`, `SameSite=Lax`, `path=/`, `Secure` e prefixo fora de localhost, 7 dias; sessão fresca de 15 min; `cookieCache` desligado (a revogação vale na hora); `RL_AUTH`; auditoria de login, falha, passkey e revogação | `server/services/auth/options.ts`, `policies.ts`; `tests/auth-flow`, `tests/api/auth.spec.ts`, `hardening.spec.ts` |
| Autorização | `defineAdminHandler` em toda rota; 401 antes do handler; matriz verde; `assertOwnership` nas ações de `author`; respostas sem hash, token ou IP (o contato não devolve `ip_hash`) | §3; `authz-matrix.spec.ts`; `contact.spec.ts` |
| Entrada, CSRF e XSS | zod `strict`; JSON ≤ 1 MB; origem e `Content-Type` nas mutações (403/415); renderer com allowlist; HAST validado; protocolos de URL; embeds por allowlist; JSON-LD escapado | `hardening.spec.ts`, `tests/unit/document-schema*`, `jsonld.spec.ts`, `embed.spec.ts` |
| Headers e CSP | §2; nenhum `securitypolicyviolation` nos E2E (`csp.spec.ts`) | `csp.spec.ts`, `headers.spec.ts` |
| Uploads e mídia | allowlist de MIME e magic bytes; SVG e marcação recusados; chaves do servidor; originais sem URL; entrega `nosniff`/`inline`/`Content-Type` gravado; `finalize` confere o manifesto; exclusão bloqueada em uso; upload duplicado simultâneo responde 409 (F12-T2) | `media.spec.ts`, `media-delivery.spec.ts`, `tests/workers/media.test.ts` |
| Contato | Turnstile no servidor, `RL_PUBLIC`, honeypot, zod, IP só como HMAC, retenção de 12 meses pelo cron, notificação só para o endereço verificado | `contact.spec.ts`, `tests/workers/contact.test.ts` |
| Dados, segredos e infraestrutura | Drizzle parametrizado; segredos só por `wrangler secret`/`.dev.vars`; sem SSRF; build sem login de teste; audit high limpo; deploy de produção só manual (ADR-0014); o CI não tem acesso à Cloudflare | §1; `.github/workflows/*.yml` |
| Privacidade | nenhum cookie fora do admin (varredura do sitemap na F11-T4); terceiros só no contato (Turnstile) e nos embeds com facade e `nocookie`; a página de privacidade lista dados e retenções; nada pessoal vai ao provedor de IA (só campos de conteúdo) | `cache.spec.ts`, `contact.spec.ts`, `tests/workers/translation-*.test.ts` |

## 5. Testes de segurança

A saída está no relatório da DoD da F12-T3:
- a suíte `api` inteira: authz, CSRF e origem, rate limit, headers, uploads, cache sem cookie e auth;
- o `api-prod`, com os headers;
- o `auth-flow`, com a J-08 e a recusa sem UV;
- o `layout.spec` do menu mobile, repetido 5 vezes (desktop e mobile), depois da correção do `aria-expanded` (registrada na auditoria de acessibilidade);
- os unitários de permissões e de opções de auth;
- os workers de mídia e de contato.

## 6. Pendências

| Item | Quem | Quando |
|---|---|---|
| Conferir os headers no preview (§2) | owner, com deploy autorizado | antes do release (F12-T5) |
| Achado 2: rever o Nuxt ≥ 4.6.3 quando couber no orçamento, ou subir o R7 | owner | na próxima atualização do Nuxt, ou na F12-T5 |
| Moderados de build e dev no `pnpm audit` | dev | a cada atualização de dependências; nenhum chega ao Worker |
