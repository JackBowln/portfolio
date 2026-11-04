<script setup lang="ts">
// The home's published content (F08-T2): hero, narrative sections, featured projects, latest articles and the closing
// call. Static, so the page loads it with hydrate-never: none of this code (cards, images) is downloaded on a first
// visit, and its links work as plain links. data-motion marks the targets of the home's scenes (F10-T3,
// storyboard-home); they change nothing without motion, and the LCP title is never one of the hidden ones
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
const button = 'press inline-flex min-h-(--target-comfortable) items-center justify-self-start border border-text px-5 font-strong hover:border-accent hover:text-accent'
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
      <div
        v-if="page.blocks.hero.eyebrow"
        class="grid gap-3"
        data-motion="hero-eyebrow"
      >
        <p class="font-mono text-step--1 text-text-muted uppercase">
          {{ page.blocks.hero.eyebrow }}
        </p>
        <!-- The hairline draws itself in CSS under motion-ok (storyboard-home §2, decision 2); drawn otherwise -->
        <svg
          data-motion="hairline"
          class="h-px w-24 text-accent"
          viewBox="0 0 96 1"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <line
            x1="0"
            y1="0.5"
            x2="96"
            y2="0.5"
            pathLength="1"
          />
        </svg>
      </div>
      <UiHeading
        :level="1"
        :size="7"
        data-motion="hero-title"
      >
        {{ page.blocks.hero.title || settings.identity.name }}
      </UiHeading>
      <p
        v-if="page.blocks.hero.subtitle"
        class="max-w-(--container-reading) text-step-1 text-text-muted"
        data-motion="hero-subtitle"
      >
        {{ page.blocks.hero.subtitle }}
      </p>
      <UiLocalizedLink
        v-if="page.blocks.hero.cta.label"
        :to="LINKS[page.blocks.hero.cta.target]"
        :class="button"
        data-motion="hero-cta"
      >
        {{ page.blocks.hero.cta.label }}
      </UiLocalizedLink>
    </section>

    <!-- With 3 or more sections the story is pinned and scrubbed on desktop (storyboard-home §3, decision 3) -->
    <div
      v-if="page.blocks.sections.length > 0"
      class="relative grid gap-section"
      data-motion="story"
      :data-pin="page.blocks.sections.length >= 3 ? '' : undefined"
    >
      <span
        data-motion="story-progress"
        aria-hidden="true"
      />
      <section
        v-for="(section, index) in page.blocks.sections"
        :key="index"
        class="grid gap-4 border-t border-border pt-8 lg:grid-cols-12"
        :lang="page.fallback ? 'pt-BR' : undefined"
        data-motion="story-step"
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
    </div>

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
          data-motion="project-card"
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
          data-motion="article-card"
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
      data-motion="closing"
    >
      <UiHeading
        :level="2"
        :size="4"
        data-motion="closing-title"
      >
        {{ page.blocks.closing.title }}
      </UiHeading>
      <p
        v-if="page.blocks.closing.text"
        class="max-w-(--container-reading) text-text-muted"
        data-motion="closing-rest"
      >
        {{ page.blocks.closing.text }}
      </p>
      <UiLocalizedLink
        v-if="page.blocks.closing.cta.label"
        :to="LINKS[page.blocks.closing.cta.target]"
        :class="button"
        data-motion="closing-rest"
        data-magnetic
      >
        {{ page.blocks.closing.cta.label }}
      </UiLocalizedLink>
    </section>
  </div>
</template>
