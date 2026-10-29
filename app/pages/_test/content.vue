<script setup lang="ts">
// Test-only fixture: exists only in the Playwright build (`ignore: **/_test/**`). The document with every node
// type in the article's layout, rendered by StaticContent as a public page will (F05-T4). The query names the
// media the test created (photo, second, third, clip, poster) and is passed on to the fixture endpoint
import type { DocumentJson } from '#shared/content/document-schema'
import type { PublicMediaMap } from '#shared/media/public'
import StaticContent from '~/components/content/StaticContent.vue'

definePageMeta({ layout: 'reading' })

const route = useRoute()
const { locale } = useI18n()
const requestFetch = useRequestFetch()
const { data } = await useAsyncData('test-content', () => requestFetch<{ document: DocumentJson, media: PublicMediaMap }>('/api/_test/content', {
  query: { ...route.query, locale: locale.value },
}))

useHead({ title: 'TEST content', meta: [{ name: 'description', content: 'TEST content renderer page' }, { name: 'robots', content: 'noindex' }] })
</script>

<template>
  <article>
    <h1>TEST content</h1>
    <StaticContent
      v-if="data"
      :document="data.document"
      :media="data.media"
    />
  </article>
</template>
