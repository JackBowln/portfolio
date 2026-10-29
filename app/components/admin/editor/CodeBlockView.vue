<script setup lang="ts">
// Admin-only. Node view of a code block: the language and a plain <textarea> for the code, with Shiki's preview
// under it. Every edit stores the code with plain HAST at once (always valid), then the highlighted HAST replaces
// it if the code has not changed meanwhile
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { nodeViewId } from './node-view-id'
import { hastIssues, plainHast } from '#shared/content/hast'
import type { HastElement } from '#shared/content/hast'
import { CODE_LANGUAGES, isCodeLanguage } from '~/utils/admin/code-languages'
import type { CodeLanguage } from '~/utils/admin/code-languages'
import { highlightCode } from '~/utils/admin/highlight'
import HastNode from '~/components/content/HastNode'

const props = defineProps(nodeViewProps)
const { t } = useI18n()
const languageId = nodeViewId('languageId')
const codeId = nodeViewId('codeId')

const language = computed<CodeLanguage>(() => (isCodeLanguage(props.node.attrs.language) ? props.node.attrs.language : 'text'))
const code = computed<string>(() => props.node.attrs.code)
const hast = computed(() => props.node.attrs.hast as HastElement)
const highlighted = computed(() => hastIssues(hast.value).length === 0 && hast.value.children[0]?.type === 'element' && hast.value.properties.class !== undefined)
const failed = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined
function store(next: { code?: string, language?: CodeLanguage }) {
  const value = { code: next.code ?? code.value, language: next.language ?? language.value }
  props.updateAttributes({ ...value, hast: plainHast(value.code) })
  clearTimeout(timer)
  timer = setTimeout(() => highlight(value.code, value.language), 250)
}

async function highlight(source: string, lang: CodeLanguage) {
  try {
    const result = await highlightCode(source, lang)
    failed.value = false
    if (props.node.attrs.code === source && props.node.attrs.language === lang) {
      props.updateAttributes({ hast: result })
    }
  }
  catch {
    failed.value = true
  }
}

// A pasted <pre> arrives with plain HAST: highlight it once
onMounted(() => {
  if (!highlighted.value && code.value !== '') {
    void highlight(code.value, language.value)
  }
})
onBeforeUnmount(() => clearTimeout(timer))

const languages = Object.entries(CODE_LANGUAGES).map(([id, name]) => ({ id, name: name ?? t('admin.editor.code.plain') }))
</script>

<template>
  <NodeViewWrapper
    as="div"
    class="my-4 grid gap-2 border border-border p-3"
    :class="{ 'outline-2 outline-focus': selected }"
    data-node-view="codeBlock"
  >
    <div
      class="flex flex-wrap items-end gap-3"
      contenteditable="false"
    >
      <div class="grid gap-1">
        <label
          :for="languageId"
          class="text-step--1 font-strong"
        >{{ $t('admin.editor.code.language') }}</label>
        <select
          :id="languageId"
          :value="language"
          class="min-h-(--target-min) border border-border bg-bg px-2 text-step--1"
          @change="store({ language: ($event.target as HTMLSelectElement).value as CodeLanguage })"
        >
          <option
            v-for="item in languages"
            :key="item.id"
            :value="item.id"
          >
            {{ item.name }}
          </option>
        </select>
      </div>
      <UiButton
        variant="ghost"
        size="sm"
        @click="deleteNode()"
      >
        {{ $t('admin.editor.removeBlock') }}
      </UiButton>
    </div>
    <div
      class="grid gap-1"
      contenteditable="false"
    >
      <label
        :for="codeId"
        class="text-step--1 font-strong"
      >{{ $t('admin.editor.code.source') }}</label>
      <textarea
        :id="codeId"
        :value="code"
        rows="6"
        spellcheck="false"
        autocapitalize="off"
        class="w-full resize-y border border-border bg-bg p-2 font-mono text-step--1"
        @input="store({ code: ($event.target as HTMLTextAreaElement).value })"
        @keydown.tab.stop
      />
    </div>
    <p
      v-if="failed"
      role="status"
      class="text-step--1 text-danger"
    >
      {{ $t('admin.editor.code.failed') }}
    </p>
    <div
      v-else-if="highlighted && code"
      contenteditable="false"
      class="editor-code-preview overflow-x-auto text-step--1"
      :aria-label="$t('admin.editor.code.preview')"
      role="group"
    >
      <HastNode :hast="hast" />
    </div>
  </NodeViewWrapper>
</template>
