# F05 — Modelo de conteúdo e editor

**Objetivo da fase:** o schema de conteúdo (artigos, projetos, páginas, localizações, revisões, temas), o schema do documento compartilhado, o editor Tiptap no admin e o renderer público sem JS e sem XSS.

**Pré-requisitos:** F04 concluída (seletor de mídia).

**Leitura obrigatória:** [ADR-0006](../architecture/adr/0006-conteudo-e-editor.md), [data-model §4 e §8](../architecture/data-model.md), [ADR-0012](../architecture/adr/0012-seguranca.md), skill `/cms-engineer`.

**Gate de saída:** um documento com todos os tipos de nó criado no editor → validado no servidor → renderizado no público; bundle público sem `@tiptap`; todos os payloads maliciosos rejeitados.

---

### F05-T1 — Schema de conteúdo e repositórios base

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F04 (gate) | RF-05.1, RF-09.1, RF-10.2 | `/cms-engineer`, `/architecture-guardian` |

**Objetivo.** Criar as tabelas de [data-model §4](../architecture/data-model.md#4-conteúdo), com as migrações e índices, e os repositórios genéricos para entidades localizadas:
- criar e ler a localização;
- `createRevision`, que comprime o snapshot com `CompressionStream` e deduplica por hash;
- `getPublishedBySlug`;
- `listPublished` com cursor.

**Arquivos prováveis.** `server/db/schema/{content,taxonomy}.ts`, migração, `server/services/content/localized.repo.ts`, `server/services/content/revisions.repo.ts`, `shared/content/canonical-json.ts`.

**Fora do escopo.** Regras de publicação (F06-T4) e interface.

**Critérios de aceite**
- [ ] Índices e unicidades do data-model criados, incluindo os índices parciais de slug.
- [ ] Snapshot comprimido e descomprimido sem perda; o hash é do JSON canônico; autosave idêntico não gera revisão.
- [ ] A leitura pública por `(locale, published_slug)` usa 1 query (verificado no teste).

**Testes**
- Workers: unicidade de slug por idioma; leitura pública com 1 query; deduplicação por hash; ida e volta da compressão.
- Unit: o JSON canônico é estável (a ordem das chaves não muda o hash).

---

### F05-T2 — Schema do documento e dados derivados

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F05-T1 | RF-04.1, RF-04.2, RF-04.3, RF-04.4, RF-04.5, RF-04.6, RNF-07 | `/cms-engineer`, `/security-audit` |

**Objetivo.** Criar o `shared/content/document-schema.ts` (zod `strict`) com nós, marks e atributos do ADR-0006, mais os validadores de URL e o validador de HAST com allowlist. Incluir também `schemaVersion` com a pasta de migradores e as funções puras de dados derivados:
- contagem de palavras e tempo de leitura;
- sumário (TOC);
- `media_usages`;
- hashes por segmento.

**Arquivos prováveis.** `shared/content/document-schema.ts`, `shared/content/url.ts`, `shared/content/hast.ts`, `shared/content/derive.ts`, `shared/content/migrations/index.ts`.

**Fora do escopo.** Editor (T3) e renderer (T4).

**Critérios de aceite**
- [ ] Todo nó válido é aceito; nó desconhecido, atributo extra, `javascript:`/`data:` em link, HAST com `script` ou `on*`, e embed fora da allowlist → rejeitados com erro claro.
- [ ] O cálculo de tempo de leitura e o TOC são determinísticos; os IDs de heading são estáveis (UniqueID).
- [ ] Um migrador de exemplo (v1 → v1, identidade) tem teste, documentando o padrão.

**Testes**
- Unit: matriz de payloads válidos e maliciosos (≥ 30 casos); propriedades do `derive`.
- Cobertura ≥ 90% de branches no schema.

---

### F05-T3 — Editor Tiptap no admin

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F05-T2, F04-T4 | RF-04.1, RF-04.2, RF-04.3, RF-04.4, RF-04.5, RF-04.6, RF-04.7, RF-04.8 | `/cms-engineer`, `/frontend-design` |

**Objetivo.** Criar o componente de editor com `@tiptap/vue-3 ~3.32` (só extensões MIT): StarterKit, Link, UniqueID, Placeholder, CharacterCount, DragHandle (com alternativa por teclado) e nós próprios (imagem e galeria pelo seletor de mídia, vídeo, embed, callout, código). O código usa Shiki **no navegador** e grava o HAST no nó. Incluir a normalização ao colar e uma barra de ferramentas acessível.

**Arquivos prováveis.** `app/components/admin/editor/*.vue`, `app/components/admin/editor/extensions/*.ts`, `app/composables/admin/useShiki.ts`.

**Fora do escopo.** Autosave no servidor e revisões (F06-T2).

**Critérios de aceite**
- [ ] O JSON emitido pelo editor sempre passa no `document-schema` (teste com documentos gerados).
- [ ] Colar HTML externo resulta só em nós permitidos.
- [ ] Atalhos de teclado documentados; todas as ações da barra são operáveis por teclado e têm nome acessível.
- [ ] Shiki e Tiptap só no bundle do admin (manifest conferido).

**Testes**
- Nuxt: cada extensão própria serializa no formato do schema.
- E2E: criar documento com todos os nós → salvar (stub) → o JSON valida.

---

### F05-T4 — Renderer público sem `v-html` e sem hidratação

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F05-T2, F04-T3 | RF-04.1, RF-04.4, RX-04, RNF-03 | `/frontend-design`, `/performance-audit`, `/security-audit` |

**Objetivo.** Criar o `ContentRenderer` (nó → componente), o renderer recursivo de HAST com allowlist e os componentes de figura, galeria (ampliação como ilha sob demanda), callout, tabela e código (botão copiar como ilha mínima). O conteúdo estático não hidrata.

**Arquivos prováveis.** `app/components/content/ContentRenderer.vue`, `app/components/content/nodes/*.vue`, `app/components/content/HastNode.vue`, `app/components/content/islands/*.vue`.

**Fora do escopo.** Embeds com facade (T5).

**Critérios de aceite**
- [ ] Nenhum `v-html` no projeto (regra de lint ou `grep` no CI).
- [ ] Bundle público sem `@tiptap` e sem `shiki` (checagem automática no build).
- [ ] Página de teste com documento completo: o JS do conteúdo se limita às ilhas; orçamento do artigo respeitado (≤ 100 KB gz).
- [ ] Headings com âncora e foco visível; código com o nome da linguagem anunciado.

**Testes**
- Nuxt: snapshot por tipo de nó; payload hostil injetado direto no renderer → texto escapado.
- Checagem de build: dependências proibidas no bundle público.
- `/performance-audit` na página de teste.

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
