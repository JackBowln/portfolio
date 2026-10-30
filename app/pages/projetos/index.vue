<script setup lang="ts">
// Projects (F07-T2, RF-01.3, RF-09.3): the locale's published projects in the manual order, the first one featured
// across the container, and the technologies as a filter (?tech=<slug>, plain links that work without JS). A filtered
// list is noindex and its canonical is the whole list; an unknown technology is 404, and so is an empty one
import { priorityCover } from '#shared/content/blog'
import type { ProjectList } from '#shared/content/projects-public'
import { parseTechnology } from '#shared/content/projects-public'
import ProjectCard from '~/components/projects/ProjectCard.vue'
import TechnologyFilter from '~/components/projects/TechnologyFilter.vue'

definePageMeta({
  key: route => route.fullPath,
  i18n: {
    paths: {
      'pt-BR': '/projetos',
      'en': '/projects',
      'es': '/proyectos',
      'de': '/projekte',
      'fr': '/projets',
    },
  },
})

const { locale, t } = useI18n()
const route = useRoute()
const tech = parseTechnology(route.query.tech)
if (tech === null) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
}
const data = await usePublicData<ProjectList>(`projects:${locale.value}:${tech ?? ''}`, '/api/public/projects', { locale: locale.value, tech })

const title = computed(() => (data.value.technology ? t('projects.filtered', { name: data.value.technology.name }) : t('projects.title')))
usePageSeo({
  title: () => title.value,
  description: () => t('projects.intro'),
  noindex: () => data.value.technology !== null || data.value.items.length === 0,
})
</script>

<template>
  <div class="grid gap-10">
    <header class="grid gap-4">
      <UiHeading :level="1">
        {{ title }}
      </UiHeading>
      <p class="text-text-muted">
        {{ $t('projects.intro') }}
      </p>
      <TechnologyFilter
        :technologies="data.technologies"
        :active="data.technology?.slug ?? null"
      />
      <p
        v-if="data.technology"
        class="text-step--1 text-text-muted"
      >
        {{ $t('projects.count', { count: data.items.length }, data.items.length) }}
      </p>
    </header>
    <p v-if="data.items.length === 0">
      {{ $t('projects.empty') }}
    </p>
    <section
      v-else
      class="grid gap-x-8 gap-y-12 lg:grid-cols-2"
      :aria-label="title"
    >
      <ProjectCard
        v-for="(card, index) in data.items"
        :key="card.slug"
        :card="card"
        :wide="index === 0"
        :class="index === 0 ? 'lg:col-span-2' : undefined"
        :priority="index === priorityCover(data.items)"
      />
    </section>
  </div>
</template>
