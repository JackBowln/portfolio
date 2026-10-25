# Modelo de segurança

Complementa o [ADR-0005](adr/0005-autenticacao-e-rbac.md) (auth e RBAC) e o [ADR-0012](adr/0012-seguranca.md) (controles). A skill `/security-audit` usa este documento como referência.

## 1. Ativos

| Ativo | Por que importa |
|---|---|
| Sessões e credenciais do admin (passkeys, conta GitHub vinculada) | Controle total do site |
| Conteúdo não publicado (rascunhos, agendados) | Confidencialidade editorial |
| Integridade do conteúdo publicado e das configurações | Reputação profissional |
| Mensagens de contato (nome, e-mail, texto) | Dados pessoais (LGPD/GDPR) |
| Segredos (`BETTER_AUTH_SECRET`, `PREVIEW_TOKEN_SECRET`, OAuth, `IP_HASH_SALT`…) | Comprometem sessões, preview e privacidade |
| Cota gratuita (requisições, neurons de IA, D1, R2) | Abuso gera indisponibilidade ou custo |
| Histórico (revisões, auditoria, backups) | Recuperação e responsabilização |

## 2. Superfícies de ataque

| Superfície | Exposição | Controles principais |
|---|---|---|
| Páginas públicas (SSR/cache) | Anônima | Sem `v-html`, renderer com allowlist, CSP por hash, sem cookies, headers de segurança |
| `/api/public/contact` | Anônima | Turnstile, `RL_PUBLIC`, zod, limite de tamanho, checagem de origem, sem reflexo de entrada |
| `/api/auth/*` | Anônima | Better Auth (checagem de origem), `RL_AUTH`, allowlist do GitHub, sem cadastro público, auditoria |
| `/admin/setup` (bootstrap) | Anônima até existir owner | Exige ausência de owner **e** `BOOTSTRAP_TOKEN`; 404 depois |
| `/api/admin/*` | Autenticada | Sessão obrigatória, `requirePermission`, propriedade, zod, origem + JSON, `RL_ADMIN`, auditoria |
| Upload de mídia | Autenticada | Magic bytes, allowlist de MIME, limites, chaves geradas pelo servidor, SVG bloqueado, `nosniff` |
| Editor e conteúdo (embeds, links, código) | Autenticada → público | Schema estrito, protocolos de URL, allowlist de embeds, HAST com allowlist |
| `/preview/{token}` | Quem tiver o link | HMAC, expiração ≤ 24 h, `noindex`, `private, no-store` |
| Cron e tarefas | Interna | Sem entrada externa; idempotente; poucos itens por execução |
| Tradução por IA | Saída do provedor | Saída tratada como dado: schema, tags inline validadas, nada executado |
| CI/CD e repositório | Desenvolvedores | Token Cloudflare com escopo mínimo, secrets do GitHub, sem segredos no repositório, deploy só manual |

## 3. Ameaças (STRIDE resumido)

| Categoria | Ameaça | Mitigação |
|---|---|---|
| **S**poofing | Roubo de sessão; login por conta GitHub alheia | Cookies `HttpOnly/Secure/SameSite=Lax`; allowlist por ID numérico; passkey resistente a phishing |
| **T**ampering | Alterar conteúdo via CSRF; payload malicioso no documento | Origem + JSON + SameSite; schema estrito; revisões imutáveis |
| **R**epudiation | Ação administrativa sem rastro | `audit_log` em toda mutação, com ator, ação, entidade e hash de IP |
| **I**nformation disclosure | Vazamento de rascunho, segredo ou stack trace | Público lê só snapshots publicados; erros genéricos; segredos fora do cliente; logs sem PII |
| **D**enial of service | Abuso do formulário, do login ou de traduções esgotando cotas | Rate limits, Turnstile, guarda de custo de IA, cache de borda |
| **E**levation of privilege | Papel `author` publicando; rota admin sem checagem | `requirePermission` por handler + meta-teste de cobertura; checagem de propriedade |

## 4. Matriz de autorização (padrão)

✅ = permitido · 🟡 = só o próprio conteúdo · — = negado

| Permissão | owner | admin | editor | author | translator | viewer |
|---|---|---|---|---|---|---|
| `article/project/page:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `article/project:create` | ✅ | ✅ | ✅ | ✅ | — | — |
| `article/project/page:update` | ✅ | ✅ | ✅ | 🟡 | — | — |
| `article/project/page:delete` | ✅ | ✅ | ✅ | 🟡 (rascunho) | — | — |
| `article/project/page:publish`, `:schedule` | ✅ | ✅ | ✅ | — | — | — |
| `article/project/page:restore` | ✅ | ✅ | ✅ | 🟡 | — | — |
| `media:create/update` | ✅ | ✅ | ✅ | ✅ | — | — |
| `media:delete` | ✅ | ✅ | ✅ | 🟡 | — | — |
| `translation:run` | ✅ | ✅ | ✅ | — | ✅ | — |
| `translation:review` / `:approve` | ✅ | ✅ | ✅ | — | ✅ | — |
| `settings:read` | ✅ | ✅ | ✅ | — | — | ✅ |
| `settings:update` | ✅ | ✅ | — | — | — | — |
| `user:invite`, `:update-role`, `:revoke-session` | ✅ | ✅ (exceto owner) | — | — | — | — |
| `audit:read` | ✅ | ✅ | — | — | — | — |

A tabela é a especificação de `shared/auth/permissions.ts`. Os testes da F03-T3 geram casos a partir dela.

## 5. Controles por camada (checklist resumido)

- **Transporte:** HTTPS só (HSTS em produção), `upgrade-insecure-requests`.
- **Sessão:** prefixo `__Secure-`, `HttpOnly`, `Secure`, `SameSite=Lax`, expiração de 7 dias, sessão fresca para ações sensíveis, revogação.
- **Entrada:** zod `strict` em body, query e params; limites de tamanho; normalização de slug e URLs.
- **Saída:** Vue escapa; nenhum `v-html`; JSON-LD serializado com escape de `</script>`.
- **Armazenamento:** Drizzle parametrizado; nada de `sql.raw` com entrada; IP como HMAC; tokens OAuth descartados ou criptografados.
- **Navegador:** CSP por hash; `frame-ancestors 'none'`; `Permissions-Policy` restritiva; COOP.
- **Operação:** segredos via `wrangler secret`; `pnpm audit`; Dependabot; deploy manual; auditoria.

## 6. Privacidade

- **Dados pessoais tratados:** mensagens de contato (12 meses), sessões do admin, `audit_log` (12 meses) e logs da plataforma (3 dias no Free).
- **Sem rastreamento:** nenhum cookie fora do admin; sem analytics por padrão (Q-08 no PRD).
- **Terceiros:** Turnstile só na página de contato; embeds com facade e domínios sem cookie (`youtube-nocookie`); fontes self-hosted.
- **Página de privacidade:** descreve finalidade, base legal, retenção, direitos e contato do responsável. O texto é escrito pelo owner, e o Claude Code pode propor uma estrutura.

## 7. Resposta a incidentes (resumo)

1. Revogar todas as sessões (Better Auth) e rotacionar `BETTER_AUTH_SECRET`, com pedido do owner.
2. Desabilitar rotas afetadas por flag ou fazer rollback de versão.
3. Avaliar a integridade pelas revisões e pela auditoria; restaurar pelo Time Travel ou export, se necessário.
4. Registrar um post-mortem em `docs/operations/` com causa e ação preventiva.
