<script setup lang="ts">
// Localized 404 and 500 (RF-01.8) inside the public frame. Any status other than 404 shows the generic server
// message: the error's own message and stack never reach the page. No inline script, so the CSP stays hash-only
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const { t } = useI18n()
// Nuxt renders this page instead of app.vue, so it sets <html lang> itself
useHead({ htmlAttrs: { lang: useLocaleLanguage() } })
const kind = computed(() => props.error.statusCode === 404 ? 'notFound' : 'server')

usePageSeo({
  title: () => t(`errors.${kind.value}.title`),
  description: () => t(`errors.${kind.value}.description`),
  noindex: true,
})
</script>

<template>
  <NuxtLayout name="default">
    <div class="grid gap-6">
      <p class="font-mono text-step--1 uppercase tracking-label text-text-muted">
        {{ $t('errors.code', { code: error.statusCode }) }}
      </p>
      <UiHeading :level="1">
        {{ $t(`errors.${kind}.title`) }}
      </UiHeading>
      <p class="max-w-(--container-reading)">
        {{ $t(`errors.${kind}.description`) }}
      </p>
      <p>
        <UiLocalizedLink
          to="/"
          class="inline-flex min-h-(--target-min) items-center font-strong underline underline-offset-(--underline-offset) hover:text-accent"
        >
          {{ $t('errors.backHome') }}
        </UiLocalizedLink>
      </p>
    </div>
  </NuxtLayout>
</template>
