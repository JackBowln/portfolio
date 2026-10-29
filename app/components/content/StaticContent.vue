<script setup lang="ts">
// Where a page puts a document. The renderer never hydrates (`hydrate-never` on the lazy component; the
// defineLazyHydrationComponent macro rendered nothing in SSR here, F05-T4): on a first visit the browser keeps the
// server's HTML and never downloads the renderer's chunk; after a client-side navigation it renders here. The two interactions
// (copy code, the gallery fallback) come from one small script loaded after mount, which works by delegation on
// this element, whichever way the content was rendered
import type { DocumentJson } from '#shared/content/document-schema'
import type { PublicMediaMap } from '#shared/media/public'

defineProps<{ document: DocumentJson, media: PublicMediaMap }>()

const root = useTemplateRef<HTMLElement>('root')

let cleanup: (() => void) | undefined
onMounted(async () => {
  const { enhanceContent } = await import('~/utils/content/enhance')
  if (root.value) {
    cleanup = enhanceContent(root.value)
  }
})
onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <div ref="root">
    <LazyContentRenderer
      hydrate-never
      :document="document"
      :media="media"
    />
  </div>
</template>

<style>
/* Document blocks, global and in the page's CSS: the renderer's own chunk never loads on a first visit. The prose
   rhythm (headings, lists, quotes, inline code) comes from UiProse */
.content .content-anchor {
  margin-inline-start: 0.35em;
  color: var(--color-text-muted);
  text-decoration-line: none;
}

.content .content-anchor:hover {
  background: none;
  color: var(--color-accent);
}

.content :where(figure) {
  display: grid;
  gap: calc(var(--spacing) * 2);
}

.content :where(figcaption) {
  color: var(--color-text-muted);
  font-size: var(--text-step--1);
  line-height: var(--text-step--1--line-height);
}

.content .content-credit::before {
  content: " · ";
}

/* Code: Shiki's two themes as CSS variables on every token (defaultColor: false), picked by the color scheme */
.content-code {
  border: var(--border-hairline) solid var(--color-border);
}

.content .content-code-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--spacing) * 3);
  padding-inline: calc(var(--spacing) * 3);
  min-block-size: var(--target-comfortable);
  border-block-end: var(--border-hairline) solid var(--color-border);
  color: var(--color-text);
  font-family: var(--font-mono);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.content-code-copy {
  display: none;
  align-items: center;
  min-block-size: var(--target-min);
  padding-inline: calc(var(--spacing) * 2);
  border: var(--border-hairline) solid var(--color-border);
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
}

.content-code-copy:hover {
  background: var(--color-surface);
}

.content-can-copy .content-code-copy {
  display: inline-flex;
}

.content-code-body {
  overflow-x: auto;
}

.content-code-body pre {
  min-inline-size: max-content;
  padding: calc(var(--spacing) * 4);
  background: light-dark(var(--shiki-light-bg, var(--color-bg)), var(--shiki-dark-bg, var(--color-bg)));
  font-family: var(--font-mono);
  font-size: var(--text-step--1);
  line-height: 1.7;
}

.content-code-body span {
  color: light-dark(var(--shiki-light, var(--color-text)), var(--shiki-dark, var(--color-text)));
  font-style: var(--shiki-light-font-style);
}

/* light-dark() takes colors only: the dark font style follows the same theme rules as main.css */
:root[data-theme="dark"] .content-code-body span {
  font-style: var(--shiki-dark-font-style);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .content-code-body span {
    font-style: var(--shiki-dark-font-style);
  }
}

/* Callouts: the tone is the label's word and the rule's color */
.content-callout {
  display: grid;
  gap: calc(var(--spacing) * 3);
  padding: calc(var(--spacing) * 4) calc(var(--spacing) * 5);
  border-inline-start: calc(var(--focus-ring-width) * 2) solid var(--tone);
  background: var(--color-surface);
  --tone: var(--color-accent);
}

.content-callout[data-tone="tip"] {
  --tone: var(--color-success);
}

.content-callout[data-tone="warning"] {
  --tone: var(--color-warning);
}

.content-callout[data-tone="danger"] {
  --tone: var(--color-danger);
}

.content .content-callout-label {
  font-size: var(--text-step--1);
  font-weight: var(--font-weight-strong);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.content-table {
  overflow-x: auto;
}

.content-table table {
  min-inline-size: 100%;
  border-collapse: collapse;
  font-size: var(--text-step--1);
  line-height: var(--text-step--1--line-height);
}

.content-table :where(th, td) {
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  border: var(--border-hairline) solid var(--color-border);
  text-align: start;
  vertical-align: top;
}

.content-table th {
  font-weight: var(--font-weight-strong);
}

/* Galleries: a grid of cropped thumbnails or a stack at full width */
.content-gallery ul {
  display: grid;
  gap: calc(var(--spacing) * 3);
  padding: 0;
  list-style: none;
}

.content-gallery[data-layout="grid"] ul {
  grid-template-columns: repeat(auto-fill, minmax(min(10rem, 100%), 1fr));
}

.content-gallery li + li {
  margin-block-start: 0;
}

.content-gallery-open {
  display: block;
  inline-size: 100%;
  cursor: zoom-in;
}

.content-gallery[data-layout="grid"] .content-gallery-open {
  aspect-ratio: 4 / 3;
}

.content-gallery-dialog {
  max-inline-size: 100vw;
  max-block-size: 100dvh;
  margin: auto;
  padding: calc(var(--spacing) * 4);
  background: var(--color-bg);
  color: var(--color-text);
}

.content-gallery-dialog::backdrop {
  background: oklch(0.16 0.03 250 / 0.8);
}

.content-gallery-dialog img {
  max-block-size: calc(100dvh - 8rem);
  inline-size: auto;
}

.content-gallery-close {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--target-comfortable);
  padding-inline: calc(var(--spacing) * 3);
  margin-block-end: calc(var(--spacing) * 3);
  border: var(--border-hairline) solid var(--color-border);
}

.content-embed a {
  display: grid;
  gap: calc(var(--spacing) * 2);
}
</style>
