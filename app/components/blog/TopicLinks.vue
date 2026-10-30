<script setup lang="ts">
// Topics as links to their pages (F06-T5, decision 3: a topic page is the filter, with its own URL)
import type { BlogTopic } from '#shared/content/blog'

defineProps<{ topics: BlogTopic[], label: string }>()
</script>

<template>
  <nav
    v-if="topics.length > 0"
    :aria-label="label"
  >
    <ul class="flex flex-wrap gap-2">
      <li
        v-for="topic in topics"
        :key="topic.slug"
      >
        <NuxtLinkLocale
          :to="{ name: 'blog-temas-slug', params: { slug: topic.slug } }"
          class="inline-flex min-h-(--target-min) items-center border border-border px-3 text-step--1 hover:border-accent hover:text-accent"
        >
          {{ topic.name }}<template v-if="topic.count !== undefined">
            <span class="ms-1 text-text-muted">({{ topic.count }})</span>
          </template>
        </NuxtLinkLocale>
      </li>
    </ul>
  </nav>
</template>
