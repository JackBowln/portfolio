<script setup lang="ts" generic="G extends object, L extends object">
// Admin-only. One settings key as a form section (F08-T1): its fields come from the page through the slot (`value`
// for the global part, `text` for the translatable part of the chosen locale), and "save" sends the version read with
// the global value and the locales that changed. A locale without a translation shows pt-BR on the site; "translate"
// starts one from the pt-BR text and "remove" goes back to pt-BR. 409 means another tab saved first
import { canonicalJson } from '#shared/content/canonical-json'
import { LOCALES, SOURCE_LOCALE } from '#shared/types/enums'
import type { Locale } from '#shared/types/enums'
import { apiError } from '~/utils/admin/articles'
import { formatDateTime } from '~/utils/admin/format'
import { adminFetch } from '~/utils/admin/session'
import type { AdminSetting } from '~/utils/admin/settings'
import { apiErrorCode } from '~/utils/admin/settings'

const props = defineProps<{ setting: AdminSetting<G, L>, title: string, intro?: string, translatable?: boolean, canEdit: boolean }>()
const emit = defineEmits<{ saved: [setting: AdminSetting<G, L>] }>()

const { t } = useI18n()
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
const value = ref({}) as Ref<G>
const translations = ref({}) as Ref<Partial<Record<Locale, L | null>>>
const locale = ref<Locale>(SOURCE_LOCALE)
const busy = ref(false)
const status = ref<{ tone: 'success' | 'danger', text: string }>()
const headingId = useId()
const localeId = useId()

function reset(setting: AdminSetting<G, L>) {
  value.value = clone(setting.value)
  translations.value = clone(setting.localizations)
}
watch(() => props.setting, reset, { immediate: true })

const text = computed(() => translations.value[locale.value] ?? null)
const changedLocales = computed(() => LOCALES.filter(code => canonicalJson(translations.value[code] ?? null) !== canonicalJson(props.setting.localizations[code] ?? null)))
const dirty = computed(() => canonicalJson(value.value) !== canonicalJson(props.setting.value) || changedLocales.value.length > 0)

function translate() {
  translations.value = { ...translations.value, [locale.value]: clone(translations.value[SOURCE_LOCALE] ?? null) }
}

function removeTranslation() {
  translations.value = { ...translations.value, [locale.value]: null }
}

async function save() {
  status.value = undefined
  busy.value = true
  try {
    const localizations = props.translatable ? Object.fromEntries(changedLocales.value.map(code => [code, translations.value[code] ?? null])) : undefined
    const saved = await adminFetch<AdminSetting<G, L>>(`/api/admin/settings/${props.setting.key}`, {
      method: 'PUT',
      body: { version: props.setting.version, value: value.value, ...(localizations ? { localizations } : {}) },
    })
    emit('saved', saved)
    status.value = { tone: 'success', text: t('admin.settings.saved') }
  }
  catch (error) {
    const { status: code } = apiError(error)
    const reason = apiErrorCode(error)
    status.value = {
      tone: 'danger',
      text: reason === 'session_not_fresh'
        ? t('admin.settings.notFresh')
        : code === 409 ? t('admin.settings.stale') : code === 403 ? t('admin.settings.forbidden') : code === 400 ? t('admin.settings.invalid') : t('admin.common.unexpectedError'),
    }
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <section
    class="grid max-w-3xl gap-6 border-t border-border pt-8"
    :aria-labelledby="headingId"
    :data-testid="`settings-${setting.key}`"
  >
    <div class="grid gap-2">
      <UiHeading
        :id="headingId"
        :level="2"
        :size="3"
      >
        {{ title }}
      </UiHeading>
      <p
        v-if="intro"
        class="text-text-muted"
      >
        {{ intro }}
      </p>
      <p class="text-step--1 text-text-muted">
        {{ setting.updatedAt ? $t('admin.settings.updatedAt', { date: formatDateTime(setting.updatedAt), version: setting.version }) : $t('admin.settings.defaults') }}
      </p>
    </div>
    <fieldset
      class="grid gap-6"
      :disabled="!canEdit"
    >
      <legend class="sr-only">
        {{ title }}
      </legend>
      <slot
        name="global"
        :value="value"
      />
      <template v-if="translatable">
        <div class="grid gap-2">
          <label
            :for="localeId"
            class="font-strong"
          >{{ $t('admin.settings.locale') }}</label>
          <select
            :id="localeId"
            v-model="locale"
            class="min-h-(--target-comfortable) justify-self-start border border-border bg-bg px-3"
          >
            <option
              v-for="code in LOCALES"
              :key="code"
              :value="code"
            >
              {{ $t(`admin.articles.locales.${code}`) }}
            </option>
          </select>
        </div>
        <slot
          v-if="text"
          name="localized"
          :text="text"
          :locale="locale"
        />
        <div
          v-else
          class="grid gap-3"
        >
          <p class="text-text-muted">
            {{ $t('admin.settings.noTranslation') }}
          </p>
          <UiButton
            variant="secondary"
            size="sm"
            class="justify-self-start"
            @click="translate"
          >
            {{ $t('admin.settings.translate') }}
          </UiButton>
        </div>
        <UiButton
          v-if="text && locale !== SOURCE_LOCALE"
          variant="ghost"
          size="sm"
          class="justify-self-start"
          @click="removeTranslation"
        >
          {{ $t('admin.settings.removeTranslation') }}
        </UiButton>
      </template>
    </fieldset>
    <div
      v-if="canEdit"
      class="flex flex-wrap items-center gap-3"
    >
      <UiButton
        :disabled="busy || !dirty"
        @click="save"
      >
        {{ $t('admin.settings.save', { section: title }) }}
      </UiButton>
      <UiButton
        v-if="dirty"
        variant="ghost"
        size="sm"
        @click="reset(setting)"
      >
        {{ $t('admin.settings.discard') }}
      </UiButton>
    </div>
    <UiStatusMessage
      v-if="status"
      :tone="status.tone"
    >
      {{ status.text }}
    </UiStatusMessage>
  </section>
</template>
