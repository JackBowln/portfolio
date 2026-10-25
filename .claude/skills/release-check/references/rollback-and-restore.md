# Rollback e restore — guia rápido

Procedimentos completos: `docs/operations/backup-restore.md`. **Tudo aqui é executado pelo owner, ou com pedido explícito dele, um passo por vez.**

## Rollback de código (sem mudança de schema)

```bash
wrangler versions list --env production
wrangler versions deploy <versão-anterior>@100% --env production
```

Depois: smoke test nas rotas R1, R3 e `/api/health`, e purge da tag `site`, se o `cross_version_cache` estiver ligado.

## Rollback com migração envolvida

1. Se a migração foi **expand** (só adicionou), o rollback de código basta: o schema novo é compatível.
2. Se houve **contract** (removeu ou alterou): avaliar o restore pelo Time Travel até o bookmark registrado antes da migração. É **destrutivo**: perde as escritas posteriores.
   ```bash
   wrangler d1 export portfolio-production --remote --output antes-do-restore.sql   # salvaguarda
   wrangler d1 time-travel restore portfolio-production --bookmark=<bookmark>
   ```
3. Registrar o incidente em `docs/operations/` (causa, impacto, ação preventiva).

## Restore a partir do export semanal

Restaurar primeiro num banco de verificação, conferir as contagens e uma amostra, e só então aplicar à produção, com confirmação.

## Sinais para acionar o rollback

- Taxa de erro 5xx acima do normal nos Workers Logs logo após o deploy.
- Falha no smoke test (home, artigo, admin login).
- Violação de CSP em produção nas rotas principais.
- Regressão grave de LCP ou CLS nas rotas-chave.
