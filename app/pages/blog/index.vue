<script setup lang="ts">
// The blog (F06-T5, RF-01.4): the locale's published articles, newest first, 10 per page (?page=N, canonical keeps
// it from page 2), the topics with articles as links, and the RSS in the head. A page past the last is 404; an
// empty blog is noindex. Only published snapshots are read (/api/public)
import type { BlogList } from '#shared/content/blog'
import type { PageBlocks } from '#shared/pages/blocks'
import type { PublicPage } from '#shared/pages/public'
import { parsePage, priorityCover } from '#shared/content/blog'
import BlogCard from '~/components/blog/BlogCard.vue'
import BlogPagination from '~/components/blog/BlogPagination.vue'
import TopicLinks from '~/components/blog/TopicLinks.vue'

definePageMeta({ key: route => route.fullPath })

const { locale, t } = useI18n()
const route = useRoute()
const page = parsePage(route.query.page)
if (page === null) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
}
const data = await usePublicData<BlogList>(`blog:${locale.value}:${page}`, '/api/public/blog', { locale: locale.value, page })
// The index's own title and introduction, from the page of blocks (F08-T2)
const intro = await usePublicData<PublicPage<PageBlocks<'blog'>>>(`page:blog:${locale.value}`, '/api/public/pages/blog', { locale: locale.value })
const title = computed(() => intro.value.blocks?.title || t('blog.title'))
const settings = useSiteSettings()

usePageSeo({
  title: () => (page > 1 ? `${title.value} — ${t('blog.page', { page, pages: data.value.pages })}` : title.value),
  description: () => intro.value.blocks?.intro || settings.value.seo.description,
  page,
  noindex: () => data.value.total === 0,
})
useBlogFeed()
</script>

<template>
  <div class="grid gap-10">
    <header class="grid gap-4">
      <UiHeading :level="1">
        {{ title }}
      </UiHeading>
      <p
        v-if="intro.blocks?.intro"
        class="text-text-muted"
        :lang="intro.fallback ? 'pt-BR' : undefined"
      >
        {{ intro.blocks.intro }}
      </p>
      <TopicLinks
        :topics="data.topics"
        :label="$t('blog.topicsLabel')"
      />
    </header>
    <p v-if="data.items.length === 0">
      {{ $t('blog.empty') }}
    </p>
    <section
      v-else
      class="grid gap-8"
      :aria-label="$t('blog.title')"
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
