<script setup lang="ts">
// A case study (F07-T2, RF-01.3, RF-09.1): the published snapshot with its details, verifiable results, narrative,
// gallery and related projects. hreflang and the language switcher list only the published locales; in a locale
// where it is not published, the URL is 404 and the switcher leads to the projects there. No motion and no content
// JS: the case study never hydrates (CaseStudy, hydrate-never); only the enhancement script runs, on this root. The
// document blocks' stylesheet comes with this page, as the reading layout brings it for articles
import { useMotion } from '~/composables/motion/useMotion'
import '~/assets/css/content.css'
import type { PublicProject } from '#shared/content/projects-public'

definePageMeta({
  key: route => route.fullPath,
  i18n: {
    paths: {
      'pt-BR': '/projetos/[slug]',
      'en': '/projects/[slug]',
      'es': '/proyectos/[slug]',
      'de': '/projekte/[slug]',
      'fr': '/projets/[slug]',
    },
  },
})

const { locale } = useI18n()
const route = useRoute()
const slug = String(route.params.slug)
const data = await usePublicData<PublicProject>(`project:${locale.value}:${slug}`, `/api/public/projects/${encodeURIComponent(slug)}`, { locale: locale.value })

const setI18nParams = useSetI18nParams()
setI18nParams(Object.fromEntries(data.value.alternates.map(alternate => [alternate.locale, { slug: alternate.slug }])))
useLocaleFallback(data.value.alternates.map(alternate => alternate.locale), '/projetos')

usePageSeo({
  title: () => data.value.seo.title,
  description: () => data.value.seo.description,
  published: () => data.value.alternates.map(alternate => alternate.locale),
  noindex: () => data.value.seo.noindex,
})

const root = useTemplateRef<HTMLElement>('root')
let cleanup: (() => void) | undefined
onMounted(async () => {
  const { enhanceContent } = await import('~/utils/content/enhance')
  if (root.value) {
    cleanup = enhanceContent(root.value)
  }
})
onBeforeUnmount(() => cleanup?.())

// F10-T2: the page's motion (storyboard-home §9); no scenes yet (F10-T3/T4). GSAP only after the load, never with reduced motion
useMotion(() => document.querySelector('main'), () => {}, { plugins: ['ScrollTrigger'] })
</script>

<template>
  <div
    ref="root"
    class="grid gap-10"
  >
    <p>
      <NuxtLinkLocale
        :to="{ name: 'projetos' }"
        class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
      >
        {{ $t('projects.back') }}
      </NuxtLinkLocale>
    </p>
    <LazyProjectsCaseStudy
      hydrate-never
      :project="data"
    />
  </div>
</template>
