# ADR-0014 — Operação: ambientes, CI/CD, migrações, backups, observabilidade e rollback

- **Status:** Aceito (2026-10-25)
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0002, ADR-0004, [environments](../../operations/environments.md), [backup-restore](../../operations/backup-restore.md), RNF-08, RNF-13

## Contexto

- O deploy é para o Workers com D1 e R2, no plano Free: D1 Time Travel de 7 dias, Workers Logs com 3 dias e 5 Cron Triggers por conta.
- Nada de deploy, migração remota ou alteração de DNS sem pedido explícito do owner.
- Minutos de CI dependem de o repositório ser público ou privado (Q-07).

## Decisão

1. **Ambientes:**
   - `local`: `nuxt dev` + miniflare, com estado em `.wrangler/state`.
   - `preview`: Worker `portfolio-preview` em `workers.dev`, com D1 e R2 próprios, sempre `noindex`.
   - `production`: Worker `portfolio` no domínio próprio, com D1 e R2 próprios.

   A configuração fica em `wrangler.jsonc` com `env.preview` e `env.production`; segredos via `wrangler secret put --env`.
2. **CI (GitHub Actions)**, em todo PR: os checks do [ADR-0013](0013-testes-e-qualidade.md).
3. **CD.**
   - **Preview**, depois do merge na `main` e só quando o owner tiver habilitado o workflow: build → `wrangler d1 migrations apply --env preview --remote` → `wrangler versions upload --env preview` → `wrangler versions deploy` → smoke.
   - **Produção**, só por `workflow_dispatch` disparado pelo owner:
     1. checks completos;
     2. registrar o bookmark do Time Travel;
     3. aplicar as migrações;
     4. `versions upload`;
     5. `versions deploy` (100%);
     6. smoke;
     7. purge, se `cross_version_cache` estiver ligado.
   - O token da Cloudflare para o CI tem escopo mínimo (Workers Scripts:Edit, D1:Edit e, se precisar, Cache Purge) e fica nos secrets do GitHub.
4. **Migrações.** Expand/contract: adicionar (colunas anuláveis ou tabelas novas) → backfill → código novo → remover em deploy posterior. Sempre aplicar no preview antes da produção. Nunca editar uma migração já aplicada.
5. **Backups.**
   - D1 Time Travel cobre restauração pontual de até 7 dias.
   - **Export semanal** por GitHub Actions agendado: `wrangler d1 export portfolio-production --remote` → bucket R2 privado `BACKUPS`, guardando 12 semanas.
   - Mídia: as chaves são endereçadas por conteúdo e os originais ficam em `originals/`. Um manifesto semanal (chaves + SHA-256) vai para `BACKUPS`. Cópia local mensal opcional, com procedimento documentado.
   - **Ensaio de restore trimestral** em preview, registrado em [backup-restore](../../operations/backup-restore.md).
6. **Observabilidade.**
   - Workers Logs habilitado (`observability.enabled`), com logs JSON estruturados (`requestId`, rota, status, duração, CPU quando disponível) e sem PII.
   - `/api/health` devolve só o status e a versão.
   - Revisão mensal de uso (requisições, CPU, linhas lidas e escritas no D1, operações do R2, neurons) no `/release-check` ou numa tarefa de manutenção.
   - Monitor externo de disponibilidade só com aprovação (serviço externo).
7. **Rollback.** De código: `wrangler versions deploy <versão anterior>` (ou `wrangler rollback`). De dados: restauração pelo Time Travel, que é destrutiva, segue o runbook e exige confirmação do owner.
8. **Cron.**
   - Um único trigger, `*/5 * * * *`, para tarefas Nitro: publicar agendados, purgar tags, podar autosaves e remover mídia marcada há mais de 30 dias.
   - Cada execução processa poucos itens, para ficar abaixo de 10 ms de CPU (o I/O não conta).
9. **Domínio e DNS.** Ação do owner. O HSTS preload só depois de estabilizado e com aprovação.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Workers Builds (CI da Cloudflare) | Viável, mas os checks de qualidade já ficam no GitHub Actions; avaliar se os minutos do GitHub forem um problema |
| Deploy automático em produção a cada merge | Viola a regra de deploy só com pedido explícito |
| Monitoramento pago (Sentry e similares) | Serviço externo; os Workers Logs bastam no início |

## Consequências

### Positivas
- Custo zero, rollback rápido e dados recuperáveis além dos 7 dias do Time Travel.

### Negativas e custos
- O export semanal pode perder até 7 dias de alterações fora da janela do Time Travel (aceitável para o volume editorial).

### Riscos e mitigação
- **Migração destrutiva por engano:** expand/contract, preview primeiro, bookmark registrado e `ask` no `.claude/settings.json` para comandos remotos.

## Validação

- F12-T4: restore ensaiado (D1 de um export num banco de preview); rollback de versão ensaiado em preview.

## Referências

- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) (Time Travel)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) (Cron)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) (Workers Logs)
