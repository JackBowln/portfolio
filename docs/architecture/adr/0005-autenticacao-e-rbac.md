# ADR-0005 — Autenticação (passkey + GitHub) e RBAC com Better Auth

- **Status:** Aceito (2026-10-25)
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0004, ADR-0012, [security-model](../security-model.md), RF-02, RF-03, RNF-06, RNF-07

## Contexto

- Hoje há um único administrador; o futuro prevê múltiplos usuários com permissões diferentes.
- O hash de senha (scrypt em JS no Better Auth) não cabe nos 10 ms de CPU do Free.
- Passkeys (WebAuthn) resistem a phishing, e a verificação de uma assinatura custa microssegundos (WebCrypto).
- O owner escolheu **passkey como método principal e GitHub OAuth restrito ao seu ID como recuperação**.
- Better Auth 1.7.13 tem adapter Drizzle, plugin `admin` com controle de acesso (`createAccessControl`), plugin `@better-auth/passkey` (SimpleWebAuthn 13), rate limit e cookie cache de sessão.

## Decisão

1. **Instância.** `createAuth(env)` em `server/utils/auth.ts`, criada por request (o binding do D1 só existe no request) e montada em `server/api/auth/[...all].ts` com `auth.handler(toWebRequest(event))`. O `baseURL` vem de `SITE_URL` e `trustedOrigins` = `[SITE_URL]`.
2. **Métodos de login.**
   - **Passkey** (`@better-auth/passkey`): `rpID` = host do ambiente e `origin` = `SITE_URL`. Cada ambiente tem suas próprias passkeys.
   - **GitHub OAuth** (`socialProviders.github`): só entram IDs numéricos da allowlist `OWNER_GITHUB_ID` (futuramente, IDs de convites). A rejeição acontece num hook de criação de usuário ou conta. Usado para recuperação e para registrar uma nova passkey.
   - `emailAndPassword` fica **desligado**. Não existe cadastro público.
3. **Bootstrap do owner.**
   - `/admin/setup` só responde quando não há nenhum usuário com papel `owner` **e** a requisição traz o `BOOTSTRAP_TOKEN` (segredo do ambiente).
   - O fluxo é: login GitHub (ID na allowlist) → papel `owner` → registro obrigatório de passkey.
   - Depois disso a rota devolve 404 e o segredo deve ser removido (`wrangler secret delete`, com pedido do owner).
4. **Sessão.**
   - Sessões no D1, em cookies `__Secure-`, `HttpOnly`, `Secure`, `SameSite=Lax`, com `path=/`.
   - Expiração em 7 dias, renovada a cada 24 h de uso.
   - `session.cookieCache` de 5 min evita uma leitura do D1 por request do admin.
   - Ações sensíveis exigem sessão "fresca" (≤ 15 min): mudar papéis, apagar conteúdo publicado, alterar orçamento de IA, remover passkey.
5. **RBAC.**
   - As permissões ficam em `shared/auth/permissions.ts` como statements `recurso: ações[]`:
     - `article`, `project`, `page`: `create`, `read`, `update`, `delete`, `publish`, `schedule`, `restore`
     - `media`: `create`, `read`, `update`, `delete`
     - `translation`: `run`, `review`, `approve`
     - `settings`: `read`, `update`
     - `user`: `invite`, `update-role`, `revoke-session`
     - `audit`: `read`
   - Papéis:

     | Papel | Permissões |
     |---|---|
     | `owner` | Tudo |
     | `admin` | Tudo, exceto transferir o papel de owner |
     | `editor` | Todo o conteúdo + publicar |
     | `author` | Criar e editar o próprio conteúdo, sem publicar |
     | `translator` | `translation:*` e leitura de conteúdo |
     | `viewer` | Só leitura no admin |

   - Os papéis são registrados no plugin `admin` do Better Auth.
6. **Autorização no servidor.**
   - Um middleware em `/api/admin/**` exige sessão (401).
   - Cada handler declara `requirePermission(event, { article: ['publish'] })` (403) e, para papéis restritos, `assertOwnership(resource, user)`.
   - A interface usa o mesmo mapa só para esconder ações, nunca como segurança.
   - Um teste de meta-cobertura falha se alguma rota do admin não declarar permissão ([ADR-0013](0013-testes-e-qualidade.md)).
7. **Rate limiting.** Binding nativo `RL_AUTH` nas rotas `/api/auth/*`: 10 requisições por 60 s por IP + rota. É aproximado por localidade e complementa os limites do Better Auth.
8. **Auditoria.** Login, falha de login, passkey adicionada ou removida, sessão revogada e mudança de papel vão para `audit_log`.
9. **Recuperação de último recurso.** Se a passkey e o GitHub forem perdidos, há um runbook em [backup-restore](../../operations/backup-restore.md#5-recuperação-de-acesso-ao-admin) com SQL via `wrangler d1 execute`, que exige acesso à conta Cloudflare.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| E-mail + senha + TOTP | O hash exige mais de 10 ms de CPU (Paid) ou um hash enfraquecido |
| Magic link por e-mail | O envio para destinatários arbitrários exige o Paid; adiciona dependência de entrega |
| Só passkeys | Sem um caminho de recuperação independente do dispositivo |
| Cloudflare Access na frente do `/admin` | Boa defesa em profundidade (grátis até 50 usuários), mas duplica a identidade e não substitui o RBAC da aplicação; fica como opção futura |
| Papéis no banco desde já | Complexidade sem uso imediato; os statements em código são tipados. Migrar para papéis dinâmicos via ADR quando houver múltiplos usuários |

## Consequências

### Positivas
- Nenhuma senha armazenada; login resistente a phishing; CPU de login desprezível.
- O RBAC fica pronto para múltiplos usuários sem mudar o modelo.

### Negativas e custos
- A recuperação depende do GitHub.
- Passkeys não migram entre ambientes (registrar em preview e em produção).
- Testes E2E exigem autenticador WebAuthn virtual (Chromium/CDP).

### Riscos e mitigação
- **Allowlist mal configurada aceitar terceiros:** teste de integração cobre a rejeição de IDs fora da lista; o `/security-audit` confere.
- **O bootstrap ficar aberto:** a rota exige ausência de owner **e** o token; teste automatizado garante 404 depois.

## Validação

- F03-T2: E2E de registro e login por passkey (autenticador virtual) e de login GitHub mockado; tentativa com ID fora da allowlist rejeitada; CPU de login medida (< 5 ms).
- F03-T3: matriz papel × rota 100% coberta.

## Referências

- [Better Auth + Nuxt](https://www.better-auth.com/docs/integrations/nuxt) (plugins admin e passkey)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
