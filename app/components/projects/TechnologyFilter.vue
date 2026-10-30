<script setup lang="ts">
// The technology filter (F07-T2, decision 2): plain links to ?tech=<slug>, so it works without JS and every filtered
// list has its own URL; the current one is marked with aria-current. Fixed-width columns: how many rows the filter
// takes depends on how many technologies there are, not on the text's width, so the list below does not move when
// the web font replaces the fallback (CLS)
import type { ProjectTechnology } from '#shared/content/projects-public'

defineProps<{ technologies: ProjectTechnology[], active: string | null }>()

const link = 'flex h-full min-h-(--target-min) items-center border px-3 text-step--1 hover:border-accent hover:text-accent'
</script>

<template>
  <nav
    v-if="technologies.length > 0"
    :aria-label="$t('projects.filterLabel')"
  >
    <ul class="grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))] gap-2">
      <li>
        <NuxtLinkLocale
          :to="{ name: 'projetos' }"
          :class="[link, active === null ? 'border-accent text-accent' : 'border-border']"
          :aria-current="active === null ? 'page' : undefined"
        >
          {{ $t('projects.all') }}
        </NuxtLinkLocale>
      </li>
      <li
        v-for="technology in technologies"
        :key="technology.slug"
      >
        <NuxtLinkLocale
          :to="{ name: 'projetos', query: { tech: technology.slug } }"
          :class="[link, active === technology.slug ? 'border-accent text-accent' : 'border-border']"
          :aria-current="active === technology.slug ? 'page' : undefined"
        >
          {{ technology.name }}<template v-if="technology.count !== undefined">
            <span class="ms-1 text-text-muted">({{ technology.count }})</span>
          </template>
        </NuxtLinkLocale>
      </li>
    </ul>
  </nav>
</template>
