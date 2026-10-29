<script setup lang="ts">
// A code block: the language as the figure's caption and the group's name (so it is announced), the highlighted
// HAST, and a copy button that CSS hides until the enhancement script (utils/content/enhance.ts) has loaded, so
// without JS there is no dead control. HAST that fails the allowlist falls back to the plain code
import { codeLanguageName } from '#shared/content/code-languages'
import { hastIssues, plainHast } from '#shared/content/hast'
import type { HastElement } from '#shared/content/hast'
import HastNode from '../HastNode'

const props = defineProps<{ node: Record<string, unknown> }>()
const { t } = useI18n()

const code = computed(() => (typeof props.node.code === 'string' ? props.node.code : ''))
const hast = computed(() => (hastIssues(props.node.hast).length === 0 ? props.node.hast as HastElement : plainHast(code.value)))
const language = computed(() => codeLanguageName(String(props.node.language ?? '')) ?? t('content.code.plain'))
</script>

<template>
  <figure class="content-code">
    <figcaption class="content-code-bar">
      <span>{{ language }}</span>
      <button
        type="button"
        class="content-code-copy"
        data-content-copy
        :data-copied="t('content.code.copied')"
      >
        {{ t('content.code.copy') }}
      </button>
      <span
        class="sr-only"
        role="status"
        data-content-copy-status
      />
    </figcaption>
    <div
      class="content-code-body"
      role="group"
      tabindex="0"
      :aria-label="t('content.code.label', { language })"
    >
      <HastNode :hast="hast" />
    </div>
  </figure>
</template>
