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
   - **Nós:** `doc`, `paragraph`, `heading` (níveis 2–4), `bulletList`, `orderedList`, `listItem`, `blockquote`, `horizontalRule`, `hardBreak`, `text`, `codeBlock` (`language`, `code`, `hast`), `image` (`mediaId`, `caption?`, `altOverride?`), `gallery` (`items: mediaId[]`, `layout`), `video` (`mediaId`; poster e legendas vêm do registro da mídia, e vídeo externo é um `embed`; decisão da F05-T2), `embed` (`provider` ∈ allowlist, `externalId`, `title`, `posterMediaId`), `callout` (`tone`) e, como _should_, `table` simples.
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
   - Restaurar copia o snapshot para a cópia de trabalho e cria uma revisão `restore`. O histórico nunca é apagado, exceto a poda de autosaves (no máximo os 10 mais recentes por localização, nenhum com mais de 14 dias; [data-model §4.3](../data-model.md#43-article_revisions), alinhado na F05-T1).
   - O diff é calculado no navegador do admin, por bloco (`id`) e por texto.
   - Despublicar zera o ponteiro e mantém o histórico.
   - Mudar o slug de algo publicado cria um redirect 301 ([ADR-0008](0008-i18n-e-seo.md)).
7. **Estados por localização.**
   - Publicação: `draft → scheduled → published`, com `unpublished` possível depois de publicado.
   - Tradução: `source | missing | machine | in_review | approved | outdated` ([ADR-0009](0009-traducao-assistida-por-ia.md)).
8. **Preview.** `/preview/{token}`, com token HMAC (`PREVIEW_TOKEN_SECRET`) contendo `{type, id, locale, revisionId?, exp ≤ 24h}`. Renderiza a cópia de trabalho com `private, no-store` e `noindex`.

## Decisões da F05-T2

- **Código:** `shared/content/document-schema.ts` (schema e `validateDocument`), `hast.ts` (allowlist do HAST), `url.ts` (`contentHref`, `linkRel`), `derive.ts` e `migrations/index.ts`. A coluna `body` valida com esse schema em toda escrita e leitura.
- **Versão:** `doc.attrs.schemaVersion` (padrão 1, ausente = 1), que o Tiptap emite com um atributo na extensão Document. Migradores puros de n para n + 1 em `shared/content/migrations/`; o v1 → v1 (identidade) documenta o padrão.
- **Vídeo:** o nó guarda só `{ id, mediaId, caption? }`. O poster e as faixas WebVTT ficam no registro da mídia ([ADR-0007](0007-midia.md), F04-T4), para não haver duas fontes de verdade.
- **Valores fechados:** `gallery.layout` ∈ `grid` | `stack` (2 a 24 itens); `callout.tone` ∈ `info` | `tip` | `warning` | `danger`; `embed.provider` ∈ `youtube` (ID de 11 caracteres) | `vimeo` (numérico).
- **Link:** a mark guarda **só** `href`; `rel` é derivado no render (`linkRel`) e `target`/`class` do Tiptap são recusados (o editor da F05-T3 normaliza). `tel:` fica fora, assim como `//host` e `\`.
- **Tabela simples:** células aceitam só os atributos padrão do Tiptap (`colspan: 1`, `rowspan: 1`, `colwidth: null`) e só parágrafos.
- **HAST:** o nó guarda o `pre` do Shiki (`pre > code > span*` + texto). `class` vem de uma lista fechada (`shiki`, `shiki-themes`, `line` e os temas `github-light`/`github-dark`, a confirmar na F05-T3); `style` só define as variáveis `--shiki-(light|dark)[-bg]` com cor hex e `--shiki-*-font-style|font-weight|text-decoration` com palavras fixas (`defaultColor: false`). O texto do HAST precisa ser **igual** a `code`.
- **Limites:** 512 KB de JSON, 5.000 nós e 12 níveis, checados antes do parse completo; código até 32 KB, porque o HAST de um bloco maior não caberia no limite do documento; textos curtos (legenda, alt) até 500 caracteres.
- **Derivados:** palavras por `Intl.Segmenter` do idioma, sobre texto de prosa, legendas e títulos de embed (código fica fora); tempo de leitura = `ceil(palavras / 220)`, com mínimo de 1; sumário com h2 e h3 e o `id` como âncora; `media_usages` com `image`/`video` → `body`, `gallery` → `gallery` e poster de embed → `poster`.
- **Segmentos:** um por parágrafo ou heading com texto (conteúdo inline com marks), mais `{id}:caption`, `{id}:alt` e `{id}:title` e campos `field:{nome}`. O hash é o SHA-256 do JSON canônico. Código e IDs de mídia não são segmentos.
- **Medição:** validar um documento de ~77 KB com todos os tipos de nó leva ~1 ms, e derivar + hashes ~2 ms, no workerd local (o relógio do workerd tem resolução de ms).

## Decisões da F05-T3

- **Código:** `app/components/admin/editor/` (`ContentEditor.vue`, barras, diálogos e node views) e `extensions/` (`schema-extensions.ts` é a lista usada pelo editor e pelos testes headless); `app/utils/admin/highlight.ts` e `code-languages.ts`. A página `app/pages/admin/_test/editor.vue` e o stub `server/api/_test/document.post.ts` existem só no build de teste.
- **JSON igual ao schema por configuração, não por filtro:** `Link` só com `href` (o `isAllowedUri` usa o `contentHref`), `OrderedList` só com `start`, `Heading` com níveis 2–4, células só com `colspan`/`rowspan` 1 e `colwidth` nulo (o `align` do TableKit 3.32 foi removido), `doc` com `schemaVersion`, regras de conteúdo iguais às do schema (citação, destaque e item de lista só com parágrafos e listas; células só com parágrafos). Underline, o codeBlock do StarterKit e o TrailingNode ficam desligados (abrir um documento não pode mudá-lo).
- **IDs únicos:** além do UniqueID, um plugin (`unique-id-guard.ts`) regenera repetições depois de cada transação; uma tabela inserida dentro de outra dividia a de fora em duas com o mesmo `id`.
- **Arrastar sem DragHandle:** o `@tiptap/extension-drag-handle` exige Yjs e Collaboration como peers obrigatórios. Os blocos se movem com `Alt+Shift+↑/↓` e pelos botões da barra (extensão `block-move.ts`), e os blocos atômicos são arrastáveis pelo drag nativo do ProseMirror com o Dropcursor.
- **Shiki:** `shiki ~4.5` com `shiki/core`, engine JavaScript (sem WASM, que a CSP da página do admin não permite), temas `github-light`/`github-dark` com `defaultColor: false` e uma gramática por linguagem (18, decisão 2 da tarefa). A saída real das 18 linguagens passa na allowlist da F05-T2 sem mudança; o editor grava a forma JSON do HAST (o Shiki deixa `data: undefined` nos elementos).
- **Blocos atômicos completos:** imagem, galeria (2 a 24 itens, montada num diálogo), vídeo e embed só entram com todos os dados, seguidos de um parágrafo vazio com o cursor. O código grava `code` com HAST simples a cada tecla e troca pelo destaque do Shiki quando o texto não mudou.
- **Barra de ferramentas:** padrão WAI-ARIA toolbar (uma parada de Tab, setas, Home/End; botões que não se aplicam ficam com `aria-disabled`), `aria-pressed` nos estados, `aria-keyshortcuts` em todo atalho; uma segunda barra "Bloco atual" para o tom do destaque e as linhas e colunas da tabela. `Esc` ou `Alt+F10` levam do texto para a barra; `Ctrl/⌘+/` abre a lista de atalhos.
- **CSS:** `injectCSS: false`; as regras base do ProseMirror e as cores do Shiki (`light-dark()`) ficam no `<style>` do `ContentEditor`, no chunk do admin.
- **Dependências:** `@tiptap/{vue-3,core,pm,starter-kit,extensions,extension-unique-id,extension-table,extension-list,extension-blockquote,extension-link} ~3.32.1` e `shiki ~4.5.0`, todas MIT. As três últimas do Tiptap já vinham pelo StarterKit e passaram a ser diretas porque o editor as estende.

## Decisões da F05-T4

- **Código:** `app/components/content/` — `StaticContent.vue` (onde uma página põe um documento), `ContentRenderer.vue`, `ContentBlocks.ts` (blocos, marks e tabela como render functions), `HastNode.ts` e `nodes/` (código, figura, galeria, vídeo e o link de embed); `app/utils/content/enhance.ts`; `shared/content/anchors.ts` e `code-languages.ts`; `server/services/content/document-media.ts`. A página `app/pages/_test/content.vue` e o endpoint `server/api/_test/content.get.ts` existem só no build de teste.
- **Sem hidratação (decisão 1):** o `StaticContent` usa `<LazyContentRenderer hydrate-never>`. Na primeira visita o navegador mantém o HTML do servidor e não baixa o chunk do renderer (3,3 KB gz); depois de uma navegação no cliente, o chunk carrega e renderiza. A macro `defineLazyHydrationComponent('never', …)` renderizou vazio no SSR do Nuxt 4.6.2 e não é usada. Em produção, o Nuxt renderiza com dependências pré-computadas e não remove o `prefetch` dos módulos `hydrate-never` (a exclusão só olha o manifest do cliente); o hook `build:manifest` do `nuxt.config.ts` desmarca `prefetch` e `preload` do chunk do renderer.
- **Interações sem Vue:** um componente que nunca hidrata não pode conter componentes interativos. Copiar o código e o fallback da galeria vêm de um script de 0,6 KB gz (`enhance.ts`), importado depois do mount e delegado na raiz do conteúdo; o botão de copiar fica oculto por CSS até o script carregar (sem controle morto sem JS). A galeria abre cada imagem num `<dialog>` modal com invoker commands (`command="show-modal"`), que funcionam sem JS; o script cobre os navegadores sem esse suporte.
- **O renderer não confia no schema:** nó, mark, nível, tom ou `start` desconhecidos viram nada ou o valor padrão; `href` passa de novo pelo `contentHref` (e o `rel` vem do `linkRel`); o HAST é conferido pelo `hastIssues` (se falhar, cai para o código puro) e o `HastNode` aplica a allowlist nó a nó (classes da lista, `style` só com variáveis do Shiki, sem `tabindex`); o embed só vira link com um id que o padrão do provedor aceita. Todo texto é filho de string do Vue, portanto escapado.
- **Âncoras (decisão 2):** slug ASCII do texto do título, sem repetições na página e fora dos ids do frame (`main`, `site-menu`), em `shared/content/anchors.ts` para o sumário da F06 usar o mesmo. O link `#` fica dentro do título, com nome acessível "Link para a seção “…”".
- **Acessibilidade:** o código é uma `<figure>` com a linguagem na legenda e um grupo focável com o nome "Código em {linguagem}" (o bloco rola); a tabela rola num grupo focável com cabeçalhos `scope`; o destaque mostra o tom em palavra, não só em cor.
- **Mídia em lote (decisão 3):** `resolveDocumentMedia(db, doc, locale)` lê os itens do documento num único `db.batch` (em grupos de 90 ids, abaixo do limite de 100 parâmetros do D1) e os posters dos vídeos em mais um. Itens ausentes, pendentes ou apagados ficam de fora, e o renderer pula os blocos deles.
- **Embed (decisão 4):** até a facade da F05-T5, o bloco é o poster e um link "Assistir no {provedor}", sem iframe e sem requisição a terceiros.
- **CSS:** os estilos dos blocos ficam no `<style>` global do `StaticContent` (no CSS da página), porque o chunk do renderer não carrega na primeira visita. O preview do editor passou a usar o `HastNode` público.
- **Lint:** `vue/no-v-html` como erro em todos os `.vue`.

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
