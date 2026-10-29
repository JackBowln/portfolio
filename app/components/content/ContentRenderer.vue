<script setup lang="ts">
// A document as static HTML (ADR-0006 §5, F05-T4): node → element, no v-html, and no hydration (StaticContent
// loads it with hydrate-never, so on a first visit its code is never downloaded). Its styles are global for the
// same reason: a component that never hydrates must not depend on a chunk the browser never fetches
import type { DocumentJson } from '#shared/content/document-schema'
import { headingAnchors } from '#shared/content/anchors'
import type { PublicMediaMap } from '#shared/media/public'
import ContentBlocks from './ContentBlocks'
import { CONTENT_CONTEXT } from './context'

const props = defineProps<{ document: DocumentJson, media: PublicMediaMap }>()
const { public: { siteUrl } } = useRuntimeConfig()

provide(CONTENT_CONTEXT, {
  media: props.media,
  anchors: headingAnchors(props.document),
  siteUrl,
})
</script>

<template>
  <UiProse class="content">
    <ContentBlocks :nodes="document.content" />
  </UiProse>
</template>
