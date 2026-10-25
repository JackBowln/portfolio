# ADR-0006 — Modelo de conteúdo, editor Tiptap e renderer público

- **Status:** Aceito (2026-10-25)
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0003, ADR-0007, ADR-0009, ADR-0012, [data-model](../data-model.md), RF-04, RF-05, RNF-03, RNF-07

## Contexto

- O editor visual de artigos e projetos precisa de imagens, galerias, vídeos, código, links e embeds seguros, além de rascunhos, versões, restauração e preview.
- O site público precisa de JS mínimo e de nenhum vetor de XSS, e o Worker não pode fazer trabalho pesado no request path.
- Tiptap 3.32 é MIT, incluindo DragHandle, UniqueID, TableOfContents e FileHandler.
- O mesmo documento alimenta o editor, a validação, o renderer e a tradução.

## Decisão

1. **Formato.** Documento ProseMirror/Tiptap em JSON, com versão de schema (`schemaVersion`) para migrações de conteúdo.
2. **Fonte única de verdade.** `shared/content/document-schema.ts` (zod) define:
   - **Nós:** `doc`, `paragraph`, `heading` (níveis 2–4), `bulletList`, `orderedList`, `listItem`, `blockquote`, `horizontalRule`, `hardBreak`, `text`, `codeBlock` (`language`, `code`, `hast`), `image` (`mediaId`, `caption?`, `altOverride?`), `gallery` (`items: mediaId[]`, `layout`), `video` (`mediaId` + `posterId` + `captions[]`, ou `embed`), `embed` (`provider` ∈ allowlist, `externalId`, `title`, `posterMediaId`), `callout` (`tone`) e, como _should_, `table` simples.
   - **Marks:** `bold`, `italic`, `strike`, `code`, `link` (`href` validado: `https:`, `http:`, `mailto:` ou relativo; `rel` derivado).
   - Todo bloco tem um `id` estável (extensão UniqueID) para âncoras, diff, mídia e segmentos de tradução.
3. **Editor (só no admin).**
   - `@tiptap/vue-3` com StarterKit e extensões MIT, mais nós próprios para imagem, galeria, vídeo, embed, callout e código.
   - O destaque de código usa **Shiki no navegador do admin**: ao salvar, o HAST vai junto no nó.
   - Colar HTML externo passa por normalização para o schema; o que sobra é descartado.
   - Autosave com debounce de 2 s; concorrência otimista (`expectedRevision`), e um conflito retorna 409 com as duas versões.
4. **No servidor (barato).**
   - Valida com zod `strict` e rejeita nós, marks e atributos desconhecidos.
   - Valida o HAST: só `pre`, `code` e `span`, com `class` e `style` limitados às variáveis CSS do Shiki.
   - Recalcula os derivados: texto puro, contagem de palavras, tempo de leitura, sumário, `media_usages` e hashes por segmento.
5. **Renderer público.**
   - `app/components/content/ContentRenderer.vue` mapeia nó → componente Vue. O texto é sempre interpolado (escapado pelo Vue).
   - O HAST é renderizado por um componente recursivo com allowlist. **Proibido `v-html`.**
   - O renderer é estático (sem hidratação); só embeds com facade e galeria ampliável carregam JS, sob demanda.
   - **Nenhum `@tiptap/*` no bundle público**, imposto por `no-restricted-imports` e checado no build.
6. **Revisões e publicação** (tabelas no [data-model](../data-model.md)).
   - A localização é a cópia de trabalho; `*_revisions` são snapshots imutáveis (`autosave`, `manual`, `publish`, `restore`, `ai`).
   - Publicar cria a revisão `publish` e aponta `published_revision_id` para ela; o público lê **só** snapshots publicados.
   - Restaurar copia o snapshot para a cópia de trabalho e cria uma revisão `restore`. O histórico nunca é apagado, exceto a poda de autosaves (mantém os 20 mais recentes por localização).
   - O diff é calculado no navegador do admin, por bloco (`id`) e por texto.
   - Despublicar zera o ponteiro e mantém o histórico.
   - Mudar o slug de algo publicado cria um redirect 301 ([ADR-0008](0008-i18n-e-seo.md)).
7. **Estados por localização.**
   - Publicação: `draft → scheduled → published`, com `unpublished` possível depois de publicado.
   - Tradução: `source | missing | machine | in_review | approved | outdated` ([ADR-0009](0009-traducao-assistida-por-ia.md)).
8. **Preview.** `/preview/{token}`, com token HMAC (`PREVIEW_TOKEN_SECRET`) contendo `{type, id, locale, revisionId?, exp ≤ 24h}`. Renderiza a cópia de trabalho com `private, no-store` e `noindex`.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Markdown/MDX (Nuxt Content) | Edição menos visual; parsing no request path ou build a cada publicação |
| Guardar HTML e sanitizar | DOMPurify precisa de DOM (indisponível no Worker); risco de XSS; exige `v-html` |
| `@tiptap/static-renderer` no servidor | Mais código no bundle do Worker e saída em HTML (exigiria `v-html`) |
| Shiki no servidor | CPU alta por bloco de código; estoura o orçamento do Free |
| Extensões Tiptap Pro ou Cloud | Pagas; histórico e colaboração resolvidos no nosso modelo |

## Consequências

### Positivas
- Uma única definição de schema evita divergência entre editor, servidor, renderer e tradução.
- Público sem XSS por construção e sem JS de conteúdo.

### Negativas e custos
- Cada tipo de nó novo exige 6 passos (checklist em `/cms-engineer`).
- O admin carrega Shiki e Tiptap (aceitável, porque é separado do público).

### Riscos e mitigação
- **Evolução do schema quebrar conteúdo antigo:** `schemaVersion` + migradores puros em `shared/content/migrations/`, com testes.

## Validação

- F05-T2: payloads maliciosos (`javascript:`, atributos extras, nós desconhecidos, HAST com `script`/`onerror`) rejeitados em testes.
- F05-T4: análise do bundle público sem `@tiptap`; snapshots do renderer para cada nó.

## Referências

- [Tiptap — extensões open source](https://tiptap.dev/blog/release-notes/were-open-sourcing-more-of-tiptap)
- Shiki (`codeToHast`)
