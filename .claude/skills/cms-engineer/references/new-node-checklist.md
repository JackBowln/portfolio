# Checklist: novo tipo de nó ou bloco no documento

Um nó só existe quando os 6 passos estão feitos e testados. Faltou um passo, o nó não entra.

1. **Schema** (`shared/content/document-schema.ts`)
   - [ ] Tipo, atributos (com validação: URLs por protocolo, IDs de mídia existentes, enums fechados) e filhos permitidos.
   - [ ] `id` estável (UniqueID) se for um bloco.
   - [ ] Se mudar documentos existentes: `schemaVersion` incrementado e migrador em `shared/content/migrations/`, com teste.
2. **Editor** (`app/components/admin/editor/extensions/`)
   - [ ] Extensão Tiptap (só MIT) que serializa **exatamente** no formato do schema.
   - [ ] Interface acessível (botão com rótulo, atalho documentado, alternativa por teclado ao arrastar).
   - [ ] Colar ou importar conteúdo gera o nó válido ou o descarta.
3. **Validação no servidor**
   - [ ] Coberta pelo schema `strict`; casos maliciosos adicionados à matriz de testes (atributo extra, URL `javascript:`, ID inexistente).
4. **Renderer público** (`app/components/content/nodes/`)
   - [ ] Componente Vue estático, sem `v-html` e sem hidratação (ilha só se for interativo, carregada sob demanda).
   - [ ] Semântica e a11y (figure/figcaption, `alt` do idioma, títulos de iframes).
   - [ ] Sem CLS (dimensões e proporção reservadas).
5. **Tradução** (`shared/content/segmenter.ts`)
   - [ ] Define o que é segmento traduzível, o que é protegido (código, URLs, IDs) e como as marcas inline viram placeholders.
   - [ ] Ida e volta (extrair → reinserir) = identidade, com teste de propriedade atualizado.
6. **Derivados e uso**
   - [ ] `derive.ts` conta palavras, gera âncoras e registra `media_usages` quando o nó referencia mídia.
   - [ ] Snapshot do renderer + testes de schema + teste E2E inserindo o nó no editor.

Embeds novos (provedor fora da allowlist) exigem ADR (ADR-0012: `frame-src`).
