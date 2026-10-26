<script setup lang="ts">
// Plain links to the equivalent page in each locale: keyboard and no-JS friendly, crawlable.
// Each name is written in its own language and marked with `lang`; the current one gets aria-current from NuxtLink
const { locales } = useI18n()
</script>

<template>
  <nav :aria-label="$t('layout.languageSwitcher.label')">
    <ul>
      <li
        v-for="item in locales"
        :key="item.code"
      >
        <SwitchLocalePathLink
          :locale="item.code"
          :lang="item.language"
          :hreflang="item.language"
        >
          {{ item.name }}
        </SwitchLocalePathLink>
      </li>
    </ul>
  </nav>
</template>
