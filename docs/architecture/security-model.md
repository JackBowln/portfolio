# Modelo de segurança

Complementa o [ADR-0005](adr/0005-autenticacao-e-rbac.md) (auth e RBAC) e o [ADR-0012](adr/0012-seguranca.md) (controles). A skill `/security-audit` usa este documento como referência.

## 1. Ativos

| Ativo | Por que importa |
|---|---|
| Sessões e credenciais do admin (passkeys, conta GitHub vinculada) | Controle total do site |
| Conteúdo não publicado (rascunhos, agendados) | Confidencialidade editorial |
| Integridade do conteúdo publicado e das configurações | Reputação profissional |
| Mensagens de contato (nome, e-mail, texto) | Dados pessoais (LGPD/GDPR) |
| Segredos (`BETTER_AUTH_SECRET`, `PREVIEW_TOKEN_SECRET`, OAuth, `IP_HASH_SALT`…) | Comprometem sessões, preview e privacidade |
| Cota gratuita (requisições, neurons de IA, D1, R2) | Abuso gera indisponibilidade ou custo |
| Histórico (revisões, auditoria, backups) | Recuperação e responsabilização |

## 2. Superfícies de ataque

| Superfície | Exposição | Controles principais |
|---|---|---|
| Páginas públicas (SSR/cache) | Anônima | Sem `v-html`, renderer com allowlist, CSP por hash (`server/plugins/csp.ts`), sem cookies, headers de segurança |
| `/api/public/contact` | Anônima | Turnstile validado no servidor (com o hostname do site fora do local), `RL_PUBLIC` por IP antes de ler o corpo, zod `strict` com 422 só de códigos, honeypot, limite de tamanho, checagem de origem, sem reflexo de entrada, sem `Set-Cookie`; o IP só como HMAC (F08-T3) |
| `/api/auth/*` | Anônima | Checagem de origem (middleware + Better Auth), `RL_AUTH` por IP + rota nas mutações e no callback OAuth, allowlist do GitHub, sem cadastro público, auditoria com hash de IP |
| `/admin/setup` (bootstrap) | Anônima até existir owner | Exige ausência de owner **e** `BOOTSTRAP_TOKEN`; 404 depois; origem + JSON + `RL_AUTH` em `POST /api/setup` |
| `/api/admin/*` | Autenticada | Origem + JSON + 1 MB (antes da sessão), sessão obrigatória, `RL_ADMIN` por sessão, `requirePermission`, propriedade, zod, auditoria (`auditRequest`) |
| Upload de mídia | Autenticada | Magic bytes, allowlist de MIME, limites, chaves geradas pelo servidor, SVG bloqueado, `nosniff`; desde a F04-T1: marcação (HTML, SVG, XML, PHP) recusada nos primeiros 64 KB, `Content-Length` igual ao declarado no manifesto, só quem criou o item envia arquivos e finaliza, rejeições auditadas |
| Entrega de mídia (`/media/**` em local e preview; domínio do bucket em produção) | Anônima | Só chaves de arquivos entregues (variantes, vídeo, legendas) passam pelo padrão; `originals/` não tem URL (em produção, regra de WAF); `Content-Type` gravado pelo servidor no upload; `nosniff`, `inline`, CSP `default-src 'none'`; cache `immutable`; sem `Set-Cookie` (F04-T3) |
| Editor e conteúdo (embeds, links, código) | Autenticada → público | Schema estrito, protocolos de URL, allowlist de embeds, HAST com allowlist |
| `/preview/{token}` | Quem tiver o link | HMAC comparado em tempo constante, expiração ≤ 24 h, 404 único para qualquer falha, `noindex`, `private, no-store`, sem `Cache-Tag`; gerar exige `article:update` e é auditado (F06-T3) |
| Cron e tarefas | Interna | Sem entrada externa; idempotente; poucos itens por execução |
| Tradução por IA | Saída do provedor | Saída tratada como dado: schema, tags inline validadas, nada executado |
| CI/CD e repositório | Desenvolvedores | Token Cloudflare com escopo mínimo, secrets do GitHub, sem segredos no repositório, deploy só manual |

## 3. Ameaças (STRIDE resumido)

| Categoria | Ameaça | Mitigação |
|---|---|---|
| **S**poofing | Roubo de sessão; login por conta GitHub alheia | Cookies `HttpOnly/Secure/SameSite=Lax`; allowlist por ID numérico; passkey resistente a phishing |
| **T**ampering | Alterar conteúdo via CSRF; payload malicioso no documento | Origem + JSON + SameSite; schema estrito; revisões imutáveis |
| **R**epudiation | Ação administrativa sem rastro | `audit_log` em toda mutação, com ator, ação, entidade e hash de IP; o autosave de conteúdo é registrado pela própria revisão (autor e hora), não pelo `audit_log` (F06-T2) |
| **I**nformation disclosure | Vazamento de rascunho, segredo ou stack trace | Público lê só snapshots publicados; erros genéricos; segredos fora do cliente; logs sem PII |
| **D**enial of service | Abuso do formulário, do login ou de traduções esgotando cotas | Rate limits, Turnstile, guarda de custo de IA, cache de borda |
| **E**levation of privilege | Papel `author` publicando; rota admin sem checagem | `requirePermission` por handler + meta-teste de cobertura; checagem de propriedade |

## 4. Matriz de autorização (padrão)

✅ = permitido · 🟡 = só o próprio conteúdo · — = negado

| Permissão | owner | admin | editor | author | translator | viewer |
|---|---|---|---|---|---|---|
| `article/project/page:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `article/project:create` | ✅ | ✅ | ✅ | ✅ | — | — |
| `article/project/page:update` | ✅ | ✅ | ✅ | 🟡 | — | — |
| `article/project/page:delete` | ✅ | ✅ | ✅ | 🟡 (rascunho) | — | — |
| `article/project/page:publish`, `:schedule` | ✅ | ✅ | ✅ | — | — | — |
| `article/project/page:restore` | ✅ | ✅ | ✅ | 🟡 | — | — |
| `tag:create` | ✅ | ✅ | ✅ | ✅ | — | — |
| `tag:update/delete` | ✅ | ✅ | ✅ | — | — | — |
| `media:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `media:create/update` | ✅ | ✅ | ✅ | ✅ | — | — |
| `media:delete` | ✅ | ✅ | ✅ | 🟡 | — | — |
| `translation:run` | ✅ | ✅ | ✅ | — | ✅ | — |
| `translation:review` / `:approve` | ✅ | ✅ | ✅ | — | ✅ | — |
| `settings:read` | ✅ | ✅ | ✅ | — | — | ✅ |
| `settings:update` | ✅ | ✅ | — | — | — | — |
| `user:invite`, `:update-role`, `:revoke-session` | ✅ | ✅ (exceto owner) | — | — | — | — |
| `audit:read` | ✅ | ✅ | — | — | — | — |
| `contact:read`, `:update`, `:delete` | ✅ | ✅ | — | — | — | — |
| `session:read`, `:revoke` | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |

A tabela é a especificação de `shared/auth/permissions.ts`: o `tests/unit/permissions.test.ts` lê esta tabela e a compara célula por célula com o código, e o `tests/api/authz-matrix.spec.ts` gera os casos de API a partir do código. Mantenha o formato (permissões entre crases, `✅`, `🟡`, `🟡 (rascunho)`, `—`).

- **Páginas** não têm `create`: as chaves são fixas (`PAGE_KEYS`). Desde a F08-T2, ler exige `page:read`; editar e salvar versão, `page:update`; restaurar, `page:restore`; publicar e despublicar, `page:publish`. Uma página não tem autor (`authorId: null`), então `author` nunca a edita. Os blocos passam por schemas `strict`. Os links do sobre só aceitam `https:`, e os botões da home só apontam para páginas do site (`PAGE_LINK_TARGETS`). Sobre e privacidade usam o documento validado pelo renderer, e a rota pública devolve só o snapshot publicado.
- **Temas e tecnologias** (`tag`, F06-T1, F07-T1): ler segue `article:read`; o `author` cria temas e tecnologias para marcar o próprio artigo ou projeto, mas renomear e excluir afetam todos os itens que os usam, por isso ficam com `editor` para cima.
- **Tradução por IA** (F09-T3):
  - **Permissões:** estimar e executar exigem `translation:run`; o job e o uso, `translation:review`.
  - **Execução:** exige `confirm: true` numa estimativa recente, e o guarda de custo roda no servidor antes de cada chamada.
  - **Payload:** só campos de conteúdo (sem contato, usuário ou configurações); a saída do modelo é validada como dado.
  - **Erros:** os jobs guardam um código, nunca a resposta do provedor.
  - **Provedor fake:** só com `TRANSLATION_PROVIDER=fake` e `ENVIRONMENT=local` (o build de teste); em preview ou produção é recusado.
- **Glossário** (F09-T2): ler exige `translation:review`; criar, editar e excluir exigem `translation:approve`, porque mudam o que toda tradução seguinte envia e pede. Entrada `strict`; a auditoria (`glossary.*`) guarda só o id.
- **Estados de tradução** (F09-T1): o resumo do dashboard (`GET /api/admin/translations/summary`) exige `translation:review`. A aprovação de textos de mídia segue `translation:approve`, decidida no servidor pelo papel. O site nunca mostra uma tradução que não esteja `approved`.
- **Mensagens de contato** (F08-T3): `contact:read`, `contact:update` e `contact:delete` só para owner e admin, porque são dados pessoais. A lista e a mensagem nunca devolvem o `ip_hash`. Excluir apaga de vez, e a auditoria (`contact.status_changed`, `contact.deleted`) guarda só o id e o estado. A notificação vai só ao endereço verificado (binding `send_email` com `destination_address`), com o assunto em uma linha (sem injeção de cabeçalho).
- **Configurações** (F08-T1): ler é `settings:read`; salvar é `settings:update` (owner e admin), por chave e com a versão lida. `ai_translation` decide o que o site gasta, então também exige sessão fresca (`requireFreshSession`, 15 min), tem `provider` fixo em `workers-ai` e teto diário ≤ 10.000 neurônios, e nunca sai na rota pública. A auditoria `settings.updated` guarda chave, versão e idiomas, nunca os valores.
- **Projetos** (F07-T1): o autor de um projeto é quem o criou (`created_by`), para os escopos 🟡. A ordem manual (`PUT /api/admin/projects/order`) muda a posição de projetos de outras pessoas no site, por isso exige `project:publish`.
- **`media:delete` 🟡:** o author apaga só o que enviou (`created_by`); mídia em uso responde 409 para qualquer papel. Enviar arquivos e finalizar um item `pending` cabe só a quem o criou.
- **`session`:** cada pessoa lista e revoga só as próprias sessões, inclusive o owner. As sessões de outros usuários são `user:revoke-session`.
- **`admin` (exceto owner):** não age sobre um owner nem concede o papel `owner` (`canManageUser`).

## 5. Controles por camada (checklist resumido)

- **Transporte:** HTTPS só (HSTS em produção), `upgrade-insecure-requests`.
- **Sessão:** prefixo `__Secure-`, `HttpOnly`, `Secure`, `SameSite=Lax`, expiração de 7 dias, sessão fresca para ações sensíveis, revogação.
- **Entrada:** zod `strict` em body, query e params; limites de tamanho; normalização de slug e URLs.
- **Saída:** Vue escapa; nenhum `v-html`; JSON-LD serializado com escape de `</script>`.
- **Armazenamento:** Drizzle parametrizado; nada de `sql.raw` com entrada; IP como HMAC; tokens OAuth descartados ou criptografados.
- **Navegador:** CSP por hash; `frame-ancestors 'none'`; `Permissions-Policy` restritiva; COOP.
- **Operação:** segredos via `wrangler secret`; `pnpm audit`; Dependabot; deploy manual; auditoria. Risco aceito (31/10/2026, F08-T2): o `pnpm audit --audit-level high` acusa o `node-forge` ≤ 1.4.0 via `nuxt > @nuxt/nitro-server > nitropack > listhen`, que só serve o `nuxt dev`. Ele não entra no bundle do Worker; reavaliar a cada atualização do Nuxt e remover a exceção quando o `listhen` trouxer o `node-forge` ≥ 1.4.1.

## 6. Privacidade

- **Dados pessoais tratados:** mensagens de contato (12 meses), sessões do admin, `audit_log` (12 meses) e logs da plataforma (3 dias no Free).
- **Sem rastreamento:** nenhum cookie fora do admin; sem analytics por padrão (Q-08 no PRD).
- **Terceiros:** Turnstile só na página de contato; embeds com facade e domínios sem cookie (`youtube-nocookie`); fontes self-hosted.
- **Página de privacidade:** descreve finalidade, base legal, retenção, direitos e contato do responsável. O texto é escrito pelo owner, e o Claude Code pode propor uma estrutura.

## 7. Resposta a incidentes (resumo)

1. Revogar todas as sessões (Better Auth) e rotacionar `BETTER_AUTH_SECRET`, com pedido do owner.
2. Desabilitar rotas afetadas por flag ou fazer rollback de versão.
3. Avaliar a integridade pelas revisões e pela auditoria; restaurar pelo Time Travel ou export, se necessário.
4. Registrar um post-mortem em `docs/operations/` com causa e ação preventiva.
