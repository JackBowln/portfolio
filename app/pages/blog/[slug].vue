<script setup lang="ts">
// An article (F06-T5, RF-01.5): the published snapshot in the reading layout, with dates, reading time, topics, a
// table of contents and related articles. hreflang and the language switcher list only the published locales
// (useSetI18nParams); in a locale where it is not published, the URL is 404. No motion and no content JS (RX-04):
// the article itself never hydrates (BlogArticleBody, hydrate-never); only the enhancement script runs, on this root
import type { BlogArticle } from '#shared/content/blog'

definePageMeta({ layout: 'reading', key: route => route.fullPath })

const { locale } = useI18n()
const route = useRoute()
const slug = String(route.params.slug)
const data = await usePublicData<BlogArticle>(`article:${locale.value}:${slug}`, `/api/public/blog/${encodeURIComponent(slug)}`, { locale: locale.value })

const setI18nParams = useSetI18nParams()
setI18nParams(Object.fromEntries(data.value.alternates.map(alternate => [alternate.locale, { slug: alternate.slug }])))
useLocaleFallback(data.value.alternates.map(alternate => alternate.locale), '/blog')

usePageSeo({
  title: () => data.value.seo.title,
  description: () => data.value.seo.description,
  published: () => data.value.alternates.map(alternate => alternate.locale),
  type: 'article',
  noindex: () => data.value.seo.noindex,
  publishedTime: () => data.value.firstPublishedAt,
  modifiedTime: () => data.value.publishedAt,
})
// JSON-LD from the response (F11-T1)
useJsonLd(() => data.value.jsonLd)
useBlogFeed()

// Copy, gallery and video facades, by delegation, whichever way the article was rendered
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
  <div
    ref="root"
    class="grid gap-10"
  >
    <p>
      <NuxtLinkLocale
        to="/blog"
        class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
      >
        {{ $t('blog.back') }}
      </NuxtLinkLocale>
    </p>
    <LazyBlogArticleBody
      hydrate-never
      :article="data"
    />
  </div>
</template>
