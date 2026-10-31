<script setup lang="ts">
// Contact (F08-T2): the published introduction; the form arrives with F08-T3. Fallback and empty state as the other
// institutional pages
import type { PageBlocks } from '#shared/pages/blocks'
import type { PublicPage } from '#shared/pages/public'
import { paragraphs } from '#shared/pages/public'
import FallbackNotice from '~/components/pages/FallbackNotice.vue'
import PageEmpty from '~/components/pages/PageEmpty.vue'

definePageMeta({
  i18n: {
    paths: {
      'pt-BR': '/contato',
      'en': '/contact',
      'es': '/contacto',
      'de': '/kontakt',
      'fr': '/contact',
    },
  },
})

const { locale, t } = useI18n()
const data = await usePublicData<PublicPage<PageBlocks<'contact'>>>(`page:contact:${locale.value}`, '/api/public/pages/contact', { locale: locale.value })
useInstitutionalSeo(data, () => t('pages.contact.title'))
</script>

<template>
  <PageEmpty
    v-if="!data.blocks"
    :title="$t('pages.contact.title')"
  />
  <div
    v-else
    class="grid max-w-(--container-reading) gap-8"
  >
    <FallbackNotice v-if="data.fallback" />
    <UiHeading :level="1">
      {{ $t('pages.contact.title') }}
    </UiHeading>
    <div
      class="grid gap-4 text-step-1"
      :lang="data.fallback ? 'pt-BR' : undefined"
    >
      <p
        v-for="(text, index) in paragraphs(data.blocks.intro)"
        :key="index"
      >
        {{ text }}
      </p>
    </div>
  </div>
</template>
