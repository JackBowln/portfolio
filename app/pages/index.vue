<script setup lang="ts">
// The home (F08-T2, RF-01.1; motion comes with F10): hero, narrative sections, the featured projects and the latest
// articles (from what is published, decision 2) and the closing call, in HomeContent, which never hydrates. Fallback
// and empty state as the other institutional pages; WebSite and Person JSON-LD named by the identity settings
import { useMotion } from '~/composables/motion/useMotion'
import type { PageBlocks } from '#shared/pages/blocks'
import type { PublicPage } from '#shared/pages/public'
import { person, serializeJsonLd, website } from '#shared/seo/jsonld'
import type { Locale } from '#shared/types/enums'
import PageEmpty from '~/components/pages/PageEmpty.vue'

const { locale } = useI18n()
const { siteUrl } = useRuntimeConfig().public
const settings = useSiteSettings()
const data = await usePublicData<PublicPage<PageBlocks<'home'>>>(`page:home:${locale.value}`, '/api/public/pages/home', { locale: locale.value })
useInstitutionalSeo(data, () => settings.value.identity.name, { titleTemplate: '%s' })

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: () => serializeJsonLd([
      website({ siteUrl, name: settings.value.identity.name, locale: locale.value as Locale }),
      person({ siteUrl, name: settings.value.identity.name }),
    ]),
  }],
})

// The home's motion (storyboard-home §2–§6, F10-T3): the scene and GSAP only after the load, never with reduced motion
useMotion(() => document.querySelector('main'), 'home', { plugins: ['ScrollTrigger', 'SplitText'] })
</script>

<template>
  <PageEmpty
    v-if="!data.blocks"
    :title="settings.identity.name"
  />
  <LazyPagesHomeContent
    v-else
    hydrate-never
    :page="data as PublicPage<PageBlocks<'home'>> & { blocks: PageBlocks<'home'> }"
  />
</template>
