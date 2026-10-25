# ADR-0012 — Segurança: headers, CSP por hash, CSRF, rate limiting, validação e privacidade

- **Status:** Aceito (2026-10-25)
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0003, ADR-0005, ADR-0006, ADR-0007, [security-model](../security-model.md), RNF-06, RNF-07, RNF-12

## Contexto

- Toda ação administrativa precisa ser segura no servidor, com proteção contra CSRF e XSS, rate limiting e validação de uploads.
- O HTML público é cacheado na borda, então CSP com nonce por requisição não serve (o nonce ficaria fixo no cache).
- `nuxt-security` traz rate limiter em memória (inútil no Workers) e CSP por nonce.
- O site atende Brasil e Europa: LGPD e GDPR se aplicam.

## Decisão

1. **Headers**, num plugin Nitro (`server/plugins/security-headers.ts`) e via `routeRules`:
   - `Content-Security-Policy` com **hashes** dos scripts inline (config do Nuxt, script de tema, `motion-ok`), calculados no hook de renderização a partir do HTML final, o que é determinístico e compatível com o cache:
     - `default-src 'self'`
     - `script-src 'self' 'sha256-…'` (sem `unsafe-inline` e sem `unsafe-eval`)
     - `style-src 'self' 'unsafe-inline'`: trade-off documentado, porque o Nuxt e o Vue usam estilos inline; o risco é baixo comparado ao de scripts
     - `img-src 'self' data: <MEDIA_BASE_URL>`
     - `media-src 'self' <MEDIA_BASE_URL>`
     - `font-src 'self'`
     - `connect-src 'self'`
     - `frame-src` com a allowlist de embeds (`https://www.youtube-nocookie.com`, `https://player.vimeo.com`) e `https://challenges.cloudflare.com` só no contato
     - `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains` em produção (preload só depois de estável e com aprovação).
   - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restritiva (câmera, microfone, geolocalização, pagamento, USB), `Cross-Origin-Opener-Policy: same-origin`, `X-Frame-Options: DENY`.
2. **CSRF.**
   - Cookies de sessão com `SameSite=Lax`.
   - O Better Auth valida a origem nas rotas `/api/auth`.
   - Um middleware em `/api/admin/**` e `/api/public/**` rejeita métodos que alteram estado (POST/PUT/PATCH/DELETE) quando `Origin` (ou `Sec-Fetch-Site`) não for o próprio site, e exige `Content-Type: application/json` (ou `multipart`/binário só nas rotas de upload).
3. **XSS.**
   - Sem `v-html` em lugar nenhum; o renderer escapa por construção ([ADR-0006](0006-conteudo-e-editor.md)).
   - URLs validadas por protocolo; embeds só da allowlist; HAST do Shiki com allowlist.
   - SVG enviado pelo usuário é bloqueado ([ADR-0007](0007-midia.md)). A CSP é a segunda linha de defesa.
4. **Validação.**
   - Todo body, query e param passa por um schema zod `strict` (`readValidatedBody`, `getValidatedQuery`, `getValidatedRouterParams`).
   - Limites de tamanho: JSON ≤ 1 MB; uploads conforme o ADR-0007.
   - Erros em produção são genéricos, sem stack trace e sem detalhes do banco.
5. **Autorização.** Negar por padrão: sessão obrigatória em `/api/admin/**`, permissão declarada por handler e checagem de propriedade ([ADR-0005](0005-autenticacao-e-rbac.md)).
6. **Rate limiting** com o binding nativo, aproximado por localidade:
   - `RL_AUTH`: 10 por 60 s, por IP + rota;
   - `RL_PUBLIC`: contato, 3 por 60 s por IP;
   - `RL_ADMIN`: 120 por 60 s por sessão.

   O contato também usa **Turnstile**, validado no servidor.
7. **Segredos.**
   - Só via `wrangler secret put --env`. Localmente, ficam em `.dev.vars` (no `.gitignore`, com `.dev.vars.example` sem valores).
   - Nunca vão para `runtimeConfig.public`, para log ou para mensagens de erro.
   - O Claude Code não lê `.dev.vars` nem `.env*` (bloqueado em `.claude/settings.json`).
8. **SQL.** Só via Drizzle, com parâmetros. `sql.raw` com entrada do usuário é proibido.
9. **SSRF.** O servidor não faz `fetch` de URLs fornecidas pelo usuário. Thumbnails de embed vêm de upload do owner ou de busca no cliente admin.
10. **Logs e auditoria.**
    - Logs JSON com `requestId`, sem PII nem tokens.
    - `audit_log` registra as ações administrativas.
    - IPs são guardados só como HMAC-SHA256 com `IP_HASH_SALT` (rotação anual).
11. **Dependências.**
    - `pnpm audit --audit-level high` no CI, com alertas do Dependabot.
    - O pnpm 10 bloqueia scripts de instalação por padrão; liberar via `onlyBuiltDependencies` só com justificativa.
12. **Privacidade (LGPD/GDPR).**
    - Sem rastreadores de terceiros por padrão. Turnstile só na página de contato; YouTube via `nocookie` + facade.
    - Retenção: mensagens de contato por 12 meses, `audit_log` por 12 meses, Workers Logs conforme o plano (3 dias no Free).
    - A página de privacidade descreve o tratamento de dados e o canal para solicitações dos titulares.
13. **Tokens de preview.** HMAC-SHA256 com `exp` de até 24 h, comparação em tempo constante e `private, no-store` + `noindex`.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| `nuxt-security` | Rate limit em memória por isolate; CSP por nonce incompatível com o cache |
| CSP com nonce | O nonce ficaria fixo no HTML cacheado e perderia o efeito |
| CSP com `'unsafe-inline'` em scripts | Anula a proteção contra XSS |
| Tokens CSRF sincronizados | Exigem estado e `Set-Cookie` em páginas públicas; a checagem de origem + SameSite + JSON basta para o modelo de ameaças |

## Consequências

### Positivas
- Defesa em camadas compatível com o cache de borda; nenhum segredo alcançável pelo cliente.

### Negativas e custos
- O cálculo de hashes da CSP é código nosso e precisa de testes.
- `style-src 'unsafe-inline'` fica como risco residual aceito.

### Riscos e mitigação
- **Script inline novo quebrar a CSP:** teste E2E falha com qualquer violação de CSP no console.

## Validação

- F03-T4: testes de headers por tipo de rota; POST cross-origin rejeitado; o rate limit retorna 429; nenhuma violação de CSP nas páginas públicas.
- F12-T3: `/security-audit` completo sem achados altos ou críticos.

## Referências

- OWASP: CSRF Prevention, XSS Prevention, Secure Headers, File Upload Cheat Sheets
- [Rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- MDN: Content-Security-Policy (hash-source)
