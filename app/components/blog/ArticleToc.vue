<script setup lang="ts">
// "In this article": the h2 and h3 of the body, linked to the same anchors the renderer sets (shared/content/anchors)
import type { DocumentJson } from '#shared/content/document-schema'
import { headingAnchors } from '#shared/content/anchors'
import { inlineText } from '#shared/content/inline-text'

const props = defineProps<{ body: DocumentJson }>()

const entries = computed(() => {
  const anchors = headingAnchors(props.body)
  return props.body.content.flatMap(block => block.type === 'heading' && block.attrs.level <= 3
    ? [{ anchor: anchors.get(block.attrs.id)!, level: block.attrs.level, text: inlineText(block.content).trim() }]
    : [])
})
const titleId = useId()
</script>

<template>
  <nav
    v-if="entries.length > 1"
    class="grid gap-2 border-s-2 border-border ps-4"
    :aria-labelledby="titleId"
  >
    <p
      :id="titleId"
      class="text-step--1 font-strong"
    >
      {{ $t('blog.toc') }}
    </p>
    <ol class="grid gap-1 text-step--1">
      <li
        v-for="entry in entries"
        :key="entry.anchor"
        :class="{ 'ps-4': entry.level === 3 }"
      >
        <a
          :href="`#${entry.anchor}`"
          class="inline-flex min-h-(--target-min) items-center underline-offset-(--underline-offset) hover:text-accent hover:underline"
        >{{ entry.text }}</a>
      </li>
    </ol>
  </nav>
</template>
