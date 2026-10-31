<script setup lang="ts">
// Privacy (F08-T2): what the site handles (security-model §6) is a fact of the system, so it comes from the UI
// messages in every locale and is always shown (decision 1); the legal text (purpose, legal basis, rights, contact)
// is the owner's document, with the date it was last updated
import '~/assets/css/content.css'
import type { PageBlocks } from '#shared/pages/blocks'
import type { PublicPage } from '#shared/pages/public'
import StaticContent from '~/components/content/StaticContent.vue'
import FallbackNotice from '~/components/pages/FallbackNotice.vue'

definePageMeta({
  i18n: {
    paths: {
      'pt-BR': '/privacidade',
      'en': '/privacy',
      'es': '/privacidad',
      'de': '/datenschutz',
      'fr': '/confidentialite',
    },
  },
})

const FACTS = ['contact', 'admin', 'logs', 'cookies', 'turnstile', 'embeds', 'fonts'] as const

const { locale, t } = useI18n()
const language = useLocaleLanguage()
const data = await usePublicData<PublicPage<PageBlocks<'privacy'>>>(`page:privacy:${locale.value}`, '/api/public/pages/privacy', { locale: locale.value })
useInstitutionalSeo(data, () => t('pages.privacy.title'))
const factsId = useId()
const updatedOn = computed(() => {
  const value = data.value.blocks?.updatedOn
  return value ? new Intl.DateTimeFormat(language.value, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) : null
})
</script>

<template>
  <div class="grid max-w-(--container-reading) gap-10">
    <FallbackNotice v-if="data.fallback" />
    <div class="grid gap-3">
      <UiHeading :level="1">
        {{ $t('pages.privacy.title') }}
      </UiHeading>
      <p
        v-if="updatedOn"
        class="text-step--1 text-text-muted"
      >
        {{ $t('pages.privacy.updatedOn', { date: updatedOn }) }}
      </p>
    </div>
    <section
      class="grid gap-4"
      :aria-labelledby="factsId"
    >
      <UiHeading
        :id="factsId"
        :level="2"
        :size="3"
      >
        {{ $t('pages.privacy.factsTitle') }}
      </UiHeading>
      <ul class="grid list-disc gap-2 ps-6">
        <li
          v-for="fact in FACTS"
          :key="fact"
        >
          {{ $t(`pages.privacy.facts.${fact}`) }}
        </li>
      </ul>
    </section>
    <div
      v-if="data.blocks?.body"
      :lang="data.fallback ? 'pt-BR' : undefined"
    >
      <StaticContent
        :document="data.blocks.body"
        :media="data.media"
      />
    </div>
    <p
      v-else
      class="text-text-muted"
      data-testid="page-empty"
    >
      {{ $t('pages.empty') }}
    </p>
  </div>
</template>
