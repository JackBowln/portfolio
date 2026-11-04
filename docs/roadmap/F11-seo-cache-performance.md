# F11 — SEO avançado, cache de produção e performance

**Objetivo da fase:** JSON-LD completo, imagens OG por idioma, sitemap e feeds finais, cache de borda com purge comprovado e o passe final de performance com Lighthouse 13 no CI.

**Pré-requisitos:** F10 concluída.

**Leitura obrigatória:** [ADR-0003](../architecture/adr/0003-renderizacao-cache-e-cpu.md), [ADR-0008](../architecture/adr/0008-i18n-e-seo.md), [i18n-seo](../architecture/i18n-seo.md), [performance-budgets](../quality/performance-budgets.md), skills `/performance-audit` e `/i18n-manager`.

**Gate de saída:** Lighthouse dentro da política em R1–R8 (mobile e desktop), purge após publicação refletido em ≤ 60 s no preview, sitemap e hreflang validados por crawl automatizado.

---

### F11-T1 — JSON-LD completo por template

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída (Rich Results Test pendente: precisa de URL pública) | F10 (gate) | RF-12.6 | `/i18n-manager` |

**Objetivo.** Implementar os helpers tipados (`WebSite`, `Person`, `ProfilePage`, `BlogPosting`, `CreativeWork` + `SoftwareSourceCode`, `CollectionPage`, `BreadcrumbList`) conforme o i18n-seo §5, com `@id` estáveis e `inLanguage`, e serialização segura (escape de `</script>`).

**Arquivos prováveis.** `shared/seo/jsonld.ts`, `app/composables/usePageSeo.ts` (integração), páginas.

**Fora do escopo.** Tipos que não refletem conteúdo visível.

**Critérios de aceite**
- [x] Cada template emite só os tipos da tabela, com campos de conteúdo visível.
- [~] Os blocos JSON-LD válidos passam pelo Rich Results Test em 1 artigo e em 1 estudo de caso (prints no relatório; verificação manual).
- [x] Um título com `</script>` não quebra o HTML (teste).

**Resultado (04/11/2026).**
- **Helpers** (`shared/seo/jsonld.ts`): `website`, `person`, `profilePage`, `blogPosting`, `creativeWork` (`SoftwareSourceCode` quando há repositório), `collectionPage` e `breadcrumbList`.
  - `@id` estáveis (`#person`, `#website`, a URL canônica com `#page`, `#article`, `#work` ou `#breadcrumbs`), `inLanguage` e nenhum campo vazio.
  - `serializeJsonLd` escapa `<`, `>`, `&`, U+2028 e U+2029.
- **Montagem no servidor** (decisão 1): `server/services/seo/jsonld.service.ts` monta o JSON-LD e as respostas públicas (página, artigo, projeto, listas e tema) trazem um campo `jsonLd` pronto. A página só o coloca no `<head>` (`useJsonLd`), também numa navegação no cliente.
  - **Só o visível:**
    - **Person:** `jobTitle` do cargo; `sameAs` só quando o rodapé mostra as redes.
    - **Artigo:** `image` só com capa, `keywords` dos temas, as datas que o artigo mostra.
    - **Projeto:** resumo, capa, tecnologias e repositório.
  - **Breadcrumbs** (decisão 3): o nome do site, a seção e a página. Os nomes das seções vêm de `shared/seo/sections.ts`, conferidos contra o i18n por teste.
  - Contato e privacidade não emitem JSON-LD. As respostas com JSON-LD levam a tag `settings`, para o nome do site purgar o cache.
- **Caminhos:** `shared/content/paths.ts` ganhou `topicPath` (o segmento de tema por idioma), que a F11-T3 reaproveita.
- **Rich Results Test** (decisão 2): fica para quando houver uma URL pública (deploy do preview, ação do owner). A estrutura está coberta por testes.
- **Orçamento:** R2 revisada para 127 KB (performance-budgets.md).
- **Testes:**
  - `tests/unit/jsonld.test.ts`;
  - `tests/api/jsonld.spec.ts`: os tipos por template e o título com `</script>` verificado num navegador, sem alerta e sem script executável;
  - `tests/e2e/jsonld.spec.ts`: o bloco acompanha a navegação no cliente.

**Testes**
- Unit: helpers e escape.
- E2E: o JSON-LD está presente e parseável em cada template.

---

### F11-T2 — Imagens OG geradas no admin

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F11-T1 | RF-07.2, RF-12.5 | `/cms-engineer`, `/frontend-design` |

**Objetivo.** Criar o template de Canvas 1200×630 (título do idioma, nome do site, acento visual, fontes do site), gerado no navegador ao publicar cada idioma (ou pelo botão "gerar OG") e enviado como mídia `og`; `og:image` com dimensões e `og:image:alt`; fallback para a OG padrão das configurações.

**Arquivos prováveis.** `app/components/admin/og/OgImageGenerator.vue`, `app/composables/admin/useOgImage.ts`, integração com o publishing.

**Fora do escopo.** Renderização de OG no servidor (proibida no Free, ADR-0007).

**Critérios de aceite**
- [ ] Títulos longos quebram em até 3 linhas e são truncados com reticências; diacríticos dos 5 idiomas renderizados.
- [ ] A OG é gerada uma vez por revisão publicada e reaproveitada se o título não mudou.
- [ ] O tamanho do arquivo fica ≤ 300 KB.

**Testes**
- Nuxt e unit: quebra de linha e truncamento.
- E2E: publicar → `og:image` aponta para a mídia gerada.

---

### F11-T3 — Sitemap, robots e feeds finais

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F11-T1 | RF-01.9, RF-12.3, RF-12.4, RF-12.7 | `/i18n-manager` |

**Objetivo.** Ligar o sitemap às fontes dinâmicas de todas as entidades (alternates só dos idiomas publicados, `lastmod`, temas com ≥ 1 artigo no idioma) e aplicar as exclusões (noindex, fallback institucional, admin, api, preview). Revisar o `robots.txt` final, validar os feeds e testar o middleware de redirects.

**Arquivos prováveis.** `server/api/__sitemap__/urls.get.ts`, `server/routes/robots.txt.ts`, `server/routes/rss.xml.ts`, `tests/e2e/seo-crawl.spec.ts`.

**Fora do escopo.** Envio ao Search Console (F12-T5, ação sua).

**Critérios de aceite**
- [ ] Um crawl automatizado do sitemap confirma, para cada URL: 200, canonical para si mesma, hreflang recíproco e nenhum `noindex`.
- [ ] O sitemap não contém páginas em fallback, com `noindex` ou paginação além da 1.
- [ ] Os feeds RSS são válidos (parser) e listam só artigos publicados no idioma.

**Testes**
- E2E: crawl de SEO (seo-crawl.spec).
- API: robots por ambiente; redirects 301 cacheados.

---

### F11-T4 — Cache de produção: tags, purge e política por rota

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F11-T3 | RNF-05 | `/performance-audit`, `/architecture-guardian` |

**Objetivo.** Aplicar a decisão do F00-T6:
- Workers Cache (ou o fallback escolhido) por ambiente;
- `Cache-Tag` em todas as respostas públicas;
- purge integrado a todos os eventos do ADR-0003;
- decisão sobre `cross_version_cache` e o purge pós-deploy.

Comprovar no preview.

**Arquivos prováveis.** `wrangler.jsonc`, `server/utils/cache.ts`, `server/plugins/cache-tags.ts`, `tests/api/cache.spec.ts`.

**Fora do escopo.** Mudar a estratégia (isso exigiria um ADR novo).

**Critérios de aceite**
- [ ] Todas as respostas públicas têm `Cache-Control` e `Cache-Tag` válidos; nenhuma tem `Set-Cookie` (teste varrendo todas as rotas do sitemap).
- [ ] No preview (com sua autorização para o deploy): publicar → a página e as listas refletem a mudança em ≤ 60 s; o tempo medido vai para o ADR-0003.
- [ ] Hit sem execução do Worker comprovado (`Cf-Cache-Status` ou métricas).

**Testes**
- API: headers de cache em todas as rotas públicas.
- Manual registrado no preview: publicar → reflexo (tempo).

---

### F11-T5 — Passe de performance e Lighthouse 13 no CI

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F11-T4 | RNF-01, RNF-02, RNF-03, RNF-11 | `/performance-audit` |

**Objetivo.** Rodar o protocolo em R1–R8 (mobile e desktop, 3 execuções), corrigir as regressões e criar o job de Lighthouse no CI com as asserções da política de tolerância (PRs `ui`, `main` e pré-release), com os orçamentos aplicados e o `perf-log` atualizado.

**Arquivos prováveis.** `.github/workflows/lighthouse.yml`, `performance-budgets.json`, `docs/quality/perf-log.md`, correções pontuais nas páginas.

**Herdado da F10-T3 (owner, 04/11/2026).**
- O LCP mobile de laboratório da R1 com conteúdo tem mediana de ~1,99 s, acima dos 1,8 s do critério da F10-T3.
- A medição A/B mostrou que o motion não pesa; o gargalo é o CSS bloqueante (~306 ms na simulação).
- Este passe avalia o CSS crítico inline ou a divisão do CSS por rota.

**Fora do escopo.** Remover conteúdo ou recursos para ganhar nota (proibido).

**Critérios de aceite**
- [ ] Medianas dentro da política (performance-budgets §3) em todas as rotas, e 100 nas quatro categorias em R1, R3 e R5 no desktop. Toda nota abaixo de 100 tem a causa documentada.
- [ ] O job de CI falha quando um limite é violado (demonstrado).
- [ ] `check:budgets` verde em todas as rotas.

**Testes**
- Relatórios do Lighthouse anexados (artefatos) e `perf-log` atualizado.

---

### F11-T6 — Tirar as rotas do admin do JS público

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F07-T1 | RNF-01 | `/performance-audit`, `/architecture-guardian` |

**Objetivo.** O entry de toda rota pública carrega os registros de rota das telas do admin (caminho, meta e lista de dependências de cada página): medido na F07-T1, 14 rotas = 0,68 kB gz, e cada tela nova soma ≈ 0,05 kB. Tirar esses registros do JS público (por exemplo, uma rota única `/admin/**` que carrega as telas sob demanda) e devolver o limite do R3/R8 a 120 KB (revisão da F07-T1 em performance-budgets §4).

**Arquivos prováveis.** `app/pages/admin/**`, `nuxt.config.ts`, `performance-budgets.json`.

**Fora do escopo.** Mudar o comportamento ou as URLs das telas do admin.

**Critérios de aceite**
- [x] Nenhum registro de rota do admin no JS das rotas públicas (`check:budgets` procura).
- [x] R3/R8 de volta a ≤ 120 KB; as suítes do admin (E2E e a11y) seguem verdes.

**Testes**
- `check:budgets` e a suíte E2E do admin.

**Resultado (30/10/2026, adiantada antes da F08-T1 por decisão do owner).**
- `modules/admin-routes.ts` tira as páginas de `/admin/**` da tabela pública depois do i18n e da extração da meta, deixa a rota-ponte `admin-bridge` e gera `#build/admin-routes.mjs`; `app/middleware/admin-routes.global.ts` registra as rotas na primeira navegação ao admin, remove a ponte e refaz a navegação (404 quando nenhuma tela casa). Decisão em [ADR-0016](../architecture/adr/0016-rotas-do-admin-fora-do-js-publico.md).
- Medido: −0,79 kB gz em toda rota pública; R3 120,31 → 119,52, e o limite volta a 120 KB. O `check:budgets` proíbe `admin-artigos` no JS público.
- Testes: `tests/e2e/admin-routes.spec.ts` (URL profunda e recarregamento, navegação do público para o admin, 404, nenhuma tabela do admin numa página pública) e as suítes do admin, sem mudança.

---

## Prompt da fase

```text
Fase F11 — SEO avançado, cache e performance. Projeto: ~/Desktop/dev/portfolio.

Leia CLAUDE.md, docs/roadmap/F11-seo-cache-performance.md, os ADRs 0003 e 0008, docs/architecture/i18n-seo.md e docs/quality/performance-budgets.md. Use /performance-audit e /i18n-manager. Pegue a primeira tarefa "pendente" com dependências concluídas.

Antes de editar: apresente objetivo, arquivos, abordagem, testes e riscos. Aguarde minha aprovação.

Regras desta fase:
- Nunca declare nota de Lighthouse sem relatório gerado na sessão; siga o protocolo (build de produção, 3 execuções, mediana).
- Não remova conteúdo, semântica ou controles acessíveis para ganhar nota.
- Deploy de preview só com minha autorização (F11-T4).

Depois de implementar: rode typecheck, lint, test, test:api, e2e (incluindo seo-crawl) e Lighthouse; cole a saída real; atualize o status, o perf-log e o ADR-0003; entregue o relatório da Definition of Done. Não faça commit sem eu pedir.
```
