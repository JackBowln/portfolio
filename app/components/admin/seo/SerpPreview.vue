<script setup lang="ts">
// Admin-only. How the article may look in a search result, with the recommended lengths (SERP_LIMITS): the title
// and description that will be used (SEO fields, or the title and excerpt), their counts and a warning outside the
// limits. A guide: search engines choose for themselves
import { SERP_LIMITS } from '#shared/content/article-input'

const props = defineProps<{ title: string, description: string, path: string, noindex: boolean }>()

const { public: { siteUrl } } = useRuntimeConfig()
const host = computed(() => new URL(siteUrl).host)
const crumbs = computed(() => props.path.split('/').filter(Boolean).join(' › '))
const titleLength = computed(() => [...props.title].length)
const descriptionLength = computed(() => [...props.description].length)
const titleLong = computed(() => titleLength.value > SERP_LIMITS.title)
const descriptionShort = computed(() => descriptionLength.value < SERP_LIMITS.descriptionMin)
const descriptionLong = computed(() => descriptionLength.value > SERP_LIMITS.descriptionMax)
</script>

<template>
  <section
    class="grid gap-3"
    aria-labelledby="serp-title"
  >
    <UiHeading
      id="serp-title"
      :level="3"
      :size="2"
    >
      {{ $t('admin.serp.title') }}
    </UiHeading>
    <p class="text-step--1 text-text-muted">
      {{ $t('admin.serp.intro') }}
    </p>
    <div
      class="grid max-w-[38rem] gap-1 border border-border bg-surface p-4"
      data-testid="serp-preview"
    >
      <p class="text-step--1 break-all text-text-muted">
        {{ host }}<template v-if="crumbs">
          › {{ crumbs }}
        </template>
      </p>
      <p class="line-clamp-1 text-step-1 text-accent">
        {{ title }}
      </p>
      <p class="line-clamp-2 text-step--1">
        {{ description }}
      </p>
    </div>
    <ul
      class="grid gap-1 text-step--1"
      aria-live="polite"
    >
      <li :class="titleLong ? 'text-warning' : 'text-text-muted'">
        {{ $t('admin.serp.titleCount', { count: titleLength, max: SERP_LIMITS.title }) }}
        <template v-if="titleLong">
          — {{ $t('admin.serp.titleLong', { max: SERP_LIMITS.title }) }}
        </template>
      </li>
      <li :class="descriptionShort || descriptionLong ? 'text-warning' : 'text-text-muted'">
        {{ $t('admin.serp.descriptionCount', { count: descriptionLength, min: SERP_LIMITS.descriptionMin, max: SERP_LIMITS.descriptionMax }) }}
        <template v-if="descriptionShort">
          — {{ $t('admin.serp.descriptionShort', { min: SERP_LIMITS.descriptionMin }) }}
        </template>
        <template v-else-if="descriptionLong">
          — {{ $t('admin.serp.descriptionLong', { max: SERP_LIMITS.descriptionMax }) }}
        </template>
      </li>
      <li v-if="noindex">
        {{ $t('admin.serp.noindex') }}
      </li>
    </ul>
  </section>
</template>
