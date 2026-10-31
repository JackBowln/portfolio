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

### Decisões da F03-T4 (owner, 2026-10-28)

- **CSP das páginas:**
  - calculada no hook `render:response` do Nitro (`server/plugins/csp.ts`), sobre o corpo final. Os scripts que executam (sem `src`, de tipo vazio, `module`, `importmap` ou JavaScript) recebem `sha256`; blocos de dados (`application/json`, `ld+json`) ficam de fora;
  - hoje são 4: tema, fontes, `window.__NUXT__.config` e o import map do Vite. Não há atributos `on*`, então não há `'unsafe-hashes'`;
  - ~~exceção temporária: o hash do script que a 404 padrão do Nuxt insere só no cliente (`CLIENT_ONLY_SCRIPT_HASHES`)~~. Removida na F01-T5: o `app/error.vue` próprio não usa script inline, e a política só lista os hashes do HTML servido;
  - o payload das páginas de erro 5xx leva só o texto genérico de status, nunca a mensagem da exceção (`app/plugins/redact-server-errors.server.ts`, F01-T5);
  - a CSP vai junto com o HTML no cache de borda, então hash e corpo não se separam. O custo é uma regex e alguns SHA-256, com memo por isolate;
  - o 404 e o 500 do Nuxt são renderizados numa sub-requisição sem bindings, cujos headers o handler de erro copia. Ali a origem vem do `runtimeConfig.public.siteUrl`, que tem o mesmo valor;
  - desligada em `nuxt dev`, por causa do cliente do Vite;
  - `upgrade-insecure-requests` só quando o `SITE_URL` é https, como o HSTS;
  - `img-src`/`media-src` levam a origem do `MEDIA_BASE_URL` quando ela difere da do site;
  - `frame-src https://www.youtube-nocookie.com https://player.vimeo.com` só nas páginas públicas, para a facade dos embeds (F05-T5); o admin não emoldura nada. Desde a F08-T3, só a página de contato (nos 5 idiomas) acrescenta `https://challenges.cloudflare.com` ao `script-src` e ao `frame-src`, para o Turnstile.
- **Fora das páginas:** toda resposta do Worker que não é página leva `default-src 'none'; frame-ancestors 'none'`. Os erros JSON do Nitro já vêm com `script-src 'none'; frame-ancestors 'none'`. Os assets estáticos, que não passam pelo Worker, ganham `nosniff` pelas `routeRules`, que o Nitro grava no `_headers`.
- **Origem (§2), mais amplo que o texto original:**
  - vale para toda mutação em `/api/**`, inclusive `/api/auth` e `/api/setup`, e não só para `admin` e `public`;
  - `Origin` igual ao do `SITE_URL` ou, sem `Origin`, `Sec-Fetch-Site: same-origin`; senão 403;
  - roda antes da sessão (`server/middleware/00.origin-check.ts`), então uma requisição cross-site não chega a ler a sessão.
- **Tipo e tamanho:**
  - JSON obrigatório em `/api/admin`, `/api/public` e `/api/setup` quando há corpo, ou seja, sempre que há `Content-Type` ou corpo. `/api/auth` fica com o Better Auth;
  - `Content-Length` acima de 1 MB → 413 em todo `/api/**`; os nossos handlers também medem os bytes reais (`readValidatedBodyStrict`).
- **Rate limit (§6):**
  - `RL_AUTH` com chave `IP + rota` nas mutações de `/api/auth/**`, no `GET /api/auth/callback/*` e no `POST /api/setup`. Leituras como `get-session` ficam livres;
  - `RL_ADMIN` por sessão, logo depois da autenticação;
  - 429 com `Retry-After: 60`, o período dos bindings;
  - binding ausente: não bloqueia e registra `rate_limit.binding_missing`, porque os 3 ambientes declaram os bindings;
  - o IP usado na chave fica só no contador da Cloudflare.
- **IP (§10):**
  - lido só de `CF-Connecting-IP`; `X-Forwarded-For` é ignorado;
  - gravado como HMAC-SHA256 em hex com `IP_HASH_SALT` (`server/utils/ip-hash.ts`). Sem a chave, `ip_hash` fica nulo: nunca há hash sem chave;
  - os eventos do Better Auth e do bootstrap passam o IP ao serviço de auditoria; os handlers do admin usam `auditRequest(event, …)`, que preenche o ator e o IP.

### Decisões da F04-T2 (owner, 2026-10-29)

- **WebAssembly só em Worker:** os codecs do pipeline de imagem rodam num Web Worker, cujo contexto segue a CSP da resposta do script dele, e não a da página. Por isso nenhuma página ganhou `'wasm-unsafe-eval'`: a do admin continua `script-src 'self'` + hashes.
- **CSP dos scripts em `/_nuxt/`** (`_headers`): `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'`. O navegador ignora CSP em script carregado por `<script>`, então ela só vale quando o script roda como Worker. Até aqui os assets estáticos não tinham CSP nenhuma, e um Worker podia buscar qualquer origem.

### Decisões da F04-T4 (owner, 2026-10-29)

- **`media-src … blob:` só em `/admin/**`:** o envio de vídeo lê dimensões e duração do arquivo escolhido por uma URL `blob:` antes de enviá-lo. Sem isso o navegador recusa o vídeo (erro 4). Libera só mídia local da própria página; `script-src` não muda, e as páginas públicas continuam com `media-src 'self'`.

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

- F02-T4 (2026-10-26): headers base (§1, sem CSP) em `server/plugins/security-headers.ts`, com HSTS só quando `ENVIRONMENT=production`; validação `strict` (§4) em `server/utils/validation.ts`, que também exige `application/json` e limita o body a 1 MB inclusive sem `Content-Length`; erro 500 genérico e logs JSON com `requestId` (§10). Coberto por `tests/api/server-infra.spec.ts`.
- F03-T4 (2026-10-28): `tests/unit/csp.test.ts` e `tests/unit/ip-hash.test.ts` (extração, hash conferido com `openssl`, montagem da política, HMAC); `tests/api/hardening.spec.ts` (hashes da CSP conferidos contra os scripts de cada página, CSP fora das páginas, `nosniff` nos assets, 403 cross-site, 415, 413, 429 com `Retry-After` no auth e no admin); `tests/e2e/csp.spec.ts` (nenhuma violação de CSP em 12 rotas públicas e do admin, desktop e mobile); `auth-flow` com o HMAC do IP no `audit_log`.
- F12-T3: `/security-audit` completo sem achados altos ou críticos.

## Referências

- OWASP: CSRF Prevention, XSS Prevention, Secure Headers, File Upload Cheat Sheets
- [Rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- MDN: Content-Security-Policy (hash-source)
