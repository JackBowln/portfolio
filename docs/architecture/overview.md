# Arquitetura — visão geral

Monólito Nuxt 4 em um único Worker da Cloudflare: o site público é renderizado no servidor e servido do cache de borda, o admin é uma SPA protegida e todos os dados ficam em D1 (relacional) e R2 (mídia). As decisões estão nos [ADRs](adr/); este documento mostra como as peças se encaixam.

## 1. Contexto (C4 nível 1)

```mermaid
flowchart LR
  visitor([Visitante / leitor])
  owner([Owner e futuros editores])
  site[[Portfólio + blog + CMS]]
  github[(GitHub OAuth)]
  ai[(Workers AI)]
  turnstile[(Cloudflare Turnstile)]
  mail[(Email Routing)]
  search([Buscadores e redes sociais])

  visitor -- lê, navega, envia contato --> site
  owner -- escreve, publica, revisa traduções --> site
  search -- rastreia HTML, sitemap, OG --> site
  site -- recuperação de login --> github
  site -- rascunhos de tradução --> ai
  site -- valida formulário --> turnstile
  site -- notifica novo contato --> mail
```

## 2. Containers (C4 nível 2)

```mermaid
flowchart TB
  subgraph Edge[Cloudflare edge]
    assets[Static Assets<br/>/_nuxt, fontes, ícones]
    wcache[Workers Cache<br/>HTML público com Cache-Tag]
    subgraph Worker[Worker: Nuxt 4 / Nitro cloudflare_module]
      ssr[SSR das páginas públicas]
      papi[/api/public: contato/]
      auth[/api/auth: Better Auth/]
      aapi[/api/admin: RBAC + zod + auditoria/]
      feeds[sitemap, RSS, robots, redirects]
      cron[Cron */5: agendamentos e limpeza]
    end
    d1[(D1: conteúdo, auth, revisões, traduções, auditoria)]
    r2[(R2: mídia e variantes)]
    rl[Rate Limiting binding]
    wai[Workers AI binding]
  end
  browser[Navegador do visitante]
  admin[Navegador do admin<br/>SPA /admin, Tiptap, codecs WASM, Shiki, OG canvas]

  browser --> assets
  browser --> wcache --> ssr
  browser --> papi
  admin --> auth
  admin --> aapi
  ssr --> d1
  aapi --> d1
  aapi --> r2
  aapi --> wai
  auth --> d1
  papi --> rl
  auth --> rl
  cron --> d1
  browser -- mídia imutável --> r2
```

## 3. Estrutura do repositório (criada na F00)

```
app/                    # Vue: páginas, componentes, composables (SSR + cliente)
  components/
    ui/                 # primitivos do design system (público)
    layout/             # header, footer, navegação, seletor de idioma
    content/            # renderer do documento (sem Tiptap)
    media/              # ResponsiveImage, Video, Gallery
    motion/             # componentes client-only de animação
    admin/              # SOMENTE admin (proibido importar no público)
  composables/          # usePageSeo, useMotion, ... (admin/ para os do admin)
  layouts/              # default, reading, admin
  middleware/           # admin-auth (UX; a segurança real é no servidor)
  pages/                # rotas públicas + admin/**
  assets/css/main.css   # Tailwind 4 + tokens (@theme)
i18n/locales/           # mensagens de UI: pt-BR, en, es, de, fr
server/
  api/                  # handlers finos: validar → autorizar → serviço → resposta
    public/  auth/  admin/
  routes/               # rss.xml, robots.txt, sitemap source, media proxy (preview)
  middleware/           # sessão do admin, origem/CSRF, redirects, headers
  plugins/              # CSP por hash, Cache-Tag, logging
  tasks/                # tarefas agendadas (Nitro tasks)
  services/<domínio>/   # regras de negócio (*.service.ts) e queries (*.repo.ts)
  db/schema/  db/migrations/  db/seed/
  utils/                # useDb, requirePermission, validação, cache, auditoria
shared/                 # isomórfico: tipos, schemas zod, permissões, locales, design tokens TS
tests/                  # unit/, nuxt/, workers/, api/, e2e/, a11y/
scripts/                # checagem de orçamento de JS, chaves de i18n
```

Regras de dependência entre pastas: [architecture-guardian/references/boundaries.md](../../.claude/skills/architecture-guardian/references/boundaries.md).

## 4. Renderização e cache por rota

| Rota | Modo | Cache | Observações |
|---|---|---|---|
| Páginas públicas (`/`, `/sobre`, listas, detalhes, em todos os idiomas) | SSR | Workers Cache: `Cache-Control` para cache compartilhado longo e navegador curto + `Cache-Tag` (valores finais no F00-T6) | Nunca emitem `Set-Cookie`. Conteúdo completo sem JS |
| `/_nuxt/**`, fontes | Static Assets | `public, max-age=31536000, immutable` | Nomes com hash |
| Mídia (`media.<domínio>` em produção; `/media/**` em preview/local) | R2 | `public, max-age=31536000, immutable` | Chaves endereçadas por conteúdo |
| `/sitemap.xml`, `/rss.xml`, `/robots.txt` | Worker | Como páginas públicas, com tags `sitemap`, `rss:{locale}` | `robots` muda por ambiente |
| `/api/public/**` | Worker | `no-store` | Turnstile + rate limit |
| `/api/auth/**` | Worker (Better Auth) | `no-store` | Rate limit |
| `/api/admin/**` | Worker | `private, no-store` | Sessão + permissão + zod + auditoria |
| `/admin/**` | SPA (`ssr: false`) | `private, no-store`, `X-Robots-Tag: noindex` | Bundle separado do público |
| `/preview/{token}` | SSR | `private, no-store`, `noindex` | Token HMAC de curta duração |

## 5. Fluxos principais

### 5.1 Leitura pública

```mermaid
sequenceDiagram
  participant B as Navegador
  participant C as Workers Cache
  participant W as Worker (SSR)
  participant D as D1
  B->>C: GET /de/blog/artikel
  alt hit
    C-->>B: HTML (sem executar o Worker)
  else miss
    C->>W: encaminha
    W->>D: localização publicada (locale + slug)
    D-->>W: snapshot da revisão publicada
    W-->>C: HTML + Cache-Control + Cache-Tag(article:id, article:id:de, ...)
    C-->>B: HTML
  end
```

### 5.2 Publicação e invalidação

```mermaid
sequenceDiagram
  participant A as Admin (SPA)
  participant W as /api/admin
  participant D as D1
  participant C as Workers Cache
  A->>W: POST /articles/:id/publish {locale, revision}
  W->>W: sessão → requirePermission(article:publish) → zod
  W->>D: batch: revisão "publish" + ponteiro publicado + redirect (se slug mudou) + audit_log
  W->>C: purge({ tags: [article:id:locale, list:blog:locale, sitemap, rss:locale] })
  W-->>A: 200 {publishedRevisionId}
```

### 5.3 Upload de mídia

```mermaid
sequenceDiagram
  participant A as Admin (Web Worker WASM)
  participant W as /api/admin/media
  participant R as R2
  participant D as D1
  A->>A: decodifica, redimensiona, AVIF/WebP/JPEG, remove EXIF, ThumbHash, SHA-256
  A->>W: POST /media {sha256, mime, dimensões, variantes previstas}
  W->>D: cria registro "pending"
  loop cada variante
    A->>W: PUT /media/:id/variants/:name (stream)
    W->>W: valida tipo, magic bytes, tamanho
    W->>R: put(chave por hash)
  end
  A->>W: POST /media/:id/finalize
  W->>D: status "ready" + audit_log
```

### 5.4 Tradução assistida

```mermaid
sequenceDiagram
  participant A as Admin
  participant W as /api/admin/translations
  participant AI as Workers AI
  participant D as D1
  A->>W: POST estimate {entity, locale}
  W->>D: segmentos alterados + uso do dia/mês
  W-->>A: estimativa (tokens, neurons, US$) e saldo
  A->>W: POST run (confirmação explícita)
  loop lotes de segmentos
    W->>AI: run(model, segmentos + glossário)
    AI-->>W: segmentos traduzidos
    W->>W: valida tags inline e contagem
    W->>D: grava rascunho "machine" + translation_jobs
  end
  A->>A: revisão lado a lado → aprovar → publicar idioma
```

### 5.5 Login

Passkey: `navigator.credentials.get` → Better Auth verifica a assinatura (WebCrypto, CPU baixa) → sessão em D1 com cookie `HttpOnly; Secure; SameSite=Lax`. GitHub OAuth: só IDs na allowlist (`OWNER_GITHUB_ID`) conseguem entrar; serve como recuperação para registrar uma nova passkey.

## 6. Bindings, variáveis e segredos (nomes)

| Tipo | Nome | Uso |
|---|---|---|
| D1 | `DB` | Banco por ambiente (`portfolio-preview`, `portfolio-production`) |
| R2 | `MEDIA` | Mídia por ambiente |
| R2 | `BACKUPS` | Exports semanais do D1 (só produção) |
| Workers AI | `AI` | Tradução |
| Rate limit | `RL_AUTH`, `RL_PUBLIC`, `RL_ADMIN` | Limites por IP/sessão |
| Email | `CONTACT_EMAIL` | `send_email` para o endereço verificado |
| Var | `ENVIRONMENT`, `SITE_URL`, `MEDIA_BASE_URL` | Configuração por ambiente |
| Var pública | `TURNSTILE_SITE_KEY` | Widget do contato |
| Segredo | `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OWNER_GITHUB_ID`, `BOOTSTRAP_TOKEN`, `PREVIEW_TOKEN_SECRET`, `IP_HASH_SALT`, `TURNSTILE_SECRET_KEY` | Nunca no cliente, nunca em log |
| Segredo (só se usar o fallback de cache) | `CF_API_TOKEN_PURGE` | Purge por tag via API |
| Segredo (futuro, com aprovação) | `ANTHROPIC_API_KEY` | Provedor Claude |

Detalhes por ambiente: [operations/environments.md](../operations/environments.md).

## 7. Decisões

| ADR | Tema |
|---|---|
| [0002](adr/0002-plataforma-e-toolchain.md) | Plataforma e toolchain |
| [0003](adr/0003-renderizacao-cache-e-cpu.md) | Renderização, cache e orçamento de CPU |
| [0004](adr/0004-dados-d1-drizzle.md) | Dados: D1 + Drizzle |
| [0005](adr/0005-autenticacao-e-rbac.md) | Autenticação e RBAC |
| [0006](adr/0006-conteudo-e-editor.md) | Conteúdo e editor |
| [0007](adr/0007-midia.md) | Mídia |
| [0008](adr/0008-i18n-e-seo.md) | i18n e SEO |
| [0009](adr/0009-traducao-assistida-por-ia.md) | Tradução assistida por IA |
| [0010](adr/0010-design-system.md) | Design system |
| [0011](adr/0011-motion.md) | Motion |
| [0012](adr/0012-seguranca.md) | Segurança |
| [0013](adr/0013-testes-e-qualidade.md) | Testes e qualidade |
| [0014](adr/0014-operacao.md) | Operação |
