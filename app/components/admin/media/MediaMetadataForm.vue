<script setup lang="ts">
// Admin-only. Alt, caption and credit per locale (RF-06.4), with the explicit "decorative" choice. pt-BR is the
// source and its alt is required for an informative image; other locales may stay empty and use the pt-BR text.
// The server enforces the same rule; errors are tied to their field and announced
import { LOCALES, SOURCE_LOCALE } from '#shared/types/enums'
import type { Locale } from '#shared/types/enums'
import type { MediaDetail } from '~/utils/admin/media'
import { adminFetch } from '~/utils/admin/session'

const props = defineProps<{ media: MediaDetail }>()
const emit = defineEmits<{ saved: [media: MediaDetail] }>()

const { t, locales } = useI18n()
const languageName = (code: Locale) => locales.value.find(item => item.code === code)?.name ?? code

type Texts = Record<Locale, { alt: string, caption: string, credit: string }>
function fromMedia(media: MediaDetail): Texts {
  return Object.fromEntries(LOCALES.map((locale) => {
    const current = media.localizations.find(item => item.locale === locale)
    return [locale, { alt: current?.alt ?? '', caption: current?.caption ?? '', credit: current?.credit ?? '' }]
  })) as Texts
}

const texts = ref<Texts>(fromMedia(props.media))
const decorative = ref(props.media.decorative)
const error = ref<string>()
const status = ref<{ tone: 'success' | 'danger', text: string }>()
const busy = ref(false)

watch(() => props.media, (media) => {
  texts.value = fromMedia(media)
  decorative.value = media.decorative
})

async function save() {
  status.value = undefined
  error.value = !decorative.value && !texts.value[SOURCE_LOCALE].alt.trim() ? t('admin.media.metadata.altRequired') : undefined
  if (error.value) {
    return
  }
  busy.value = true
  try {
    const localizations = Object.fromEntries(LOCALES.map(locale => [locale, {
      alt: texts.value[locale].alt.trim(),
      caption: texts.value[locale].caption.trim() || null,
      credit: texts.value[locale].credit.trim() || null,
    }]))
    const updated = await adminFetch<MediaDetail>(`/api/admin/media/${encodeURIComponent(props.media.id)}`, {
      method: 'PATCH',
      body: { decorative: decorative.value, localizations },
    })
    status.value = { tone: 'success', text: t('admin.media.metadata.saved') }
    emit('saved', updated)
  }
  catch {
    status.value = { tone: 'danger', text: t('admin.common.unexpectedError') }
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <form
    class="grid gap-6"
    novalidate
    @submit.prevent="save"
  >
    <p>{{ $t('admin.media.metadata.intro') }}</p>
    <label class="flex items-start gap-3">
      <input
        v-model="decorative"
        type="checkbox"
        class="mt-1 size-5 accent-(--color-accent)"
        aria-describedby="decorative-hint"
      >
      <span class="grid gap-1">
        <span class="font-strong">{{ $t('admin.media.metadata.decorative') }}</span>
        <span
          id="decorative-hint"
          class="text-step--1 text-text-muted"
        >{{ $t('admin.media.metadata.decorativeHint') }}</span>
      </span>
    </label>

    <component
      :is="locale === SOURCE_LOCALE ? 'fieldset' : 'details'"
      v-for="locale in LOCALES"
      :key="locale"
      class="grid min-w-0 gap-4 border border-border p-4"
      :data-locale="locale"
    >
      <component
        :is="locale === SOURCE_LOCALE ? 'legend' : 'summary'"
        class="cursor-pointer px-1 font-strong"
        :lang="locale"
      >
        {{ languageName(locale) }}
      </component>
      <div class="grid gap-4 pt-2">
        <UiField
          v-if="!decorative"
          v-slot="field"
          :label="$t('admin.media.metadata.alt')"
          :description="locale === SOURCE_LOCALE ? $t('admin.media.metadata.altSourceHint') : $t('admin.media.metadata.altHint')"
          :error="locale === SOURCE_LOCALE ? error : undefined"
          :required="locale === SOURCE_LOCALE"
        >
          <UiTextarea
            v-model="texts[locale].alt"
            v-bind="field"
            :rows="2"
            :lang="locale"
            maxlength="1000"
          />
        </UiField>
        <UiField
          v-slot="field"
          :label="$t('admin.media.metadata.caption')"
        >
          <UiInput
            v-model="texts[locale].caption"
            v-bind="field"
            :lang="locale"
            maxlength="2000"
          />
        </UiField>
        <UiField
          v-slot="field"
          :label="$t('admin.media.metadata.credit')"
        >
          <UiInput
            v-model="texts[locale].credit"
            v-bind="field"
            :lang="locale"
            maxlength="300"
          />
        </UiField>
      </div>
    </component>

    <div>
      <UiButton
        type="submit"
        :disabled="busy"
      >
        {{ $t('admin.media.metadata.save') }}
      </UiButton>
    </div>
    <UiStatusMessage
      v-if="status"
      :tone="status.tone"
    >
      {{ status.text }}
    </UiStatusMessage>
  </form>
</template>
