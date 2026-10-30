<script setup lang="ts">
// One project in a list (F07-T2): the cover, the title as the link, the summary, the period and the technologies.
// `wide` for the featured first card, which spans the container; `priority` for the card whose cover is the LCP
import { IMAGE_SIZES } from '#shared/design/tokens'
import type { ProjectCard } from '#shared/content/projects-public'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'

withDefaults(defineProps<{ card: ProjectCard, level?: 2 | 3, wide?: boolean, priority?: boolean }>(), { level: 2, wide: false, priority: false })
const formatPeriod = useFormatPeriod()
</script>

<template>
  <article class="grid content-start gap-3 border-t border-border pt-6">
    <ResponsiveImage
      v-if="card.cover"
      :image="card.cover"
      :sizes="wide ? IMAGE_SIZES.wide : IMAGE_SIZES.half"
      :priority="priority"
    />
    <UiHeading
      :level="level"
      :size="wide ? 4 : 3"
    >
      <NuxtLinkLocale
        :to="{ name: 'projetos-slug', params: { slug: card.slug } }"
        class="underline-offset-(--underline-offset) hover:text-accent hover:underline"
      >
        {{ card.title }}
      </NuxtLinkLocale>
    </UiHeading>
    <p
      v-if="card.summary"
      class="text-text-muted"
    >
      {{ card.summary }}
    </p>
    <p
      v-if="card.periodStart || card.periodEnd || card.technologies.length > 0"
      class="text-step--1 text-text-muted"
    >
      <span v-if="card.periodStart || card.periodEnd">{{ formatPeriod(card.periodStart, card.periodEnd) }}</span>
      <template v-if="(card.periodStart || card.periodEnd) && card.technologies.length > 0">
        ·
      </template>
      <span v-if="card.technologies.length > 0">{{ card.technologies.map(item => item.name).join(', ') }}</span>
    </p>
  </article>
</template>
