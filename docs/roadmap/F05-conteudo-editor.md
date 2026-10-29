# F05 — Modelo de conteúdo e editor

**Objetivo da fase:** o schema de conteúdo (artigos, projetos, páginas, localizações, revisões, temas), o schema do documento compartilhado, o editor Tiptap no admin e o renderer público sem JS e sem XSS.

**Pré-requisitos:** F04 concluída (seletor de mídia).

**Leitura obrigatória:** [ADR-0006](../architecture/adr/0006-conteudo-e-editor.md), [data-model §4 e §8](../architecture/data-model.md), [ADR-0012](../architecture/adr/0012-seguranca.md), skill `/cms-engineer`.

**Gate de saída:** um documento com todos os tipos de nó criado no editor → validado no servidor → renderizado no público; bundle público sem `@tiptap`; todos os payloads maliciosos rejeitados.

---

### F05-T1 — Schema de conteúdo e repositórios base

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F04 (gate) | RF-05.1, RF-09.1, RF-10.2 | `/cms-engineer`, `/architecture-guardian` |

**Objetivo.** Criar as tabelas de [data-model §4](../architecture/data-model.md#4-conteúdo), com as migrações e índices, e os repositórios genéricos para entidades localizadas:
- criar e ler a localização;
- `createRevision`, que comprime o snapshot com `CompressionStream` e deduplica por hash;
- `getPublishedBySlug`;
- `listPublished` com cursor.

**Arquivos prováveis.** `server/db/schema/{content,taxonomy}.ts`, migração, `server/services/content/localized.repo.ts`, `server/services/content/revisions.repo.ts`, `shared/content/canonical-json.ts`.

**Fora do escopo.** Regras de publicação (F06-T4) e interface.

**Critérios de aceite**
- [x] Índices e unicidades do data-model criados, incluindo os índices parciais de slug.
- [x] Snapshot comprimido e descomprimido sem perda; o hash é do JSON canônico; autosave idêntico não gera revisão.
- [x] A leitura pública por `(locale, published_slug)` usa 1 query (verificado no teste).

**Testes**
- Workers: unicidade de slug por idioma; leitura pública com 1 query; deduplicação por hash; ida e volta da compressão.
- Unit: o JSON canônico é estável (a ordem das chaves não muda o hash).

**Resultado (29/10/2026).**
- **Schema:** `server/db/schema/content.ts` (artigos, projetos e páginas, com grupos de colunas compartilhados) e `server/db/schema/taxonomy.ts`; migração `0004_content` (aplicada só com `--local`). Além dos índices do data-model, há CHECKs de consistência: `source` só em pt-BR, `scheduled` exige data, colunas `published_*` andam junto com o ponteiro da revisão, período `YYYY-MM` e URLs `https:` de projeto.
- **Compartilhado:** `shared/content/canonical-json.ts` (JSON canônico + SHA-256), `shared/content/snapshot.ts` (formato do snapshot por tipo, gzip nativo) e `shared/content/cursor.ts` (cursor das listas públicas).
- **Repositórios:** `server/services/content/{content-tables,localized.repo,revisions.repo}.ts`, genéricos para `article`, `project` e `page`.
- **Medição:** snapshot de 64 KB → 754 B em gzip; `createRevision` (canonicalizar, hash, gzip e gravar) leva 1–3 ms no workerd local.
- **Decisões:** data-model §4, "Decisões da F05-T1".
- **Testes:** `tests/unit/canonical-json.test.ts` e `tests/workers/content.test.ts`.

---

### F05-T2 — Schema do documento e dados derivados

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F05-T1 | RF-04.1, RF-04.2, RF-04.3, RF-04.4, RF-04.5, RF-04.6, RNF-07 | `/cms-engineer`, `/security-audit` |

**Objetivo.** Criar o `shared/content/document-schema.ts` (zod `strict`) com nós, marks e atributos do ADR-0006, mais os validadores de URL e o validador de HAST com allowlist. Incluir também `schemaVersion` com a pasta de migradores e as funções puras de dados derivados:
- contagem de palavras e tempo de leitura;
- sumário (TOC);
- `media_usages`;
- hashes por segmento.

**Arquivos prováveis.** `shared/content/document-schema.ts`, `shared/content/url.ts`, `shared/content/hast.ts`, `shared/content/derive.ts`, `shared/content/migrations/index.ts`.

**Fora do escopo.** Editor (T3) e renderer (T4).

**Critérios de aceite**
- [x] Todo nó válido é aceito; nó desconhecido, atributo extra, `javascript:`/`data:` em link, HAST com `script` ou `on*`, e embed fora da allowlist → rejeitados com erro claro.
- [x] O cálculo de tempo de leitura e o TOC são determinísticos; os IDs de heading são estáveis (UniqueID).
- [x] Um migrador de exemplo (v1 → v1, identidade) tem teste, documentando o padrão.

**Testes**
- Unit: matriz de payloads válidos e maliciosos (≥ 30 casos); propriedades do `derive`.
- Cobertura ≥ 90% de branches no schema.

**Resultado (29/10/2026).**
- **Código:** `shared/content/{document-schema,hast,url,derive}.ts` e `shared/content/migrations/index.ts`; a coluna `body` (F05-T1) passou a validar com o schema real.
- **Dependência:** `@vitest/coverage-v8 ~5.0.5` (dev, MIT) e o script `pnpm test:coverage`, com limite de 90% de branches em `document-schema.ts` e `hast.ts` (medido: 93,5% e 100%).
- **Testes:** matriz de 59 payloads recusados (mais limites e URLs) e casos válidos em `tests/unit/document-schema.test.ts`, mais `content-hast`, `content-derive` e `content-migrations`; `tests/workers/document-cpu.test.ts` mede o custo no workerd; `tests/support/documents.ts` tem o documento com todos os nós, para as T3 e T4.
- **Decisões:** ADR-0006, "Decisões da F05-T2".

---

### F05-T3 — Editor Tiptap no admin

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F05-T2, F04-T4 | RF-04.1, RF-04.2, RF-04.3, RF-04.4, RF-04.5, RF-04.6, RF-04.7, RF-04.8 | `/cms-engineer`, `/frontend-design` |

**Objetivo.** Criar o componente de editor com `@tiptap/vue-3 ~3.32` (só extensões MIT): StarterKit, Link, UniqueID, Placeholder, CharacterCount, DragHandle (com alternativa por teclado) e nós próprios (imagem e galeria pelo seletor de mídia, vídeo, embed, callout, código). O código usa Shiki **no navegador** e grava o HAST no nó. Incluir a normalização ao colar e uma barra de ferramentas acessível.

**Arquivos prováveis.** `app/components/admin/editor/*.vue`, `app/components/admin/editor/extensions/*.ts`, `app/composables/admin/useShiki.ts`.

**Fora do escopo.** Autosave no servidor e revisões (F06-T2).

**Critérios de aceite**
- [x] O JSON emitido pelo editor sempre passa no `document-schema` (teste com documentos gerados).
- [x] Colar HTML externo resulta só em nós permitidos.
- [x] Atalhos de teclado documentados; todas as ações da barra são operáveis por teclado e têm nome acessível.
- [x] Shiki e Tiptap só no bundle do admin (manifest conferido).

**Testes**
- Nuxt: cada extensão própria serializa no formato do schema.
- E2E: criar documento com todos os nós → salvar (stub) → o JSON valida.

**Resultado (29/10/2026).**
- **Editor:** `app/components/admin/editor/**` (Tiptap 3.32, só extensões MIT) com node views de código e mídia, barra de ferramentas e barra contextual por teclado, diálogos de link, galeria, embed e atalhos; Shiki 4.5 no navegador (`app/utils/admin/highlight.ts`). O `MediaPicker` ganhou a prop `kind` para vídeos.
- **Arrastar:** sem o DragHandle (peers Yjs/Collaboration); `Alt+Shift+↑/↓`, botões e o drag nativo dos blocos atômicos.
- **Build:** o `check:budgets` também procura marcadores do Tiptap, do ProseMirror e do Shiki no conteúdo dos chunks das rotas públicas (0). Editor: 152 KB gz sob demanda no admin; Shiki: 35 KB + uma gramática por linguagem.
- **Decisões:** ADR-0006, "Decisões da F05-T3".
- **Testes:** `tests/nuxt/editor-schema.test.ts` (ida e volta do documento completo, comandos, 200 sequências aleatórias e colagem hostil), `tests/nuxt/highlight.test.ts` (Shiki real nas 18 linguagens), `tests/e2e/editor.spec.ts`, axe em `tests/a11y/admin.spec.ts` e o caso novo de `tests/unit/check-budgets.test.ts`.

---

### F05-T4 — Renderer público sem `v-html` e sem hidratação

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F05-T2, F04-T3 | RF-04.1, RF-04.4, RX-04, RNF-03 | `/frontend-design`, `/performance-audit`, `/security-audit` |

**Objetivo.** Criar o `ContentRenderer` (nó → componente), o renderer recursivo de HAST com allowlist e os componentes de figura, galeria (ampliação como ilha sob demanda), callout, tabela e código (botão copiar como ilha mínima). O conteúdo estático não hidrata.

**Arquivos prováveis.** `app/components/content/ContentRenderer.vue`, `app/components/content/nodes/*.vue`, `app/components/content/HastNode.vue`, `app/components/content/islands/*.vue`.

**Fora do escopo.** Embeds com facade (T5).

**Critérios de aceite**
- [x] Nenhum `v-html` no projeto (regra de lint ou `grep` no CI).
- [x] Bundle público sem `@tiptap` e sem `shiki` (checagem automática no build).
- [x] Página de teste com documento completo: o JS do conteúdo se limita às ilhas; orçamento do artigo respeitado (≤ 120 KB gz, o limite do R3 desde a revisão da F02-T2; o texto original dizia 100 KB).
- [x] Headings com âncora e foco visível; código com o nome da linguagem anunciado.

**Testes**
- Nuxt: snapshot por tipo de nó; payload hostil injetado direto no renderer → texto escapado.
- Checagem de build: dependências proibidas no bundle público.
- `/performance-audit` na página de teste.

**Resultado (29/10/2026).**
- **Renderer:** `app/components/content/` (`StaticContent`, `ContentRenderer`, `ContentBlocks`, `HastNode` e `nodes/`), carregado com `hydrate-never`: na primeira visita o chunk do renderer (3,3 KB gz) não é baixado nem anunciado em `prefetch` (hook `build:manifest`). As interações vêm de `app/utils/content/enhance.ts` (0,6 KB gz): copiar código e o fallback da galeria, que abre em `<dialog>` com invoker commands (funciona sem JS no Chromium).
- **Segurança:** o renderer reaplica as regras do schema (links, HAST, níveis, tons, ids de embed); `vue/no-v-html` é erro no lint.
- **Compartilhado e servidor:** `shared/content/anchors.ts` (âncoras dos títulos), `shared/content/code-languages.ts` (nomes das linguagens, agora também do público) e `server/services/content/document-media.ts` (mídia do documento em um batch do D1, mais um para posters).
- **Medição:** página de teste (`/_test/content`, layout `reading`, imagens reais do pipeline) com Lighthouse 96 mobile e 100 desktop em Performance, 100 em A11y e BP; +0,46 kB de JS inicial e +1,08 kB de CSS sobre o R3 no mesmo build. Detalhes no perf-log.
- **Decisões:** ADR-0006, "Decisões da F05-T4".
- **Testes:** `tests/nuxt/content-renderer.test.ts` (snapshot por nó e entrada hostil), `tests/unit/content-anchors.test.ts`, `tests/workers/document-media.test.ts`, `tests/e2e/content.spec.ts` e `tests/a11y/content.spec.ts`.

---

### F05-T5 — Embeds seguros com facade

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F05-T4 | RF-04.5, RNF-07, RNF-12 | `/security-audit`, `/frontend-design` |

**Objetivo.** Implementar a allowlist de provedores (`youtube-nocookie`, `vimeo` com `dnt`) e o parser de URL → `{ provider, externalId }` no admin. O poster é enviado ou obtido pelo navegador do admin e guardado como mídia, com título obrigatório. A facade carrega o iframe só no clique (`sandbox`/`allow` mínimos) e a CSP ganha o `frame-src` correspondente.

**Arquivos prováveis.** `shared/content/embeds.ts`, `app/components/content/nodes/EmbedFacade.vue`, `server/plugins/csp.ts` (`frame-src`), extensão do editor.

**Fora do escopo.** Provedores além da allowlist (cada um novo exige ADR).

**Critérios de aceite**
- [ ] Nenhuma requisição a domínios de terceiros antes do clique (verificado no E2E).
- [ ] O iframe tem `title`, `sandbox`/`allow` mínimos e `referrerpolicy`; o botão da facade tem nome acessível.
- [ ] Proporção reservada (sem CLS); URLs fora da allowlist são rejeitadas no schema.

**Testes**
- Unit: o parser de URL (casos válidos e inválidos).
- E2E: sem requisições externas antes do clique; o iframe carrega depois do clique.

---

## Prompt da fase

```text
Fase F05 — Modelo de conteúdo e editor. Projeto: ~/Desktop/dev/portfolio.

Leia CLAUDE.md, docs/roadmap/F05-conteudo-editor.md, o ADR-0006 e o data-model §4 e §8. Use a skill /cms-engineer em todas as tarefas. Pegue a primeira tarefa "pendente" com dependências concluídas.

Antes de editar: apresente objetivo, arquivos, abordagem, dependências novas (checklist do /architecture-guardian; Tiptap só com extensões MIT), testes e riscos. Aguarde minha aprovação.

Regras desta fase:
- O document-schema em shared/ é a única fonte de verdade: editor, servidor, renderer e (depois) segmentador usam esse schema.
- Proibido v-html. Proibido @tiptap e shiki no bundle público.
- Nada de processamento pesado no Worker: o highlighting acontece no navegador do admin.
- Use /security-audit nas F05-T2, T4 e T5 e /performance-audit na F05-T4.

Depois de implementar: rode typecheck, lint, test (unit, nuxt, workers) e os e2e relevantes; cole a saída real; atualize o status e os docs; entregue o relatório da Definition of Done. Não faça commit sem eu pedir.
```
