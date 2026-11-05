# Runbook de operação

Procedimentos do dia a dia e dos incidentes comuns (F12-T4). Decisões em [ADR-0014](../architecture/adr/0014-operacao.md); restauração e recuperação de acesso em [backup-restore](backup-restore.md); nomes de recursos e segredos em [environments](environments.md).

**Regra:** tudo o que toca a Cloudflare remota (deploy, migração, secret, recurso, restore) é ação do owner, ou do Claude Code com pedido explícito. Comandos destrutivos pedem confirmação antes de cada um.

## 1. Workflows

| Workflow | Disparo | O que faz | Precisa |
|---|---|---|---|
| `ci.yml` | PR, push na `main` e chamado pelo deploy de produção | typecheck, lint, i18n, testes, build, orçamentos, Playwright, audit | nada da Cloudflare |
| `lighthouse.yml` | PR com label `ui`, `main`, manual | Lighthouse 13 no prod-like local | nada da Cloudflare |
| `deploy-preview.yml` | manual; push na `main` só com `vars.PREVIEW_AUTO_DEPLOY == 'true'` | build → `check:prod-build` → migrações remotas → `versions upload` → `versions deploy <id>@100%` → smoke | Environment `preview` com `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` |
| `deploy-production.yml` | só manual, digitando `deploy production`, a partir da `main` | confirmação → CI completo → versão atual e bookmark do Time Travel registrados → migrações → upload → deploy 100% → smoke; em falha, imprime os comandos de rollback; guarda o registro por 90 dias | Environment `production` com revisor obrigatório (o owner) e os mesmos dois secrets; `vars.SITE_URL` |
| `backup.yml` | segunda-feira 06:17 UTC (só com `vars.PRODUCTION_READY == 'true'`) e manual (preview ou produção) | export do D1 (schema e dados, nessa ordem) e manifesto de mídia → `portfolio-backups`, conferidos por SHA-256 depois do upload; remove o backup de 12 semanas atrás | Environment do ambiente, com os dois secrets |

**Token do CI:** escopo mínimo, por conta: Workers Scripts:Edit, D1:Edit, Workers R2 Storage:Edit (backups). Sem Cache Purge enquanto o `cross_version_cache` estiver desligado.

**Configuração a cargo do owner (uma vez):**
1. Criar os Environments `preview` e `production` no GitHub; em `production`, revisor obrigatório e só a branch `main`.
2. Adicionar os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` em cada Environment.
3. Variáveis: `SITE_URL` (produção), `PRODUCTION_READY` (no lançamento) e, se quiser deploy de preview a cada merge, `PREVIEW_AUTO_DEPLOY`.

## 2. Scripts (`scripts/ops/`)

| Script | Uso |
|---|---|
| `backup.ts --env <preview\|production>` | o que o `backup.yml` roda; pode ser rodado à mão, com a autorização |
| `restore-check.ts --source <db> --target <db> (--remote --env <env> \| --local --source-state <dir> --target-state <dir>)` | conta as linhas de cada tabela e compara 3 linhas de cada; sai com 1 e lista as diferenças |
| `smoke.ts --base <url> [--version <x.y.z>]` | health (e versão), páginas principais, sitemap e robots com 200, CSP e `nosniff`, nenhum `Set-Cookie` |

## 3. Incidentes comuns

| Sintoma | Primeiro passo | Correção |
|---|---|---|
| Smoke falhou depois do deploy | Ler o passo que falhou no log do workflow | Código: `wrangler rollback --env <env>` (ou `versions deploy <anterior>@100%`). Se uma migração entrou junto, avaliar se a versão anterior funciona com o schema novo (expand/contract garante na maioria dos casos) antes de pensar em Time Travel |
| 500 em todas as páginas | Workers Logs (painel → Worker → Logs), filtrando por `status >= 500` | Binding ausente ou segredo faltando: o app falha fechado. Conferir `wrangler secret list --env <env>` (só nomes) |
| 500 em `/api/auth/*` ou no admin | Logs; `BETTER_AUTH_SECRET` e `GITHUB_*` | `wrangler secret put` do que faltar (pelo owner) |
| Página publicada não atualiza | `Cache-Tag` e `Age` da resposta (`curl -I`) | Purge geral pelo admin (`POST /api/admin/cache/purge`, owner/admin) |
| Publicação agendada não saiu | Logs do cron (`*/5`); `article_localizations.status = 'scheduled'` com `scheduled_at` vencido | O cron processa poucos itens por vez; esperar uma rodada. Se persistir, publicar à mão no admin |
| Contato não chega | Logs do `contact`; Turnstile; `CONTACT_EMAIL` | Ver Q-05: endereço verificado no Email Routing |
| Tradução recusada por custo | Ledger em `translation_jobs`; tetos diário e mensal | Esperar a virada do dia ou do mês; nada de subir o teto sem o owner |
| Owner sem acesso | [backup-restore §5](backup-restore.md#5-recuperação-de-acesso-ao-admin) | — |
| Dados apagados ou corrompidos | Anotar a hora; **não** aplicar mais migrações | Até 7 dias: Time Travel ([§2.1](backup-restore.md#21-pelo-time-travel-até-7-dias-destrutivo-substitui-o-estado-atual)). Mais antigo: export semanal ([§2.2](backup-restore.md#22-por-export-semanal)) |
| Uso perto dos limites do Free | Painel → Workers & Pages → uso; D1 → métricas | Ver o que cresceu (requisições, CPU, linhas lidas); cache de borda e orçamentos de CPU (ADR-0003) |

## 4. Revisão mensal

- Uso e custos no painel da Cloudflare: requisições e CPU do Worker, linhas lidas e escritas no D1, operações e armazenamento no R2 (inclui `portfolio-backups`), neurons do Workers AI. Meta: US$ 0.
- Workers Logs dos últimos 3 dias: 5xx, rotas lentas, avisos de segredo ausente.
- Backups: as últimas execuções do `backup.yml` verdes e os objetos em `portfolio-backups`.
- Ensaio de restore trimestral, registrado em [backup-restore §6](backup-restore.md#6-registro-de-ensaios-trimestral).
- `pnpm audit --audit-level high` e as atualizações do Dependabot.
