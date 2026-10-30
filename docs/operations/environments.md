# Ambientes, bindings e segredos

Decisão em [ADR-0014](../architecture/adr/0014-operacao.md). Este documento lista **nomes**, nunca valores. **Criar recursos, configurar segredos e fazer deploy são ações do owner** (ou do Claude Code com pedido explícito).

## 1. Ambientes

| | local | preview | production |
|---|---|---|---|
| URL | `http://localhost:3000` | `https://portfolio-preview.<subdominio>.workers.dev` | `https://<domínio>` (Q-01) |
| Worker | — (`nuxt dev` + emulação) | `portfolio-preview` | `portfolio` |
| D1 (`DB`) | estado local (`.wrangler/state`) | `portfolio-preview` | `portfolio-production` |
| R2 (`MEDIA`) | local | `portfolio-media-preview` | `portfolio-media-production` |
| R2 (`BACKUPS`) | — | — | `portfolio-backups` |
| Entrega de mídia | rota `/media/**` | rota `/media/**` | `MEDIA_BASE_URL` = `https://media.<domínio>` (bucket com domínio próprio) |
| Workers Cache | desligado | ligado (para testar) | ligado |
| Indexação | — | `noindex` em tudo | permitida (exceto `/admin`, `/api`, `/preview`) |
| RP ID das passkeys | `localhost` | host do workers.dev | domínio |
| Turnstile | chaves de teste oficiais | site próprio (Free) | site próprio (Free) |
| Cron | manual (`nitro task run`; `wrangler dev --test-scheduled`) | `*/5 * * * *` | `*/5 * * * *` |

## 2. Variáveis e segredos por nome

| Nome | Tipo | Ambientes | Descrição |
|---|---|---|---|
| `ENVIRONMENT` | var | todos | `local`, `preview`, `production` (`test` nos builds de teste) |
| `SITE_URL` | var | todos | Origem canônica (sem barra final) |
| `NUXT_PUBLIC_SITE_URL` | var | todos | Mesmo valor da `SITE_URL`, lido pelo app como `runtimeConfig.public.siteUrl` (canonical, hreflang, JSON-LD). Um teste garante a igualdade |
| `MEDIA_BASE_URL` | var | todos | Base pública da mídia, sem barra final: URL = base + `/` + chave do R2 (`media/…`). Local e preview: a origem do próprio site (rota `/media/**`); produção: o domínio do bucket |
| `NUXT_PUBLIC_MEDIA_BASE_URL` | var | todos | Mesmo valor da `MEDIA_BASE_URL`, lido pelos componentes como `runtimeConfig.public.mediaBaseUrl`. Um teste garante a igualdade (F04-T3) |
| `TURNSTILE_SITE_KEY` | var pública | todos | Widget do contato |
| `BETTER_AUTH_SECRET` | segredo | preview e produção (local opcional) | Assinatura de sessões (≥ 32 caracteres aleatórios). Sem ele, preview e produção falham fechados; local usa um valor aleatório por isolate (sessões caem quando o isolate reinicia). Local: `.dev.vars`; remoto: `wrangler secret put`, só com pedido do owner |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | segredo | todos | Um OAuth App por ambiente (callback `${SITE_URL}/api/auth/callback/github`) |
| `OWNER_GITHUB_ID` | segredo | todos | ID numérico do GitHub do owner (allowlist) |
| `BOOTSTRAP_TOKEN` | segredo | temporário | Só até criar o owner; apagar depois. Com menos de 32 caracteres o bootstrap não abre. Os testes usam um valor falso (`pnpm preview:test`) |
| `PREVIEW_TOKEN_SECRET` | segredo | preview e produção (local opcional) | HMAC dos links de preview (≥ 32 caracteres). Sem ele, preview e produção falham fechados; o local usa um valor aleatório por isolate, e o build de teste recebe um valor fixo por `--var` (`pnpm preview:test`). Trocar o valor invalida todos os links |
| `IP_HASH_SALT` | segredo | todos | Chave do HMAC-SHA256 dos IPs no `audit_log` (rotação anual). Sem ela, o `ip_hash` fica nulo: nunca há hash sem chave nem IP em claro. Os testes usam um valor falso (`pnpm preview:test`) |
| `TURNSTILE_SECRET_KEY` | segredo | todos | Validação do Turnstile |
| `CF_API_TOKEN_PURGE` | segredo | só se usar o fallback | Purge por tag via API (ADR-0003) |
| `ANTHROPIC_API_KEY` | segredo | futuro | Só com ADR e aprovação (ADR-0009) |

**Local:**
- `.dev.vars` (no `.gitignore`) com os valores de desenvolvimento.
- `.dev.vars.example` versionado, só com os nomes (criado na F00-T3).

**Remoto:** `wrangler secret put <NOME> --env <preview|production>`.

## 3. Bindings não secretos (`wrangler.jsonc`)

| Binding | Tipo | Observação |
|---|---|---|
| `DB` | D1 | `migrations_dir: server/db/migrations` |
| `MEDIA`, `BACKUPS` | R2 | `BACKUPS` só em produção |
| `AI` | Workers AI | Free: 10 mil neurons/dia. Só em preview e produção: não tem emulação local, e declará-lo localmente abriria uma sessão remota no `nuxt dev` e nos testes (ADR-0015) |
| `RL_AUTH`, `RL_PUBLIC`, `RL_ADMIN` | Rate limiting | `simple: { limit, period: 60 }` |
| `CONTACT_EMAIL` | `send_email` | Destino = endereço verificado no Email Routing (Q-05) |
| `ASSETS` | Static Assets | Gerado pelo Nitro |
| `cache` | Workers Cache | `{ enabled: true }` em preview e produção (validar no F00-T6) |
| `observability` | Workers Logs | `enabled: true` |
| `triggers.crons` | Cron | `["*/5 * * * *"]` em `env.preview` e `env.production` (o local não tem cron). Um só trigger para todas as tarefas (`nuxt.config` `scheduledTasks`); quem precisa de menos frequência decide dentro da tarefa, como a poda diária de autosaves (F06-T2) |

## 4. Recursos a criar (comandos de referência, executados pelo owner)

```bash
# Preview
wrangler d1 create portfolio-preview
wrangler r2 bucket create portfolio-media-preview

# Produção (somente no lançamento)
wrangler d1 create portfolio-production
wrangler r2 bucket create portfolio-media-production
wrangler r2 bucket create portfolio-backups
```

Contas necessárias, todas gratuitas:
- **Cloudflare (Workers Free):** D1, R2, Workers AI, Turnstile e Email Routing.
- **GitHub:** repositório, OAuth Apps e Actions.
- **Domínio:** o registro tem custo e precisa de aprovação (Q-01).

## 5. Desenvolvimento local (preenchido na F00)

```bash
nvm use                          # Node 24 (.nvmrc)
corepack enable pnpm
pnpm install
cp .dev.vars.example .dev.vars   # preencher valores de desenvolvimento
pnpm db:migrate:local            # a partir da F02-T1
pnpm db:seed                     # conteúdo [PLACEHOLDER], a partir da F02-T1
pnpm dev                         # http://localhost:3000, bindings emulados pelo wrangler
```

- **Bindings no `nuxt dev`:** o preset `cloudflare_module` do Nitro carrega o `wrangler.jsonc` via `getPlatformProxy`, e o código lê os bindings com `useEnv(event)` (`server/utils/env.ts`). O estado do D1 e do R2 locais fica em `.wrangler/state` (no `.gitignore`).
- **Diagnóstico:** `GET /api/_dev/bindings` grava e lê no D1 e no R2 locais. A rota só existe em dev.
- **Build de produção local:** `pnpm build && pnpm preview` roda o Worker no `wrangler dev` (http://localhost:8787), com o mesmo estado local do dev.
- **Tipos:** `pnpm cf:types` regenera o `worker-configuration.d.ts` depois de qualquer mudança no `wrangler.jsonc`.
- **Redirecionamento do wrangler:** depois de um build, o arquivo `.wrangler/deploy/config.json` faz os comandos do wrangler rodados na raiz usarem `.output/server/wrangler.json`, que tem os mesmos bindings e é o artefato de deploy.
