<script setup lang="ts">
// Where a page puts a document. The renderer never hydrates (`hydrate-never` on the lazy component; the
// defineLazyHydrationComponent macro rendered nothing in SSR here, F05-T4): on a first visit the browser keeps the
// server's HTML and never downloads the renderer's chunk; after a client-side navigation it renders here. The two interactions
// (copy code, the gallery fallback) come from one small script loaded after mount, which works by delegation on
// this element, whichever way the content was rendered
import type { DocumentJson } from '#shared/content/document-schema'
import type { PublicMediaMap } from '#shared/media/public'

// `enhance: false` when a page enhances a wider root itself (the article page, F06-T5)
const props = withDefaults(defineProps<{ document: DocumentJson, media: PublicMediaMap, enhance?: boolean }>(), { enhance: true })

const root = useTemplateRef<HTMLElement>('root')

let cleanup: (() => void) | undefined
onMounted(async () => {
  if (!props.enhance) {
    return
  }
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
