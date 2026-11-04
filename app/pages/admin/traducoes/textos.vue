<script setup lang="ts">
// Short texts in batch (F09-T5): topic names, media texts and the localized settings of one locale. Each item is a
// group with its fields (pt-BR first, then the editable translation) and a box to choose it; the chosen ones can be
// translated with AI (estimate, confirmation, the cost guard on the server), saved to review, or approved together.
// The server checks every permission; settings texts also need settings:update
import { can } from '#shared/auth/permissions'
import { TARGET_LOCALES } from '#shared/translation/glossary'
import type { Locale, TranslationState } from '#shared/types/enums'
import AiRunPanel from '~/components/admin/translation/AiRunPanel.vue'
import StatusBadge from '~/components/admin/translation/StatusBadge.vue'
import { adminFetch, useAdminUser } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

interface Field { name: string, source: string, translation: string | null, status: 'ok' | 'outdated' | 'missing' }
interface Item { key: string, kind: 'tag' | 'media' | 'setting', label: string, state: TranslationState, slug: string | null, fields: Field[] }

const SELECT_CLASS = 'min-h-(--target-comfortable) w-full rounded-control border border-border bg-bg px-3 text-text hover:border-text'

const { t } = useI18n()
const user = useAdminUser()
const role = computed(() => user.value?.role ?? '')
const canRun = computed(() => can(role.value, { translation: ['run'] }))
const canApprove = computed(() => can(role.value, { translation: ['approve'] }))
const canSettings = computed(() => can(role.value, { settings: ['update'] }))

const locale = ref<Locale>('en')
const pendingOnly = ref(true)
const items = ref<Item[]>([])
const loaded = ref(false)
const texts = reactive<Record<string, string>>({})
const slugs = reactive<Record<string, string>>({})
const selected = reactive<Record<string, boolean>>({})
const status = ref<{ tone: 'success' | 'danger', text: string } | null>(null)
const busy = ref(false)

const fieldKey = (item: Item, field: Field) => `${item.key}:${field.name}`

function fill(next: Item[]) {
  items.value = next
  for (const item of next) {
    selected[item.key] = false
    slugs[item.key] = item.slug ?? ''
    for (const field of item.fields) {
      texts[fieldKey(item, field)] = field.translation ?? ''
    }
  }
  loaded.value = true
}

async function load() {
  try {
    fill((await adminFetch<{ items: Item[] }>('/api/admin/translations/texts', { query: { locale: locale.value } })).items)
  }
  catch {
    status.value = { tone: 'danger', text: t('admin.common.unexpectedError') }
  }
}

onMounted(load)
watch(locale, () => {
  status.value = null
  load()
})

const visible = computed(() => items.value.filter(item => !pendingOnly.value || item.state !== 'approved' || item.fields.some(field => field.status !== 'ok')))
const chosen = computed(() => items.value.filter(item => selected[item.key]))
const editable = (item: Item) => can(role.value, { translation: ['review'] }) && (item.kind !== 'setting' || canSettings.value)
const chosenFields = computed(() => chosen.value.flatMap(item => item.fields.map(field => fieldKey(item, field))))

async function save() {
  const edits = items.value.flatMap((item) => {
    const fields = Object.fromEntries(item.fields.filter(field => texts[fieldKey(item, field)] && texts[fieldKey(item, field)] !== (field.translation ?? '')).map(field => [field.name, texts[fieldKey(item, field)]!]))
    const slug = item.kind === 'tag' && slugs[item.key] && slugs[item.key] !== item.slug ? slugs[item.key] : undefined
    return Object.keys(fields).length > 0 || slug ? [{ key: item.key, fields, ...(slug ? { slug } : {}) }] : []
  })
  if (edits.length === 0) {
    return
  }
  busy.value = true
  status.value = null
  try {
    fill((await adminFetch<{ items: Item[] }>('/api/admin/translations/texts', { method: 'PATCH', body: { locale: locale.value, items: edits } })).items)
    status.value = { tone: 'success', text: t('admin.translations.texts.saved', { count: edits.length }, edits.length) }
  }
  catch (error) {
    const issue = (error as { data?: { data?: { issues?: { message: string }[] } } }).data?.data?.issues?.[0]?.message
    status.value = { tone: 'danger', text: t(`admin.translations.texts.errors.${issue ?? 'unexpected'}`, t('admin.common.unexpectedError')) }
  }
  finally {
    busy.value = false
  }
}

async function approve() {
  busy.value = true
  status.value = null
  try {
    const keys = chosen.value.map(item => item.key)
    fill((await adminFetch<{ items: Item[] }>('/api/admin/translations/texts/approve', { method: 'POST', body: { locale: locale.value, keys } })).items)
    status.value = { tone: 'success', text: t('admin.translations.texts.approved', { count: keys.length }, keys.length) }
  }
  catch (error) {
    const issue = (error as { data?: { data?: { issues?: { message: string }[] } } }).data?.data?.issues?.[0]?.message
    status.value = { tone: 'danger', text: t(`admin.translations.texts.errors.${issue ?? 'unexpected'}`, t('admin.translations.errors.approve')) }
  }
  finally {
    busy.value = false
  }
}

async function finished(message: string) {
  await load()
  status.value = { tone: 'success', text: message }
}

const labelOf = (item: Item) => (item.kind === 'setting' ? t(`admin.translations.texts.settingKeys.${item.label}`) : item.label)

useHead({ title: () => t('admin.translations.texts.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid gap-8">
    <NuxtLink
      to="/admin/traducoes"
      class="justify-self-start underline underline-offset-(--underline-offset) hover:text-accent"
    >
      {{ $t('admin.translations.back') }}
    </NuxtLink>
    <div class="grid gap-3">
      <UiHeading :level="1">
        {{ $t('admin.translations.texts.title') }}
      </UiHeading>
      <p>{{ $t('admin.translations.texts.intro') }}</p>
    </div>

    <div class="flex flex-wrap items-end gap-6">
      <div class="w-40">
        <UiField
          v-slot="field"
          :label="$t('admin.translations.texts.locale')"
        >
          <select
            :id="field.id"
            v-model="locale"
            :class="SELECT_CLASS"
          >
            <option
              v-for="code in TARGET_LOCALES"
              :key="code"
              :value="code"
            >
              {{ code }}
            </option>
          </select>
        </UiField>
      </div>
      <label class="flex min-h-(--target-min) items-center gap-2">
        <input
          v-model="pendingOnly"
          type="checkbox"
        >
        {{ $t('admin.translations.texts.pendingOnly') }}
      </label>
    </div>

    <UiStatusMessage
      v-if="status"
      :tone="status.tone"
      data-testid="texts-status"
    >
      {{ status.text }}
    </UiStatusMessage>

    <template v-if="loaded">
      <p v-if="visible.length === 0">
        {{ $t('admin.translations.texts.empty') }}
      </p>
      <form
        v-else
        class="grid gap-6"
        :aria-label="$t('admin.translations.texts.title')"
        @submit.prevent="save"
      >
        <section
          v-for="(item, index) in visible"
          :key="item.key"
          class="grid gap-3 border-b border-border pb-6"
          :aria-labelledby="`text-item-${index}`"
          data-testid="text-item"
          :data-key="item.key"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <UiHeading
              :id="`text-item-${index}`"
              :level="2"
              :size="4"
            >
              {{ labelOf(item) }}
              <span class="block text-step--1 font-regular text-text-muted">{{ $t(`admin.translations.texts.kinds.${item.kind}`) }}</span>
            </UiHeading>
            <StatusBadge
              :locale="locale"
              :state="item.state"
            />
          </div>
          <div
            v-for="field in item.fields"
            :key="field.name"
            class="grid gap-4 md:grid-cols-2"
          >
            <div class="grid gap-2">
              <p class="text-step--1 font-strong">
                {{ $t(`admin.translations.texts.fields.${field.name}`) }} — {{ $t('admin.translations.original') }}
                <span
                  v-if="field.status !== 'ok'"
                  class="ms-2 font-regular"
                  :class="field.status === 'outdated' ? 'text-warning' : 'text-danger'"
                >{{ $t(`admin.translations.status.${field.status}`) }}</span>
              </p>
              <p
                lang="pt-BR"
                class="whitespace-pre-wrap rounded-control bg-surface p-3"
              >
                {{ field.source }}
              </p>
            </div>
            <UiField
              v-slot="control"
              :label="`${$t(`admin.translations.texts.fields.${field.name}`)} — ${$t('admin.translations.translation', { locale })}`"
            >
              <UiTextarea
                v-bind="control"
                :model-value="texts[fieldKey(item, field)] ?? ''"
                :lang="locale"
                :rows="field.source.length > 80 ? 3 : 1"
                :disabled="!editable(item)"
                @update:model-value="texts[fieldKey(item, field)] = $event"
              />
            </UiField>
          </div>
          <UiField
            v-if="item.kind === 'tag' && item.slug !== null"
            v-slot="control"
            :label="$t('admin.translations.slug')"
          >
            <UiInput
              v-bind="control"
              :model-value="slugs[item.key] ?? ''"
              :disabled="!editable(item)"
              maxlength="120"
              @update:model-value="slugs[item.key] = $event"
            />
          </UiField>
          <label class="flex min-h-(--target-min) items-center gap-2 text-step--1">
            <input
              v-model="selected[item.key]"
              type="checkbox"
            >
            {{ $t('admin.translations.texts.choose', { label: labelOf(item) }) }}
          </label>
        </section>
        <div class="flex flex-wrap gap-3">
          <UiButton
            type="submit"
            :disabled="busy"
          >
            {{ $t('admin.translations.save') }}
          </UiButton>
          <UiButton
            v-if="canApprove && chosen.length > 0"
            variant="secondary"
            :disabled="busy"
            @click="approve"
          >
            {{ $t('admin.translations.texts.approve', { count: chosen.length }, chosen.length) }}
          </UiButton>
        </div>
      </form>
      <AiRunPanel
        v-if="canRun && chosenFields.length > 0"
        :id="'batch'"
        :key="`${locale}-${chosenFields.join()}`"
        type="texts"
        :locale="locale"
        :segment-ids="chosenFields"
        :label="$t('admin.translations.texts.translate', { count: chosen.length }, chosen.length)"
        @done="finished"
      />
    </template>
  </div>
</template>
