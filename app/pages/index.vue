<script setup lang="ts">
import type { Locale } from '#shared/types/enums'
import { person, serializeJsonLd, website } from '#shared/seo/jsonld'

const { locale } = useI18n()
const { siteUrl } = useRuntimeConfig().public
const settings = useSiteSettings()

usePageSeo({
  title: () => settings.value.identity.name,
  description: () => settings.value.seo.description,
  titleTemplate: '%s',
})

// WebSite + Person (i18n-seo §5), named by the identity settings (F08-T1)
useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: () => serializeJsonLd([
      website({ siteUrl, name: settings.value.identity.name, locale: locale.value as Locale }),
      person({ siteUrl, name: settings.value.identity.name }),
    ]),
  }],
})
</script>

<template>
  <div>
    <h1>[PLACEHOLDER]</h1>
  </div>
</template>
