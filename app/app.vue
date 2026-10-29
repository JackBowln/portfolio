<script setup lang="ts">
// <html lang> follows the active locale (i18n-seo §4); the full head comes with usePageSeo in F02-T3
const language = useLocaleLanguage()
useHead({ htmlAttrs: { lang: language } })
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
