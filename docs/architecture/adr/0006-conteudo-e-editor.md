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
- **HAST:** o nó guarda o `pre` do Shiki (`pre > code > span*` + texto). `class` vem de uma lista fechada (`shiki`, `shiki-themes`, `line` e os temas `github-light-default`/`github-dark-default`, desde a correção de contraste da F05); `style` só define as variáveis `--shiki-(light|dark)[-bg]` com cor hex e `--shiki-*-font-style|font-weight|text-decoration` com palavras fixas (`defaultColor: false`). O texto do HAST precisa ser **igual** a `code`.
- **Limites:** 512 KB de JSON, 5.000 nós e 12 níveis, checados antes do parse completo; código até 32 KB, porque o HAST de um bloco maior não caberia no limite do documento; textos curtos (legenda, alt) até 500 caracteres.
- **Derivados:** palavras por `Intl.Segmenter` do idioma, sobre texto de prosa, legendas e títulos de embed (código fica fora); tempo de leitura = `ceil(palavras / 220)`, com mínimo de 1; sumário com h2 e h3 e o `id` como âncora; `media_usages` com `image`/`video` → `body`, `gallery` → `gallery` e poster de embed → `poster`.
- **Segmentos:** um por parágrafo ou heading com texto (conteúdo inline com marks), mais `{id}:caption`, `{id}:alt` e `{id}:title` e campos `field:{nome}`. O hash é o SHA-256 do JSON canônico. Código e IDs de mídia não são segmentos.
- **Medição:** validar um documento de ~77 KB com todos os tipos de nó leva ~1 ms, e derivar + hashes ~2 ms, no workerd local (o relógio do workerd tem resolução de ms).

## Decisões da F05-T3

- **Código:** `app/components/admin/editor/` (`ContentEditor.vue`, barras, diálogos e node views) e `extensions/` (`schema-extensions.ts` é a lista usada pelo editor e pelos testes headless); `app/utils/admin/highlight.ts` e `code-languages.ts`. A página `app/pages/admin/_test/editor.vue` e o stub `server/api/_test/document.post.ts` existem só no build de teste.
- **JSON igual ao schema por configuração, não por filtro:** `Link` só com `href` (o `isAllowedUri` usa o `contentHref`), `OrderedList` só com `start`, `Heading` com níveis 2–4, células só com `colspan`/`rowspan` 1 e `colwidth` nulo (o `align` do TableKit 3.32 foi removido), `doc` com `schemaVersion`, regras de conteúdo iguais às do schema (citação, destaque e item de lista só com parágrafos e listas; células só com parágrafos). Underline, o codeBlock do StarterKit e o TrailingNode ficam desligados (abrir um documento não pode mudá-lo).
- **IDs únicos:** além do UniqueID, um plugin (`unique-id-guard.ts`) regenera repetições depois de cada transação; uma tabela inserida dentro de outra dividia a de fora em duas com o mesmo `id`.
- **Arrastar sem DragHandle:** o `@tiptap/extension-drag-handle` exige Yjs e Collaboration como peers obrigatórios. Os blocos se movem com `Alt+Shift+↑/↓` e pelos botões da barra (extensão `block-move.ts`), e os blocos atômicos são arrastáveis pelo drag nativo do ProseMirror com o Dropcursor.
- **Shiki:** `shiki ~4.5` com `shiki/core`, engine JavaScript (sem WASM, que a CSP da página do admin não permite), temas `github-light-default`/`github-dark-default` (veja a correção de contraste abaixo) com `defaultColor: false` e uma gramática por linguagem (18, decisão 2 da tarefa). A saída real das 18 linguagens passa na allowlist da F05-T2 sem mudança; o editor grava a forma JSON do HAST (o Shiki deixa `data: undefined` nos elementos).
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

## Decisões da F05-T5

- **Código:** `shared/content/embeds.ts` (parser de URL, URLs do player e de "assistir", nomes dos provedores), `shared/content/embed-origins.ts` (as duas origens permitidas, num módulo próprio para o script da facade não carregar o schema), `app/components/content/nodes/ContentEmbed.vue` e o clique em `app/utils/content/enhance.ts`.
- **O schema não mudou:** continua guardando só `provider` + `externalId` com o padrão de cada provedor; a URL colada no editor é só entrada.
- **Parser:** aceita `youtube.com/watch?v=`, `m.youtube.com`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/`, `youtube-nocookie.com/embed/`, `vimeo.com/{id}`, `vimeo.com/channels/{nome}/{id}` e `player.vimeo.com/video/{id}`; hosts comparados exatamente, só `https:`/`http:`, sem usuário, senha ou porta. Recusa com motivo (`invalid`, `provider`, `video`, `unlisted`), que o editor mostra.
- **Vimeo não listado fica fora (decisão 2):** o hash do vídeo (`/{id}/{hash}` ou `?h=`) exigiria mudar o schema.
- **Poster só da biblioteca (decisão 1):** nada é buscado no provedor, nem pelo admin; a CSP do admin não muda.
- **Facade:** o poster (decorativo) numa caixa 16:9 e um botão "Reproduzir vídeo: {título}", oculto por CSS até o script carregar; a legenda é um link para o vídeo no provedor, que serve de caminho sem JS. No clique, o script confere a origem do player (`isEmbedFrameUrl`), cria o iframe por API do DOM e move o foco para ele; a caixa mantém o tamanho.
- **Iframe:** `youtube-nocookie.com/embed/{id}?autoplay=1` ou `player.vimeo.com/video/{id}?dnt=1&autoplay=1`; `title` do bloco; `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"`; `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`; `referrerpolicy="strict-origin-when-cross-origin"` (os players recusam tocar sem referrer; eles recebem só a origem).
- **CSP:** `frame-src` com as duas origens só nas páginas públicas (ADR-0012).
- **Correção da F05-T4:** a `<figure>` em grid ganhou `grid-template-columns: minmax(0, 1fr)`; sem isso, uma imagem mantinha a largura intrínseca e rolava a página em 360 px.


## Decisões da F06-T2

- **Código:** `app/composables/admin/useAutosave.ts`, `app/components/admin/history/` (`HistoryPanel`, `RevisionDiff`, `ConflictDialog`, `SaveVersionDialog`), `app/utils/admin/document-diff.ts`; servidor em `articles.service.ts`, `revisions.repo.ts`, `prune.repo.ts` e `server/tasks/content/prune-autosaves.ts`; rotas `revisions` e `restore` em `server/api/admin/articles/[id]/`.
- **Autosave:** 2 s depois da última mudança, uma gravação por vez (o que foi digitado durante uma gravação sai logo depois), novas tentativas após 5, 15 e 30 s numa falha de rede ou do servidor, e uma gravação pendente sai antes de deixar a página. Campos inválidos e slug ocupado pausam o autosave até a próxima edição. A concorrência usa o campo `version` da F06-T1 (o "expectedVersion" do roadmap).
- **Conflito (decisão 2):** o 409 em `version` pausa o autosave; a tela busca a versão salva com `GET` e abre um diálogo que não fecha com Esc, com o diff da versão salva para a desta aba. "Manter a desta aba" salva por cima, agora medindo as mudanças contra a versão salva; "Usar a versão salva" descarta as mudanças locais.
- **Diff (decisão 1):** `diff` (jsdiff) `~9.0.0`, BSD-3, sem dependências, só no chunk da tela de edição (13,3 KB gz com a tela). Os blocos são casados pelo `id` (adicionado, removido, alterado, movido), com diff por palavra dentro do bloco, e os campos (título, slug, resumo, SEO, capa, temas) por valor. Inserções e remoções têm texto para leitores de tela, além de cor e risco.
- **Auditoria (decisão 4):** `article.version_saved` e `article.restored` (com o número da revisão); o PATCH do autosave não vai para o `audit_log`, porque a revisão `autosave` já registra autor e hora (security-model §3).

## Decisões da F06-T3

- **Código:** `server/utils/preview-token.ts`, `server/services/content/preview.service.ts`, `server/api/admin/articles/[id]/preview-link.post.ts`, `server/api/preview/[token].get.ts`, `app/pages/preview/[token].vue`, `app/components/content/ArticleView.vue` (o artigo como o leitor vê; a página pública da F06-T5 reaproveita) e `app/components/admin/articles/PreviewLink.vue`.
- **Token:** `base64url(payload).base64url(HMAC-SHA256)` com `{ t, id, l, exp }`; validade de 1 a 24 h inteiras (a tela oferece 1, 8 e 24 h, decisão 2). A verificação compara a assinatura em tempo constante (`crypto.subtle.timingSafeEqual` do workerd) e confere formato, tipo, idioma e validade. Qualquer falha, ou artigo inexistente/excluído, dá o mesmo 404. Sem lista de revogação: trocar o segredo invalida todos os links (decisão 4). Pré-visualizar uma revisão específica fica para depois; o campo `t` permite isso sem invalidar links (decisão 5).
- **Segredo (decisão 3):** `PREVIEW_TOKEN_SECRET` exigido em preview e produção (≥ 32 caracteres, falha fechada); no local, sem o segredo, um valor aleatório por isolate.
- **Quem gera (decisão 1):** `article:update` (o `author` só nos próprios artigos), auditado como `article.preview_link_created` com a validade. A tela salva o pendente antes de gerar, e o link mostra sempre a cópia de trabalho mais recente.
- **Resposta:** `/preview/**` e `/api/preview/**` com `private, no-store` e `X-Robots-Tag: noindex, nofollow` (routeRules); `/preview/` entra nos prefixos que nunca são públicos, então não há `Cache-Tag` nem cache. A página tem uma faixa "Pré-visualização" com a validade em UTC (o fuso do site, Q-06, ainda não foi decidido).
- **Dados sem `useAsyncData`:** a página usa `useState` e um fetch no SSR. O primeiro uso de `useAsyncData` numa página pública de produção acrescentava cerca de 4,8 kB ao JS inicial de **todas** as rotas e levava o R3 a 120,8/120 (perf-log). A F06-T5 deve seguir o mesmo padrão ou rever o orçamento.

## Decisões da F07-T1

- **Um núcleo para artigos e projetos:** a cópia de trabalho (salvar com versão, autosave e revisão no mesmo `db.batch`, versões nomeadas, restaurar, slug livre) fica em `server/services/content/working-copy.{ts,repo.ts}`, escrita uma vez sobre `contentTables`. Publicar e despublicar usam um `PublishModel` por tipo (`publishing.service.ts`): o que muda entre artigo e projeto (entidade do snapshot, imagens que exigem alt, colunas `published_*`, relações publicadas, caminho público, tags de purge, ações de auditoria) é dado pelo modelo, e o batch protegido é o mesmo. Agendamento e cron continuam só para artigos.
- **Projetos:** o autor é o `created_by` (a tabela não tem `author_id`); `project_technologies` guarda a ordem escolhida em `position`; a galeria registra usos `gallery` e exige alt para publicar; o corpo de um projeto novo vem com as seções Contexto, Desafio, Solução e Resultados.
- **Admin:** histórico, diff e conflito recebem a lista de campos do tipo (`PROJECT_DIFF_FIELDS`), e o painel de publicação recebe a base da API e o recurso.

## Correção de contraste dos temas do Shiki (F05, depois da T5)

- **Problema:** com `github-light`/`github-dark`, os comentários no tema escuro (`#6a737d` sobre `#24292e`, 3,05:1) e os parâmetros e variáveis no claro (`#e36209` sobre `#fff`, 3,49:1) ficavam abaixo do AA (4,5:1, WCAG 1.4.3). O axe não pegava porque o fixture não tinha esses tokens.
- **Correção:** temas `github-light-default`/`github-dark-default`, os atuais do GitHub, no highlighter do admin e na allowlist de classes (`SHIKI_THEMES`). Os nomes antigos saíram da allowlist porque nenhum documento tinha sido gravado.
- **Regressão:** `tests/nuxt/highlight.test.ts` confere o contraste de toda cor de token contra o fundo do tema, claro e escuro, nas 18 linguagens, com amostras que têm comentários, strings, números e parâmetros. Com os temas antigos, 10 linguagens falhavam; com os novos, todas passam.

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
