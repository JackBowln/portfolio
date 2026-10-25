# F06 — Fluxo editorial (artigos) e blog público

**Objetivo da fase:** o ciclo completo do artigo (criar, editar com autosave, versionar, restaurar, fazer preview, publicar, despublicar e agendar) e o blog público com leitura excelente, temas e RSS.

**Pré-requisitos:** F05 concluída. Fuso horário padrão definido (Q-06).

**Leitura obrigatória:** [ADR-0006](../architecture/adr/0006-conteudo-e-editor.md), [data-model §8–§10](../architecture/data-model.md), [ADR-0003](../architecture/adr/0003-renderizacao-cache-e-cpu.md) (tags e purge), [ADR-0008](../architecture/adr/0008-i18n-e-seo.md), skill `/cms-engineer`.

**Gate de saída:** as jornadas J-03 (criar, preview, agendar), J-04 (agendamento dispara, purge, sitemap, RSS) e J-07 (restaurar) passando em E2E.

---

### F06-T1 — CRUD de artigos (API e telas)

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F05 (gate) | RF-04.7, RF-07.1, RF-07.4 | `/cms-engineer`, `/frontend-design` |

**Objetivo.** Implementar a API para listar, criar, ler, atualizar e excluir (lógico) artigos e a localização pt-BR. No admin:
- lista com filtros por status, idioma e estado de tradução;
- tela de edição com título, slug (automático e editável, com transliteração), resumo, capa, temas (CRUD mínimo de temas), campos SEO com prévia do resultado de busca, `noindex` e corpo.

**Arquivos prováveis.** `server/api/admin/articles/**`, `server/services/content/articles.service.ts`, `app/pages/admin/artigos/{index,[id]}.vue`, `app/components/admin/seo/SerpPreview.vue`, `shared/utils/slugify.ts`, `server/api/admin/tags/**`.

**Fora do escopo.** Autosave e revisões (T2); publicação (T4).

**Critérios de aceite**
- [ ] Permissões aplicadas (`article:*`, com `author` restrito ao próprio conteúdo).
- [ ] Slug único por idioma, com erro claro em caso de conflito; transliteração (ü→ue, ß→ss, ç→c, acentos).
- [ ] A prévia do resultado de busca mostra os limites recomendados (título ≤ 60, descrição 120–160).
- [ ] Toda mutação é auditada.

**Testes**
- Unit: `slugify` com casos pt, es, de e fr.
- API: permissões e validação do CRUD.
- E2E: criar e editar um artigo.

---

### F06-T2 — Autosave, revisões, diff e restauração

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F06-T1 | RF-04.7, RF-05.1, RF-05.5, RF-05.6 | `/cms-engineer`, `/test-engineer` |

**Objetivo.** Implementar o autosave (debounce de 2 s) com concorrência otimista (`expectedVersion`, que devolve 409 com as duas versões), as revisões manuais com nota, o histórico com diff por bloco e por texto (calculado no navegador), a restauração (gera revisão `restore`) e a poda de autosaves (tarefa do cron).

**Arquivos prováveis.** `server/api/admin/articles/[id]/{autosave,revisions,restore}.*.ts`, `server/services/content/revisions.service.ts`, `server/tasks/content/prune-autosaves.ts`, `app/components/admin/history/*.vue`.

**Fora do escopo.** Diff visual lado a lado de tradução (F09-T4).

**Critérios de aceite**
- [ ] Conflito de versão entre duas abas → 409 e uma interface para escolher a versão; nada é sobrescrito em silêncio.
- [ ] Restaurar não apaga revisões e cria uma revisão `restore`.
- [ ] A poda mantém no máximo 10 autosaves por localização e nenhum com mais de 14 dias; revisões `manual`, `publish`, `restore` e `ai` nunca são podadas.

**Testes**
- Workers: deduplicação, poda e restauração.
- API: conflito 409.
- E2E (J-07): editar → salvar versão → editar → restaurar a versão anterior.

---

### F06-T3 — Preview autenticado com link temporário

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F06-T1, F05-T4 | RF-05.3 | `/security-audit`, `/cms-engineer` |

**Objetivo.** Gerar um token HMAC (`PREVIEW_TOKEN_SECRET`, `exp` ≤ 24 h, com a validade escolhida pelo editor) e criar a rota `/preview/[token]`, que renderiza a cópia de trabalho com o layout real, mais o botão "copiar link de preview".

**Arquivos prováveis.** `server/utils/preview-token.ts`, `server/api/admin/preview-token.post.ts`, `app/pages/preview/[token].vue`.

**Fora do escopo.** Preview de projetos e páginas (reaproveitado nas F07 e F08).

**Critérios de aceite**
- [ ] Token expirado, adulterado ou de outra entidade → 404 sem detalhes.
- [ ] A resposta tem `private, no-store`, `noindex`, nenhum `Cache-Tag` e uma faixa visível "Pré-visualização".
- [ ] A comparação do token é feita em tempo constante.

**Testes**
- Unit: assinar e verificar (expiração, adulteração).
- API: headers e status para token válido, expirado e adulterado.

---

### F06-T4 — Publicar, despublicar e agendar (cron), redirects e purge

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F06-T2 | RF-05.2, RF-05.4, RF-05.7, RF-07.3, RNF-05 | `/cms-engineer`, `/test-engineer` |

**Objetivo.** Implementar:
- a máquina de estados de publicação com as guardas do data-model §8;
- `publish`, num `db.batch` único: revisão `publish`, ponteiro, campos `published_*`, `article_tags`, redirect se o slug mudou e `audit_log`, seguido do purge das tags;
- `unpublish`;
- `schedule` (o fuso de Q-06 na interface, UTC no banco);
- a tarefa de cron `content:publish-due`, idempotente e com poucos itens por execução.

**Arquivos prováveis.** `server/services/content/publishing.service.ts`, `server/api/admin/articles/[id]/{publish,unpublish,schedule}.post.ts`, `server/tasks/content/publish-due.ts`, `nuxt.config.ts` (`scheduledTasks`), `server/middleware/redirects.ts`.

**Fora do escopo.** Imagem OG gerada (F11-T2: por enquanto, a OG padrão).

**Critérios de aceite**
- [ ] Publicar é atômico (uma falha simulada no meio não deixa estado parcial).
- [ ] Mudar o slug publicado cria um 301; o middleware de redirects responde com cache e com a tag `redirects`.
- [ ] O agendamento dispara em até 5 min depois do horário (testado com relógio falso); executar o cron duas vezes não duplica nada.
- [ ] O purge recebe exatamente as tags do ADR-0003.
- [ ] Localização ≠ pt-BR sem `approved` não publica (guarda testada).

**Testes**
- Workers: transições, guardas e atomicidade.
- Unit: o cálculo das tags.
- E2E (J-04): agendar → avançar o relógio do cron em teste → página pública atualizada, RSS e sitemap incluídos.

---

### F06-T5 — Blog público: lista, artigo, temas e RSS

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F06-T4, F01-T5 | RF-01.4, RF-01.5, RF-01.9, RF-12.1, RF-12.2, RF-12.3, RF-12.5, RX-04 | `/frontend-design`, `/i18n-manager`, `/performance-audit` |

**Objetivo.** Criar:
- `/blog`: paginação (`?page=N` com canonical para a própria página) e filtro por tema;
- `/blog/[slug]`: layout de leitura, TOC, tempo de leitura, datas com `Intl`, temas e artigos relacionados por tema;
- `/blog/temas/[slug]`;
- RSS por idioma.

Tudo integrado com `usePageSeo` (alternates só dos idiomas publicados) e `useSetI18nParams`.

**Arquivos prováveis.** `app/pages/blog/{index,[slug]}.vue`, `app/pages/blog/temas/[slug].vue`, `app/components/blog/*.vue`, `server/routes/rss.xml.ts` (e as variantes por idioma), `server/api/public/articles/**`.

**Fora do escopo.** JSON-LD completo (F11-T1); motion (proibido no artigo).

**Critérios de aceite**
- [ ] Artigo publicado só em pt-BR → ausente das listas de outros idiomas e de seus hreflang; a URL equivalente → 404; o seletor de idioma leva ao índice.
- [ ] Respostas públicas com `Cache-Tag` correto e sem `Set-Cookie`.
- [ ] Artigo com orçamento ≤ 100 KB de JS gz, nenhum JS de motion; Lighthouse dentro da política na R3 (relatório anexado).
- [ ] RSS válido por idioma, com `<link rel="alternate">` no head do blog.

**Testes**
- E2E: lista → artigo → troca de idioma; paginação; filtro por tema; conteúdo presente com JS desligado.
- API: RSS válido; cache headers.
- `/performance-audit` em R2, R3 e R8.

---

## Prompt da fase

```text
Fase F06 — Fluxo editorial e blog público. Projeto: ~/Desktop/dev/portfolio.

Leia CLAUDE.md, docs/roadmap/F06-fluxo-editorial.md, o ADR-0006, o data-model §8–§10 e os ADRs 0003 e 0008. Use /cms-engineer. Pegue a primeira tarefa "pendente" com dependências concluídas.

Antes de editar: apresente objetivo, arquivos, abordagem, dependências novas, testes e riscos. Aguarde minha aprovação.

Regras desta fase:
- O público lê só published_snapshot e as colunas published_*; nunca a cópia de trabalho.
- Publicar, restaurar e agendar são atômicos (db.batch) e auditados; o purge usa as tags do ADR-0003.
- Nenhum JS de motion nas páginas de artigo; leitura simples e rápida (RX-04).
- Não invente conteúdo: o artigo de referência para medição é fornecido por mim ou marcado como [PLACEHOLDER].

Depois de implementar: rode typecheck, lint, test, test:api e os e2e (J-03, J-04, J-07 quando aplicável); cole a saída real; atualize o status e os docs; entregue o relatório da Definition of Done. Não faça commit sem eu pedir.
```
