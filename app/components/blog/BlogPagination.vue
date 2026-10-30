<script setup lang="ts">
// Previous and next page links (?page=N, F06-T5), with the current position; plain links, so they work without JS
// and crawlers follow them
const props = defineProps<{ page: number, pages: number }>()
const route = useRoute()
const query = (page: number) => ({ path: route.path, query: page > 1 ? { page } : {} })
</script>

<template>
  <nav
    v-if="props.pages > 1"
    class="flex flex-wrap items-center gap-4"
    :aria-label="$t('blog.pagination')"
  >
    <NuxtLink
      v-if="page > 1"
      :to="query(page - 1)"
      rel="prev"
      class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
    >
      {{ $t('blog.previous') }}
    </NuxtLink>
    <p aria-current="page">
      {{ $t('blog.page', { page, pages }) }}
    </p>
    <NuxtLink
      v-if="page < pages"
      :to="query(page + 1)"
      rel="next"
      class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
    >
      {{ $t('blog.next') }}
    </NuxtLink>
  </nav>
</template>
