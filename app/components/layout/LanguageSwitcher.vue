<script setup lang="ts">
// Plain links to the equivalent page in each locale: keyboard and no-JS friendly, crawlable.
// Each name is written in its own language and marked with `lang`; the current one gets aria-current from NuxtLink.
// Where the page does not exist in a locale (useLocaleFallback), the link goes to the page's fallback there. On the
// server, plugins/locale-switch.server.ts rewrites these hrefs after the page has rendered
import type { Locale } from '#shared/types/enums'

const { locales } = useI18n()
const route = useRoute()
const href = useLocaleSwitchHref(() => route.path)
const links = computed(() => locales.value.map(item => ({ ...item, to: href(item.code as Locale) })))
</script>

<template>
  <nav :aria-label="$t('layout.languageSwitcher.label')">
    <ul class="flex flex-wrap gap-x-4 gap-y-2">
      <li
        v-for="item in links"
        :key="item.code"
      >
        <NuxtLink
          :to="item.to"
          :data-locale-switch="item.code"
          :lang="item.language"
          :hreflang="item.language"
          class="inline-flex min-h-(--target-min) items-center"
        >
          {{ item.name }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
