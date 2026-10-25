---
name: security-audit
description: Audita a segurança deste portfólio (Nuxt 4 + Cloudflare Workers + Better Auth) — autenticação por passkey/GitHub, sessões, RBAC no servidor, APIs do admin, CSRF, XSS, CSP por hash, uploads, embeds, formulários, rate limiting, segredos, SQL, SSRF e privacidade (LGPD/GDPR) — e entrega achados por severidade com evidência e correção. Use depois de mudanças em server/api, auth, middleware, plugins de segurança, upload, renderer, embeds ou configuração; antes de concluir tarefas sensíveis; e antes de release.
when_to_use: "Gatilhos: 'auditar segurança', 'revisão de segurança', 'é seguro?', 'login', 'sessão', 'permissão', 'RBAC', 'upload', 'CSP', 'CSRF', 'XSS', 'rate limit', 'segredo', 'token', 'formulário de contato', 'embed', 'antes do deploy'. Substitui um /security-review do projeto (nome reservado pelo comando nativo do Claude Code)."
argument-hint: "[diff | caminho | completo]"
---

# Security Audit

Auditoria **somente leitura**: não altera código, a menos que o usuário peça a correção. **Nunca imprima valores de segredos**; refira-se a eles pelo nome e pelo local.

Fontes:
- `docs/architecture/security-model.md` (ativos, superfícies, matriz de autorização);
- `docs/architecture/adr/0005-autenticacao-e-rbac.md`;
- `docs/architecture/adr/0012-seguranca.md`;
- [references/checklist.md](references/checklist.md);
- [references/threat-model.md](references/threat-model.md).

## Procedimento

1. **Escopo**, a partir de `$ARGUMENTS`:
   - `diff` (padrão) → `git diff main...HEAD` + não commitados;
   - caminho → arquivos sob ele;
   - `completo` → todas as superfícies do security-model §2.
2. **Mapeie** as superfícies tocadas: rotas, middleware, plugins, componentes de renderização, configuração.
3. **Rode o checklist** das superfícies tocadas e as buscas automáticas abaixo.
4. **Rode os testes de segurança** relevantes (`pnpm test:api`, matriz de authz, meta-teste de permissões) e cole o resumo.
5. **Classifique e reporte.**

## Buscas automáticas (cole o comando e a contagem)

```bash
grep -rn "v-html" app/ --include=*.vue                      # esperado: 0
grep -rn "sql.raw\|sql\`.*\${" server/                       # revisar cada ocorrência
grep -rn "runtimeConfig" nuxt.config.ts                      # o bloco public só tem siteUrl, mediaBaseUrl, turnstileSiteKey
grep -rln "defineEventHandler" server/api/admin/             # esperado: 0 (usar defineAdminHandler)
grep -rn "console\.\(log\|info\).*\(token\|secret\|password\|cookie\)" server/ app/
grep -rn "fetch(" server/ | grep -v "env\.\|\$fetch('/"       # SSRF: nenhum fetch de URL vinda do usuário
grep -rn "TEST_AUTH\|__test__" .output/ 2>/dev/null           # esperado: 0 no build de produção
pnpm audit --audit-level high
```

## Severidade

| Nível | Critério | Exemplo |
|---|---|---|
| Crítico | Execução de código, bypass de autenticação, vazamento de segredo | Rota admin sem sessão; segredo no bundle |
| Alto | Escalada de privilégio, XSS armazenado, CSRF em mutação, upload perigoso | `author` publica; `v-html` com conteúdo; SVG aceito |
| Médio | Defesa em profundidade ausente com mitigação parcial | Header faltando; rate limit ausente numa rota secundária |
| Baixo | Hardening ou higiene | Mensagem de erro detalhada demais em dev |
| Info | Observação | Dependência com update de segurança disponível sem impacto |

## Saída

```markdown
## Auditoria de segurança — <escopo> — <data>
**Resumo:** C:0 A:0 M:0 B:0 · testes de segurança: <resumo>
| # | Severidade | Superfície | Achado | Evidência (arquivo:linha) | Cenário de exploração | Correção recomendada |
|---|---|---|---|---|---|---|
**Verificado sem achados:** <lista de itens do checklist conferidos>
**Não verificado (e por quê):** …
```

Uma tarefa só é concluída sem achados **Críticos ou Altos** abertos (Definition of Done).
