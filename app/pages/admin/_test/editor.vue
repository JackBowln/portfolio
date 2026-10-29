<script setup lang="ts">
// Test-only (PORTFOLIO_TEST_BUILD=1): the editor with a save stub, for the F05-T3 E2E and axe checks. The real
// screens that use it (articles, projects) come with F06
import type { DocumentJson } from '#shared/content/document-schema'
import { adminFetch } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })
useHead({ title: 'Editor (teste)', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const ContentEditor = defineAsyncComponent(() => import('~/components/admin/editor/ContentEditor.vue'))
const doc = ref<DocumentJson>()
const result = ref<string>()

async function save() {
  const response = await adminFetch.raw('/api/_test/document', { method: 'POST', body: doc.value, ignoreResponseError: true })
  result.value = JSON.stringify(response._data)
}
</script>

<template>
  <div class="grid gap-6">
    <UiHeading :level="1">
      Editor (teste)
    </UiHeading>
    <ContentEditor
      v-model="doc"
      label="Corpo do documento"
    />
    <UiButton
      class="justify-self-start"
      @click="save"
    >
      Validar
    </UiButton>
    <output
      data-testid="save-result"
      class="font-mono text-step--1 break-all"
    >{{ result }}</output>
  </div>
</template>
