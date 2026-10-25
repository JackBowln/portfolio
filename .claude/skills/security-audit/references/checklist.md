# Checklist por superfície

## Autenticação e sessão (ADR-0005)
- [ ] `emailAndPassword` desligado; nenhuma rota de cadastro utilizável.
- [ ] GitHub: allowlist por **ID numérico** (`OWNER_GITHUB_ID`), não por login nem e-mail; ID fora da lista → rejeitado sem criar usuário.
- [ ] Passkey: `rpID` = host do ambiente; `origin` = `SITE_URL`; `userVerification` exigido.
- [ ] Bootstrap: `/admin/setup` só com ausência de owner **e** token correto; 404 depois; comparação em tempo constante.
- [ ] Cookie: prefixo `__Secure-` (fora de localhost), `HttpOnly`, `Secure`, `SameSite=Lax`, `path=/`; expiração de 7 dias.
- [ ] Sessão fresca (≤ 15 min) para: papéis, remoção de passkey, orçamento de IA, exclusão de publicado.
- [ ] Revogação de sessão efetiva (respeitando o `cookieCache`); logout invalida no servidor.
- [ ] Rate limit em `/api/auth/*` (`RL_AUTH`); auditoria de login, falha, passkey e revogação.

## Autorização (RBAC)
- [ ] Todo arquivo em `server/api/admin/**` usa `defineAdminHandler({ permission })` (meta-teste verde).
- [ ] O middleware de sessão responde 401 antes do handler.
- [ ] A matriz de testes, gerada de `shared/auth/permissions.ts`, está verde.
- [ ] `assertOwnership` nas ações de `author`; IDs da URL nunca dão acesso por si só (IDOR).
- [ ] As respostas não vazam campos internos (hashes, tokens, IPs).

## Entrada, CSRF e XSS
- [ ] zod `strict` em body, query e params; limites de tamanho (JSON ≤ 1 MB).
- [ ] Mutações exigem `Origin`/`Sec-Fetch-Site` do próprio site + `Content-Type` esperado (403/415).
- [ ] Nenhum `v-html`; renderer com allowlist; HAST do Shiki validado (sem `script`/`on*`/`style` livre).
- [ ] URLs por protocolo (`https`, `http`, `mailto`, relativo); embeds só da allowlist; `rel="noopener noreferrer"` em links externos.
- [ ] JSON-LD serializado com escape de `</script>`.

## Headers e CSP (ADR-0012)
- [ ] `script-src` só com `'self'` + hashes (sem `unsafe-inline` nem `unsafe-eval`); os hashes batem com os scripts inline.
- [ ] `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`.
- [ ] `frame-src` só com a allowlist de embeds (e o Turnstile só no contato).
- [ ] HSTS em produção; `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, `X-Frame-Options`.
- [ ] Teste E2E sem `securitypolicyviolation`.

## Uploads e mídia (ADR-0007)
- [ ] MIME por allowlist **e** magic bytes; SVG de usuário bloqueado; limites de tamanho.
- [ ] Chaves do R2 geradas pelo servidor; originais nunca públicos.
- [ ] Entrega com `nosniff`, `Content-Type` do registro e `Content-Disposition: inline`.
- [ ] `finalize` confere o manifesto; exclusão bloqueada se em uso.

## Formulário de contato
- [ ] Turnstile validado no servidor; `RL_PUBLIC`; honeypot; zod; respostas sem refletir a entrada sem escape.
- [ ] IP só como HMAC; retenção de 12 meses aplicada pelo cron; notificação só para o endereço verificado.

## Dados, segredos e infraestrutura
- [ ] Drizzle parametrizado; nada de `sql.raw` com entrada.
- [ ] Segredos só via `wrangler secret`/`.dev.vars`; nada em `runtimeConfig.public`, logs, testes ou fixtures.
- [ ] O servidor não faz `fetch` de URL fornecida pelo usuário (SSRF).
- [ ] O build de produção não contém o login de teste (`TEST_AUTH`).
- [ ] `pnpm audit --audit-level high` limpo; `onlyBuiltDependencies` justificado.
- [ ] O token da Cloudflare no CI tem escopo mínimo; o deploy de produção é manual.

## Privacidade (LGPD/GDPR)
- [ ] Nenhum cookie fora do admin; sem rastreadores por padrão.
- [ ] Terceiros só onde necessário (Turnstile no contato; embeds com facade e `nocookie`).
- [ ] A página de privacidade reflete os dados, as retenções e os direitos.
- [ ] Nenhum dado pessoal enviado ao provedor de IA.
