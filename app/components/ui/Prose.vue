<script setup lang="ts">
// Long-form text (articles, case studies, institutional pages): reading measure, rhythm and inline elements.
// The content renderer (F06) places its output here; the styles are unscoped so they reach slotted markup
withDefaults(defineProps<{ as?: string }>(), { as: 'div' })
</script>

<template>
  <component
    :is="as"
    class="ui-prose"
  >
    <slot />
  </component>
</template>

<style>
.ui-prose {
  max-inline-size: var(--container-reading);
  font-size: var(--text-step-0);
  line-height: var(--text-step-0--line-height);
  text-wrap: pretty;
}

.ui-prose > * + * {
  margin-block-start: calc(var(--spacing) * 5);
}

.ui-prose :where(h2, h3, h4) {
  margin-block-start: calc(var(--spacing) * 12);
  font-family: var(--font-display);
  font-weight: var(--font-weight-regular);
  text-wrap: balance;
}

.ui-prose h2 {
  font-size: var(--text-step-3);
  line-height: var(--text-step-3--line-height);
  letter-spacing: var(--text-step-3--letter-spacing);
}

.ui-prose :where(h3, h4) {
  font-size: var(--text-step-2);
  line-height: var(--text-step-2--line-height);
}

.ui-prose :where(h2, h3, h4) + * {
  margin-block-start: calc(var(--spacing) * 3);
}

.ui-prose a {
  color: var(--color-accent);
  text-decoration-line: underline;
  transition: background-color var(--dur-instant) var(--ease-out), color var(--dur-instant) var(--ease-out);
}

.ui-prose a:hover {
  background-color: var(--color-accent);
  color: var(--color-accent-contrast);
  text-decoration-line: none;
}

.ui-prose :where(ul, ol) {
  padding-inline-start: calc(var(--spacing) * 6);
}

.ui-prose ul {
  list-style-type: disc;
}

.ui-prose ol {
  list-style-type: decimal;
}

.ui-prose li + li {
  margin-block-start: calc(var(--spacing) * 2);
}

.ui-prose li::marker {
  color: var(--color-text-muted);
}

.ui-prose blockquote {
  padding-inline-start: calc(var(--spacing) * 5);
  border-inline-start: var(--focus-ring-width) solid var(--color-accent);
  font-family: var(--font-display);
  font-size: var(--text-step-1);
  line-height: var(--text-step-1--line-height);
}

.ui-prose :not(pre) > code {
  padding-inline: calc(var(--spacing) * 1);
  background: var(--color-surface);
  font-family: var(--font-mono);
  font-size: var(--code-inline-size);
}

.ui-prose strong {
  font-weight: var(--font-weight-strong);
}

.ui-prose hr {
  border: 0;
  border-block-start: var(--border-hairline) solid var(--color-border);
}
</style>
