<script setup lang="ts">
// A topic (F06-T5): its published articles in the locale, paginated like the blog. Exists only in a locale where
// the topic has a name and at least one article; hreflang and the language switcher link the locales where it exists
// (F11-T3), and send the others to the blog
import type { BlogTopicPage } from '#shared/content/blog'
import { parsePage, priorityCover } from '#shared/content/blog'
import BlogCard from '~/components/blog/BlogCard.vue'
import BlogPagination from '~/components/blog/BlogPagination.vue'

definePageMeta({
  key: route => route.fullPath,
  i18n: { paths: { 'pt-BR': '/blog/temas/[slug]', 'en': '/blog/topics/[slug]', 'es': '/blog/temas/[slug]', 'de': '/blog/themen/[slug]', 'fr': '/blog/sujets/[slug]' } },
})

const { locale, t } = useI18n()
const route = useRoute()
const slug = String(route.params.slug)
const page = parsePage(route.query.page)
if (page === null) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
}
const data = await usePublicData<BlogTopicPage>(`topic:${locale.value}:${slug}:${page}`, `/api/public/blog/topics/${encodeURIComponent(slug)}`, { locale: locale.value, page })

// Topic slugs are per locale
const setI18nParams = useSetI18nParams()
setI18nParams(Object.fromEntries(data.value.alternates.map(alternate => [alternate.locale, { slug: alternate.slug }])))
useLocaleFallback(data.value.alternates.map(alternate => alternate.locale), '/blog')

usePageSeo({
  title: () => t('blog.topicTitle', { name: data.value.topic.name }),
  description: () => t('blog.topicIntro', { name: data.value.topic.name }),
  published: () => data.value.alternates.map(alternate => alternate.locale),
  page,
})
// JSON-LD from the response (F11-T1)
useJsonLd(() => data.value.jsonLd)
useBlogFeed()
</script>

<template>
  <div class="grid gap-10">
    <header class="grid gap-4">
      <p>
        <NuxtLinkLocale
          to="/blog"
          class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
        >
          {{ $t('blog.back') }}
        </NuxtLinkLocale>
      </p>
      <UiHeading :level="1">
        {{ $t('blog.topicTitle', { name: data.topic.name }) }}
      </UiHeading>
      <p class="text-text-muted">
        {{ $t('blog.topicCount', { count: data.total }, data.total) }}
      </p>
    </header>
    <section
      class="grid gap-8"
      :aria-label="$t('blog.topicTitle', { name: data.topic.name })"
    >
      <BlogCard
        v-for="(card, index) in data.items"
        :key="card.slug"
        :card="card"
        wide
        :priority="index === priorityCover(data.items)"
      />
    </section>
    <BlogPagination
      :page="data.page"
      :pages="data.pages"
    />
  </div>
</template>
