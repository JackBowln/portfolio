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
     - `article`, `project`: `create`, `read`, `update`, `delete`, `publish`, `schedule`, `restore`
     - `page`: as mesmas, sem `create` (as chaves são fixas)
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

### Decisões da F03-T1 (owner, 2026-10-27)

- **IP:** `advanced.ipAddress.disableIpTracking: true`. Mesmo assim o Better Auth grava `''`, então um hook de sessão grava `NULL`. O hash de IP para auditoria e rate limit vem na F03-T4.
- **Tokens OAuth:** descartados. Hooks `account.create/update.before` zeram `accessToken`, `refreshToken`, `idToken` e as expirações; só o ID numérico da conta importa.
- **Instância:** `createAuth(env)` em `server/utils/auth.ts`, memorizada por isolate num `WeakMap` indexado pelo `env` do Worker (que carrega o binding do D1), em vez de ser reconstruída a cada request. As opções ficam puras em `server/services/auth/options.ts`.
- **Schema:** escrito à mão em `server/db/schema/auth.ts` (o `@better-auth/cli` está na 1.4 e traz `prisma`, `pg` e `better-sqlite3`). `tests/unit/auth-schema.test.ts` compara as colunas com o `getAuthTables()` do Better Auth (com o plugin `admin`). Os campos do `admin` (`role`, padrão `viewer`, e `ban*`) já existem; o plugin foi ativado na F03-T3. IDs em UUIDv7.
- **Cookies:** `HttpOnly`, `SameSite=Lax`, `Path=/`; `Secure` + `__Secure-` quando a `SITE_URL` é `https`. `session_token` com 7 dias; `session_data` (cookie cache, estratégia `compact`, assinado) com 5 min.
- **Secret:** `BETTER_AUTH_SECRET` (≥ 32 caracteres) é obrigatório fora de `ENVIRONMENT=local`, onde a falta gera um secret aleatório por isolate, com aviso no log.
- **Telemetria** desligada; `emailAndPassword` desligado (`*_DISABLED` nas rotas de senha, testado); `delete-user` fica indisponível (404).
- **Exceção registrada:** o input de `/api/auth/*` é validado pelos schemas do próprio Better Auth, não pelos nossos helpers `strict`.

### Decisões da F03-T3 (owner, 2026-10-27)

- **Fonte única:** `shared/auth/permissions.ts` traz os statements e, por papel, o escopo de cada ação: `any`, `own` (🟡) ou `own-draft` (🟡 rascunho). São dados puros, sem importar o better-auth. O `server/services/auth/access.ts` monta deles o `createAccessControl` e os papéis do plugin `admin` (`defaultRole: 'viewer'`, `adminRoles: ['owner', 'admin']`).
- **API HTTP do plugin `admin` desligada:** os 15 endpoints de `/api/auth/admin/*` (incluindo `create-user` com senha, `set-user-password` e `impersonate-user`) estão em `disabledPaths` e respondem 404. Usuários e sessões passam a ser geridos por rotas próprias em `/api/admin/**` (F03-T5), sob `defineAdminHandler` e o meta-teste.
- **`media:read`:** liberado para todos os papéis, como a leitura de conteúdo; a linha foi acrescentada à matriz do security-model.
- **`admin` (exceto owner):** `canManageUser(actor, target, newRole?)` impede um admin de agir sobre um owner ou de conceder `owner`. As rotas de usuários da F03-T5 devem chamá-la.
- **Sessão fresca:** `defineAdminHandler({ permission, fresh: true, handler })` responde 403 `session_not_fresh` quando a sessão tem mais de 15 min (`freshAge`), contados do `createdAt`.
- **Camadas:**
  - `server/middleware/admin-session.ts` autentica `/api/admin/**` (401) e põe `{ user, session }` em `event.context.auth`; os cookies renovados pelo `getSession` voltam ao navegador.
  - `defineAdminHandler` refaz o 401 (defesa em profundidade), checa a permissão (403) e expõe `permission` e `fresh` no handler.
  - `requirePermission(event, permission)` serve para permissões decididas no handler; `assertOwnership(event, permission, item)` serve para os escopos `own` e `own-draft`.
  - Papel desconhecido ou vazio não recebe nada; a resolução só considera chaves próprias (sem `__proto__`, `constructor` etc.).
- **Atraso do cookie cache:** o papel lido vem do `session_data` assinado, então uma mudança de papel ou uma revogação leva até 5 min para valer. A F03-T5 decide se essas ações também invalidam o cache.

## Validação

- F03-T2: E2E de registro e login por passkey (autenticador virtual) e de login GitHub mockado; tentativa com ID fora da allowlist rejeitada; CPU de login medida (< 5 ms).
- F03-T1: `tests/unit/auth-{options,schema}.test.ts`, `tests/workers/auth-schema.test.ts` e `tests/api/auth.spec.ts` (sem cadastro, flags do cookie numa sessão criada pela rota de teste `TEST_AUTH`, CSRF de outra origem → 403 conferido no `/security-audit`).
- F03-T3:
  - `tests/unit/permissions.test.ts` lê a tabela do security-model §4 e a compara célula por célula com o `permissions.ts` e com os papéis do Better Auth;
  - `tests/unit/admin-routes-meta.test.ts` analisa cada arquivo de `server/api/admin/**` com o parser do TypeScript, inclusive com casos negativos;
  - `tests/api/authz-matrix.spec.ts` cobre 6 papéis × 34 permissões gerados do código, além de 401 (sem sessão, cookie adulterado, variações de caminho), ownership, sessão fresca, plugin `admin` → 404 e `role` não editável pelo próprio usuário.

## Referências

- [Better Auth + Nuxt](https://www.better-auth.com/docs/integrations/nuxt) (plugins admin e passkey)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
