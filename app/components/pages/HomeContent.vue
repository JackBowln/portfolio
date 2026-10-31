<script setup lang="ts">
// The home's published content (F08-T2): hero, narrative sections, featured projects, latest articles and the closing
// call. Static, so the page loads it with hydrate-never: none of this code (cards, images) is downloaded on a first
// visit, and its links work as plain links
import type { PageBlocks } from '#shared/pages/blocks'
import type { PublicPage } from '#shared/pages/public'
import { paragraphs } from '#shared/pages/public'
import BlogCard from '~/components/blog/BlogCard.vue'
import FallbackNotice from '~/components/pages/FallbackNotice.vue'
import ProjectCard from '~/components/projects/ProjectCard.vue'

defineProps<{ page: PublicPage<PageBlocks<'home'>> & { blocks: PageBlocks<'home'> } }>()
const settings = useSiteSettings()
const LINKS = { projects: '/projetos', blog: '/blog', about: '/sobre', contact: '/contato' } as const
const ids = { featured: useId(), articles: useId() }
const button = 'inline-flex min-h-(--target-comfortable) items-center justify-self-start border border-text px-5 font-strong hover:border-accent hover:text-accent'
</script>

<template>
  <div
    class="grid gap-section"
  >
    <FallbackNotice v-if="page.fallback" />
    <section
      class="grid max-w-5xl gap-6"
      :lang="page.fallback ? 'pt-BR' : undefined"
    >
      <p
        v-if="page.blocks.hero.eyebrow"
        class="font-mono text-step--1 text-text-muted uppercase"
      >
        {{ page.blocks.hero.eyebrow }}
      </p>
      <UiHeading
        :level="1"
        :size="7"
      >
        {{ page.blocks.hero.title || settings.identity.name }}
      </UiHeading>
      <p
        v-if="page.blocks.hero.subtitle"
        class="max-w-(--container-reading) text-step-1 text-text-muted"
      >
        {{ page.blocks.hero.subtitle }}
      </p>
      <UiLocalizedLink
        v-if="page.blocks.hero.cta.label"
        :to="LINKS[page.blocks.hero.cta.target]"
        :class="button"
      >
        {{ page.blocks.hero.cta.label }}
      </UiLocalizedLink>
    </section>

    <section
      v-for="(section, index) in page.blocks.sections"
      :key="index"
      class="grid gap-4 border-t border-border pt-8 lg:grid-cols-12"
      :lang="page.fallback ? 'pt-BR' : undefined"
    >
      <UiHeading
        :level="2"
        :size="4"
        class="lg:col-span-5"
      >
        {{ section.title }}
      </UiHeading>
      <div class="grid gap-4 lg:col-span-7">
        <p
          v-for="(text, position) in paragraphs(section.text)"
          :key="position"
        >
          {{ text }}
        </p>
      </div>
    </section>

    <section
      v-if="page.home && page.home.projects.length > 0"
      class="grid gap-8"
      :aria-labelledby="ids.featured"
    >
      <UiHeading
        :id="ids.featured"
        :level="2"
        :size="4"
      >
        {{ page.blocks.featuredTitle || $t('pages.home.featured') }}
      </UiHeading>
      <div class="grid gap-x-8 gap-y-12 lg:grid-cols-2">
        <ProjectCard
          v-for="card in page.home.projects"
          :key="card.slug"
          :card="card"
          :level="3"
        />
      </div>
      <UiLocalizedLink
        to="/projetos"
        class="justify-self-start underline underline-offset-(--underline-offset) hover:text-accent"
      >
        {{ $t('pages.home.more') }} — {{ $t('projects.title') }}
      </UiLocalizedLink>
    </section>

    <section
      v-if="page.home && page.home.articles.length > 0"
      class="grid gap-8"
      :aria-labelledby="ids.articles"
    >
      <UiHeading
        :id="ids.articles"
        :level="2"
        :size="4"
      >
        {{ page.blocks.articlesTitle || $t('pages.home.articles') }}
      </UiHeading>
      <div class="grid gap-8">
        <BlogCard
          v-for="card in page.home.articles"
          :key="card.slug"
          :card="card"
          :level="3"
        />
      </div>
      <UiLocalizedLink
        to="/blog"
        class="justify-self-start underline underline-offset-(--underline-offset) hover:text-accent"
      >
        {{ $t('pages.home.more') }} — {{ $t('blog.title') }}
      </UiLocalizedLink>
    </section>

    <section
      v-if="page.blocks.closing.title"
      class="grid gap-4 border-t border-border pt-8"
      :lang="page.fallback ? 'pt-BR' : undefined"
    >
      <UiHeading
        :level="2"
        :size="4"
      >
        {{ page.blocks.closing.title }}
      </UiHeading>
      <p
        v-if="page.blocks.closing.text"
        class="max-w-(--container-reading) text-text-muted"
      >
        {{ page.blocks.closing.text }}
      </p>
      <UiLocalizedLink
        v-if="page.blocks.closing.cta.label"
        :to="LINKS[page.blocks.closing.cta.target]"
        :class="button"
      >
        {{ page.blocks.closing.cta.label }}
      </UiLocalizedLink>
    </section>
  </div>
</template>
