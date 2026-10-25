# F02 — Dados, i18n e SEO base

**Objetivo da fase:** a base de dados com Drizzle e D1, o i18n nos 5 idiomas com rotas traduzidas, o head SEO correto por idioma e as utilidades de servidor (validação, erros, cache e headers).

**Pré-requisitos:** o gate da F00 cumprido. Pode rodar em paralelo com a F01 (exceto F01-T5, que espera a F02-T2).

**Leitura obrigatória:** [ADR-0004](../architecture/adr/0004-dados-d1-drizzle.md), [ADR-0008](../architecture/adr/0008-i18n-e-seo.md), [data-model](../architecture/data-model.md), [i18n-seo](../architecture/i18n-seo.md), [ADR-0003](../architecture/adr/0003-renderizacao-cache-e-cpu.md).

**Gate de saída:** as rotas da tabela de i18n respondendo nos 5 idiomas com canonical, hreflang e robots corretos; a migração inicial aplicada localmente; nenhuma resposta pública com `Set-Cookie`.

---

### F02-T1 — D1 + Drizzle: conexão, convenções e primeira migração

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F00-T3, F00-T4 | RF-08, RNF-09 | `/architecture-guardian`, `/test-engineer` |

**Objetivo.** Instalar `drizzle-orm ~0.45` e `drizzle-kit ~0.31` e criar:
- `useDb(event)`;
- utilitários de ID (UUIDv7) e de timestamp;
- os enums compartilhados;
- as tabelas `site_settings`, `site_setting_localizations`, `redirects` e `audit_log`, com a migração `0000` e os scripts.

**Arquivos prováveis.** `drizzle.config.ts`, `server/db/schema/{settings,system}.ts`, `server/db/migrations/0000_*.sql`, `server/utils/db.ts`, `shared/utils/id.ts`, `shared/types/enums.ts`, `server/db/seed/dev.ts`, `package.json` (`db:generate`, `db:migrate:local`, `db:seed`).

**Fora do escopo.** Tabelas de conteúdo (F05-T1), de auth (F03-T1) e de mídia (F04-T1).

**Critérios de aceite**
- [ ] `pnpm db:generate` gera SQL determinístico; `pnpm db:migrate:local` aplica a migração; FKs ativas confirmadas (`PRAGMA foreign_keys`).
- [ ] Convenções do ADR-0004 aplicadas: snake_case, UUIDv7, timestamps em ms, JSON com zod na leitura e na escrita.
- [ ] Os serviços recebem `db` por parâmetro; os handlers não importam o schema (regra de lint ou revisão do guardian).
- [ ] O seed de dev só cria registros `[PLACEHOLDER]` e se recusa a rodar fora de `ENVIRONMENT=local`.

**Testes**
- Unit: o UUIDv7 é ordenável e único em lote; o (de)serializador JSON com zod rejeita formato inválido.
- Workers: gravar e ler `site_settings`; `db.batch` atômico (uma falha no meio desfaz tudo).

---

### F02-T2 — i18n: 5 idiomas, rotas traduzidas e seletor de idioma

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F00-T4 | RF-10.1, RF-10.2, RF-10.3, RF-10.5, RF-12.1 | `/i18n-manager` |

**Objetivo.** Configurar o `@nuxtjs/i18n ~10.6` conforme o ADR-0008 e criar:
- as mensagens base;
- o link localizado e o seletor de idioma (`SwitchLocalePathLink`);
- as páginas-esqueleto `[PLACEHOLDER]` de todas as rotas da tabela, com `noindex` até a fase própria;
- o script `check:i18n`.

**Arquivos prováveis.** `nuxt.config.ts` (i18n), `i18n/locales/{pt-BR,en,es,de,fr}.json`, `app/components/ui/LocalizedLink.vue`, `app/components/layout/LanguageSwitcher.vue`, `app/pages/{index,sobre,contato,privacidade}.vue`, `app/pages/projetos/{index,[slug]}.vue`, `app/pages/blog/{index,[slug]}.vue`, `app/pages/blog/temas/[slug].vue`, `scripts/check-i18n.mjs`.

**Fora do escopo.** Head SEO completo (T3); conteúdo real das páginas.

**Critérios de aceite**
- [ ] Todas as rotas da tabela do [i18n-seo](../architecture/i18n-seo.md) (§2) respondem 200 nos 5 idiomas; `/admin/**` e `/preview/**` não são localizados.
- [ ] `detectBrowserLanguage: false`: nenhum redirect por idioma e **nenhum `Set-Cookie`** nas respostas públicas.
- [ ] O seletor de idioma usa nomes no próprio idioma, com o atributo `lang`, e é operável por teclado.
- [ ] `pnpm check:i18n` passa; remover uma chave de um idioma faz o script falhar (demonstrado).
- [ ] Datas formatadas via `Intl` com o locale ativo (exemplo na página-esqueleto).

**Testes**
- API: 200 em cada rota × idioma; ausência de `Set-Cookie`.
- E2E: o seletor leva à rota equivalente em cada idioma.
- Unit: lógica do `check:i18n` com fixtures.

---

### F02-T3 — SEO base: `usePageSeo`, robots por ambiente, sitemap e JSON-LD inicial

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F02-T2 | RF-12.2, RF-12.3, RF-12.4, RF-12.5, RF-12.7, RNF-04 | `/i18n-manager`, `/performance-audit` |

**Objetivo.** Criar:
- o composable `usePageSeo` (title com modelo, description, canonical, `og:*`/`twitter:*` com `og:locale`, hreflang só dos alternates informados, `x-default`);
- o `robots.txt` por ambiente com `X-Robots-Tag` fora de produção;
- o sitemap base (módulo `@nuxtjs/sitemap` ou endpoint próprio, decidido e registrado no ADR-0008);
- os helpers de JSON-LD `WebSite` e `Person`.

**Arquivos prováveis.** `app/composables/usePageSeo.ts`, `server/routes/robots.txt.ts`, `server/plugins/robots-header.ts`, `nuxt.config.ts` (sitemap), `server/api/__sitemap__/urls.get.ts`, `shared/seo/jsonld.ts`.

**Fora do escopo.** Sitemap com conteúdo dinâmico real (F11-T3) e JSON-LD completo (F11-T1).

**Critérios de aceite**
- [ ] Head correto em cada página-esqueleto e idioma: canonical absoluto para a própria página; hreflang recíproco e `x-default` conforme a regra.
- [ ] Em produção, `robots.txt` bloqueia `/admin`, `/api` e `/preview` e aponta para o sitemap. Fora de produção, `Disallow: /` e `X-Robots-Tag: noindex, nofollow` em todas as respostas.
- [ ] O sitemap é XML válido, com URLs absolutas e alternates.
- [ ] Lighthouse SEO = 100 em 2 páginas-esqueleto (relatório anexado).

**Testes**
- Nuxt: `usePageSeo` com e sem alternates; regra do `x-default`.
- API: `robots.txt` e `X-Robots-Tag` por ambiente; sitemap válido.

---

### F02-T4 — Infra do servidor: validação, erros, logs, cache e headers base

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F02-T1 | RNF-05, RNF-06, RNF-09 | `/architecture-guardian`, `/security-audit` |

**Objetivo.** Criar:
- os helpers de validação com zod (body, query e params `strict`);
- o tratamento de erros (genérico em produção) e os logs JSON com `requestId`;
- as políticas de cache por tipo de rota e `setCacheTags(event, tags)`;
- a abstração de purge (`server/utils/cache.ts`, conforme o resultado do F00-T6);
- o plugin de headers de segurança base (sem a CSP, que entra na F03-T4).

**Arquivos prováveis.** `server/utils/validation.ts`, `server/utils/errors.ts`, `server/utils/logger.ts`, `server/utils/cache.ts`, `server/plugins/security-headers.ts`, `shared/cache/tags.ts`.

**Fora do escopo.** CSP, CSRF e rate limit (F03-T4).

**Critérios de aceite**
- [ ] Rotas públicas emitem o `Cache-Control` definido no ADR-0003 e o `Cache-Tag`; `/api/admin/**` e `/admin/**` emitem `private, no-store`.
- [ ] Os erros em produção não expõem stack trace nem detalhes internos; o log tem `requestId`, rota, status e duração, sem PII.
- [ ] As tags são validadas (ASCII imprimível, sem espaços, até 1.024 caracteres) antes de entrar no header.
- [ ] Headers base presentes: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, `X-Frame-Options`.

**Testes**
- Unit: builders de tags e de política de cache; validação de tags inválidas.
- API: headers por tipo de rota; erro 500 genérico em build de produção.

---

## Prompt da fase

```text
Fase F02 — Dados, i18n e SEO base. Projeto: ~/Desktop/dev/portfolio.

Leia CLAUDE.md, docs/roadmap/F02-dados-i18n-seo.md, docs/architecture/data-model.md, docs/architecture/i18n-seo.md e os ADRs 0003, 0004 e 0008. Pegue a primeira tarefa "pendente" com dependências concluídas.

Antes de editar: apresente objetivo, arquivos, abordagem, dependências novas (checklist do /architecture-guardian), testes e riscos. Aguarde minha aprovação.

Regras desta fase:
- Migrações só locais (--local). Nada de --remote sem meu pedido.
- Nenhuma resposta pública pode emitir Set-Cookie; i18n sem detecção de idioma por cookie ou redirect.
- Use /i18n-manager nas tarefas de i18n e SEO e /security-audit na F02-T4.

Depois de implementar: rode typecheck, lint, test (unit, nuxt, workers) e os testes de API relevantes; cole a saída real; atualize o status e os docs (data-model e ADR-0008, se houver decisão); entregue o relatório da Definition of Done. Não faça commit sem eu pedir.
```
