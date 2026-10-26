<script setup lang="ts">
import type { Locale } from '#shared/types/enums'
import { person, serializeJsonLd, website } from '#shared/seo/jsonld'

const { locale, t } = useI18n()
const { siteUrl } = useRuntimeConfig().public

usePageSeo({
  title: () => t('seo.siteName'),
  description: () => t('seo.defaultDescription'),
  titleTemplate: '%s',
})

// WebSite + Person (i18n-seo §5); the name stays [PLACEHOLDER] until the identity settings exist
useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: () => serializeJsonLd([
      website({ siteUrl, name: t('seo.siteName'), locale: locale.value as Locale }),
      person({ siteUrl, name: t('seo.siteName') }),
    ]),
  }],
})
</script>

<template>
  <main>
    <h1>[PLACEHOLDER]</h1>
  </main>
</template>
