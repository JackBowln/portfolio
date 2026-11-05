# Backup, restauração, rollback e recuperação de acesso

Decisão em [ADR-0014](../architecture/adr/0014-operacao.md). **Todo procedimento aqui que altera produção exige pedido explícito do owner** e confirmação antes de cada comando destrutivo.

## 1. O que é protegido

| Dado | Mecanismo | Frequência | Retenção |
|---|---|---|---|
| D1 de produção | Time Travel (nativo) | Contínuo | 7 dias (Free) |
| D1 de produção | `wrangler d1 export` (schema, depois dados) → R2 `portfolio-backups/d1/<ambiente>/AAAA-MM-DD.sql` (`backup.yml`, `scripts/ops/backup.ts`), relido e conferido por SHA-256 | Semanal | 12 semanas (o script remove o de 84 dias atrás) |
| Mídia (R2) | Chaves por conteúdo + originais em `originals/`; manifesto (item, SHA-256, chaves do original, das variantes e das legendas, com tamanhos) → `portfolio-backups/media/<ambiente>/manifest-AAAA-MM-DD.json` | Semanal | 12 semanas |
| Mídia (R2) | Cópia local opcional (`rclone` ou `wrangler r2 object get` em lote) | Mensal (manual) | A critério do owner |
| Código e configuração | Git (GitHub) | A cada commit | Permanente |
| Segredos | Gerenciador de senhas do owner (fora do repositório) | A cada rotação | — |

## 2. Restaurar o D1

### 2.1 Pelo Time Travel (até 7 dias, **destrutivo**: substitui o estado atual)

```bash
wrangler d1 time-travel info portfolio-production              # bookmark atual
wrangler d1 time-travel restore portfolio-production --timestamp=<ISO-8601>
# ou --bookmark=<id> registrado antes da migração
```

**Antes:**
1. Exportar o estado atual (`wrangler d1 export … --output antes-do-restore.sql`).
2. Anotar o bookmark atual.
3. Confirmar com o owner.

### 2.2 Por export semanal

1. Baixar o `.sql` de `portfolio-backups` (`wrangler r2 object get portfolio-backups/d1/<ambiente>/<data>.sql --file backup.sql --remote`).
2. Restaurar primeiro num banco **novo** de verificação:
   ```bash
   wrangler d1 create portfolio-restore-check
   wrangler d1 execute portfolio-restore-check --remote --file backup.sql --yes
   ```
3. Conferir as contagens e uma amostra: `node scripts/ops/restore-check.ts --remote --source <banco de origem> --target portfolio-restore-check`.
4. Só então, com confirmação, aplicar em produção (ou trocar o binding para o banco verificado). Depois, `wrangler d1 delete portfolio-restore-check`.

**Ordem do export (achado do ensaio de 05/11/2026).** Um `wrangler d1 export` único segue a ordem do `sqlite_master`. Uma tabela recriada por migração (`tags`, na 0004) fica depois das tabelas que a referenciam. Como o D1 aplica as foreign keys, o import desse arquivo falha com `no such table: main.tags` (o `sqlite3` aceita, porque deixa as FKs desligadas). Por isso o `backup.ts` exporta `--no-data` e `--no-schema` e junta os dois nessa ordem: todas as tabelas existem antes do primeiro `INSERT`. Um export feito à mão para restaurar segue a mesma regra.

## 3. Restaurar mídia

- Objetos apagados por engano dentro da janela de exclusão lógica (30 dias) continuam no R2: basta reverter o status no D1.
- Fora da janela: recuperar da cópia local mensal e reenviar com o mesmo SHA-256. As chaves se mantêm porque são endereçadas por conteúdo.

## 4. Rollback de código

```bash
wrangler versions list --env production
wrangler versions deploy <versão-anterior>@100% --env production
# atalho: wrangler rollback --env production
```

Se a versão anterior depender de um schema antigo, avaliar a compatibilidade (expand/contract torna isso seguro na maioria dos casos).

## 5. Recuperação de acesso ao admin

| Cenário | Procedimento |
|---|---|
| Perdeu a passkey, tem o GitHub | Entrar com GitHub em `/admin/login` → Configurações → Passkeys → remover a antiga e registrar uma nova |
| Perdeu o GitHub, tem a passkey | Entrar com a passkey; atualizar `OWNER_GITHUB_ID` (novo ID) com `wrangler secret put` e revincular a conta GitHub nas configurações |
| Perdeu os dois | Exige acesso à conta Cloudflare: (1) `wrangler secret put OWNER_GITHUB_ID` com o ID da conta GitHub disponível; (2) `wrangler d1 execute portfolio-production --remote --command "DELETE FROM sessions WHERE user_id = '<owner-id>'"`; (3) atualizar `accounts.account_id` do owner para o novo ID; (4) entrar com GitHub e registrar uma nova passkey; (5) registrar o incidente no `audit_log` e neste documento |

## 6. Registro de ensaios (trimestral)

| Data | Tipo (D1 export / Time Travel em preview / rollback / mídia) | Resultado | Tempo | Observações |
|---|---|---|---|---|
| 05/11/2026 | D1 export → banco novo, **local** (cópia do prod-like, 30 tabelas, 110 linhas) | ✅ contagens e amostras iguais (`restore-check.ts`) depois de ordenar o export; o export único falhou no import (ver §2.2) | export 1 s · restore 1 s · conferência 4 s | Achado que mudou o backup |
| 05/11/2026 | D1 export → banco novo, **preview** (`backup.ts --env preview` → `r2 object get` → `d1 create portfolio-restore-check` → `execute --file` → `restore-check.ts --remote` → `d1 delete`) | ✅ 30 tabelas; contagens e amostras iguais. O preview só tem o schema (9 linhas, de `d1_migrations`): o ensaio com conteúdo é o local acima | backup 18 s (inclui a releitura) · download e criação 3 s · restore 3 s (86 queries) · conferência 6 s | Primeiro backup: `d1/preview/2026-11-05.sql` (25.495 bytes) e `media/preview/manifest-2026-11-05.json`, os dois relidos e conferidos por SHA-256 |
| 05/11/2026 | Rollback de código, **preview** (`versions deploy 05a5a121…@100%`, a versão da F00, e de volta para `b3a8941e…`) | ✅ a versão anterior já servia `/` 12 s depois do comando (1.354 bytes, `/sitemap.xml` 404); depois da volta, o conteúdo novo e o smoke verde | comando 3 s · efeito ≤ 12 s | O `/api/health` mostra `0.1.0` nas duas versões, então não serve para saber qual está no ar enquanto a versão do `package.json` não mudar a cada release |
