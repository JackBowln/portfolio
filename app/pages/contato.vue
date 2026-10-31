<script setup lang="ts">
// Contact (F08-T2, F08-T3): the published introduction and the form, the page's one interactive island (it hydrates;
// the introduction stays static). The form works before the page has content; it is off when the owner turned it
// off in the settings (features.contactForm). Fallback and empty state as the other institutional pages
import type { PageBlocks } from '#shared/pages/blocks'
import type { PublicPage } from '#shared/pages/public'
import { paragraphs } from '#shared/pages/public'
import FallbackNotice from '~/components/pages/FallbackNotice.vue'
import PageEmpty from '~/components/pages/PageEmpty.vue'
import ContactForm from '~/components/contact/ContactForm.vue'

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
const settings = useSiteSettings()
const formEnabled = computed(() => settings.value.features.contactForm)
</script>

<template>
  <PageEmpty
    v-if="!data.blocks && !formEnabled"
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
      v-if="data.blocks"
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
    <ContactForm
      v-if="formEnabled"
      :success="data.fallback ? '' : (data.blocks?.success ?? '')"
    />
    <p
      v-else
      data-testid="contact-disabled"
    >
      {{ $t('contact.disabled') }}
      <a
        v-if="settings.contactEmail"
        :href="`mailto:${settings.contactEmail}`"
        class="underline underline-offset-(--underline-offset) hover:text-accent"
      >{{ settings.contactEmail }}</a>
    </p>
  </div>
</template>
