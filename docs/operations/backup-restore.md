# Backup, restauração, rollback e recuperação de acesso

Decisão em [ADR-0014](../architecture/adr/0014-operacao.md). **Todo procedimento aqui que altera produção exige pedido explícito do owner** e confirmação antes de cada comando destrutivo.

## 1. O que é protegido

| Dado | Mecanismo | Frequência | Retenção |
|---|---|---|---|
| D1 de produção | Time Travel (nativo) | Contínuo | 7 dias (Free) |
| D1 de produção | `wrangler d1 export` → R2 `portfolio-backups/d1/AAAA-MM-DD.sql` (GitHub Actions agendado) | Semanal | 12 semanas |
| Mídia (R2) | Chaves por conteúdo + originais em `originals/`; manifesto (chave, tamanho, SHA-256) → `portfolio-backups/media/manifest-AAAA-MM-DD.json` | Semanal | 12 semanas |
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

1. Baixar o `.sql` de `portfolio-backups`.
2. Restaurar primeiro num banco **novo** de verificação (`wrangler d1 create portfolio-restore-check` + `wrangler d1 execute portfolio-restore-check --remote --file backup.sql`).
3. Conferir as contagens e uma amostra de conteúdo.
4. Só então, com confirmação, aplicar em produção (ou trocar o binding para o banco verificado).

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
| _pendente (F12-T4)_ | | | | |
