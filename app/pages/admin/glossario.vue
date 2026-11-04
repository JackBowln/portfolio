<script setup lang="ts">
// Glossary (F09-T2, RF-11.7): terms kept as they are in every translation, or translated as given, for one locale or
// all of them. Reading needs translation:review and editing translation:approve; the server checks both, the form
// only follows the role. One form creates or edits; deleting asks first
import { can } from '#shared/auth/permissions'
import { GLOSSARY_LIMITS, TARGET_LOCALES } from '#shared/translation/glossary'
import type { GlossaryTerm } from '#shared/translation/glossary'
import ConfirmDialog from '~/components/admin/ConfirmDialog.vue'
import { adminFetch, useAdminUser } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const SELECT_CLASS = 'min-h-(--target-comfortable) w-full rounded-control border border-border bg-bg px-3 text-text hover:border-text'

interface Form {
  term: string
  locale: '' | (typeof TARGET_LOCALES)[number]
  translation: string
  doNotTranslate: boolean
  caseSensitive: boolean
  note: string
}

const empty = (): Form => ({ term: '', locale: '', translation: '', doNotTranslate: false, caseSensitive: false, note: '' })

const { t } = useI18n()
const user = useAdminUser()
const canEdit = computed(() => can(user.value?.role ?? '', { translation: ['approve'] }))
const items = ref<GlossaryTerm[]>([])
const loaded = ref(false)
const form = reactive<Form>(empty())
const editing = ref<string | null>(null)
const errors = reactive<Record<'term' | 'translation' | 'note', string | undefined>>({ term: undefined, translation: undefined, note: undefined })
const status = ref<{ tone: 'success' | 'danger', text: string } | null>(null)
const busy = ref(false)
const pendingDelete = ref<GlossaryTerm | null>(null)
const confirmDelete = useTemplateRef<InstanceType<typeof ConfirmDialog>>('confirmDelete')
const termInput = useTemplateRef<HTMLElement>('termField')

async function load() {
  try {
    items.value = (await adminFetch<{ items: GlossaryTerm[] }>('/api/admin/glossary')).items
    loaded.value = true
  }
  catch {
    status.value = { tone: 'danger', text: t('admin.common.unexpectedError') }
  }
}

onMounted(load)

function reset() {
  Object.assign(form, empty())
  editing.value = null
  for (const key of Object.keys(errors) as (keyof typeof errors)[]) {
    errors[key] = undefined
  }
}

function edit(item: GlossaryTerm) {
  Object.assign(form, { term: item.term, locale: item.locale ?? '', translation: item.translation ?? '', doNotTranslate: item.doNotTranslate, caseSensitive: item.caseSensitive, note: item.note ?? '' })
  editing.value = item.id
  status.value = null
  nextTick(() => termInput.value?.querySelector('input')?.focus())
}

const MESSAGES: Record<string, string> = {
  required: 'admin.glossary.errors.required',
  too_long: 'admin.glossary.errors.tooLong',
  taken: 'admin.glossary.errors.taken',
  not_with_do_not_translate: 'admin.glossary.errors.notWithKeep',
}

async function save() {
  busy.value = true
  status.value = null
  for (const key of Object.keys(errors) as (keyof typeof errors)[]) {
    errors[key] = undefined
  }
  const body = {
    term: form.term,
    locale: form.locale || null,
    translation: form.doNotTranslate ? null : form.translation,
    doNotTranslate: form.doNotTranslate,
    caseSensitive: form.caseSensitive,
    note: form.note,
  }
  try {
    const path = editing.value ? `/api/admin/glossary/${encodeURIComponent(editing.value)}` : '/api/admin/glossary'
    await adminFetch(path, { method: editing.value ? 'PATCH' : 'POST', body })
    status.value = { tone: 'success', text: t(editing.value ? 'admin.glossary.updated' : 'admin.glossary.created', { term: form.term.trim() }) }
    reset()
    await load()
  }
  catch (error) {
    const issues = (error as { data?: { data?: { issues?: { path: string, message: string }[] } } }).data?.data?.issues ?? []
    for (const issue of issues) {
      if (issue.path === 'term' || issue.path === 'translation' || issue.path === 'note') {
        errors[issue.path] = t(MESSAGES[issue.message] ?? 'admin.glossary.errors.invalid', { max: GLOSSARY_LIMITS[issue.path] })
      }
    }
    status.value = { tone: 'danger', text: t(issues.length > 0 ? 'admin.glossary.errors.fix' : 'admin.common.unexpectedError') }
  }
  finally {
    busy.value = false
  }
}

function askDelete(item: GlossaryTerm) {
  pendingDelete.value = item
  confirmDelete.value?.open()
}

async function remove() {
  const item = pendingDelete.value
  if (!item) {
    return
  }
  try {
    await adminFetch(`/api/admin/glossary/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
    status.value = { tone: 'success', text: t('admin.glossary.deleted', { term: item.term }) }
    if (editing.value === item.id) {
      reset()
    }
    await load()
  }
  catch {
    status.value = { tone: 'danger', text: t('admin.common.unexpectedError') }
  }
}

const rule = (item: GlossaryTerm) => (item.doNotTranslate ? t('admin.glossary.keep') : item.translation)

useHead({ title: () => t('admin.glossary.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid gap-8">
    <div class="grid gap-3">
      <UiHeading :level="1">
        {{ $t('admin.glossary.title') }}
      </UiHeading>
      <p>{{ $t('admin.glossary.intro') }}</p>
    </div>

    <UiStatusMessage
      v-if="status"
      :tone="status.tone"
      data-testid="glossary-status"
    >
      {{ status.text }}
    </UiStatusMessage>

    <form
      v-if="canEdit"
      class="grid max-w-(--container-reading) gap-4 border border-border p-4"
      :aria-label="$t(editing ? 'admin.glossary.editForm' : 'admin.glossary.newForm')"
      @submit.prevent="save"
    >
      <UiHeading
        :level="2"
        :size="3"
      >
        {{ $t(editing ? 'admin.glossary.editForm' : 'admin.glossary.newForm') }}
      </UiHeading>
      <div ref="termField">
        <UiField
          v-slot="field"
          :label="$t('admin.glossary.term')"
          :description="$t('admin.glossary.termHint')"
          :error="errors.term"
          required
        >
          <UiInput
            v-bind="field"
            v-model="form.term"
            :maxlength="GLOSSARY_LIMITS.term"
          />
        </UiField>
      </div>
      <UiField
        v-slot="field"
        :label="$t('admin.glossary.locale')"
      >
        <select
          :id="field.id"
          v-model="form.locale"
          :class="SELECT_CLASS"
        >
          <option value="">
            {{ $t('admin.glossary.allLocales') }}
          </option>
          <option
            v-for="locale in TARGET_LOCALES"
            :key="locale"
            :value="locale"
          >
            {{ locale }}
          </option>
        </select>
      </UiField>
      <label class="flex min-h-(--target-min) items-center gap-2">
        <input
          v-model="form.doNotTranslate"
          type="checkbox"
        >
        {{ $t('admin.glossary.doNotTranslate') }}
      </label>
      <UiField
        v-if="!form.doNotTranslate"
        v-slot="field"
        :label="$t('admin.glossary.translation')"
        :error="errors.translation"
        required
      >
        <UiInput
          v-bind="field"
          v-model="form.translation"
          :maxlength="GLOSSARY_LIMITS.translation"
        />
      </UiField>
      <label class="flex min-h-(--target-min) items-center gap-2">
        <input
          v-model="form.caseSensitive"
          type="checkbox"
        >
        {{ $t('admin.glossary.caseSensitive') }}
      </label>
      <UiField
        v-slot="field"
        :label="$t('admin.glossary.note')"
        :error="errors.note"
      >
        <UiInput
          v-bind="field"
          v-model="form.note"
          :maxlength="GLOSSARY_LIMITS.note"
        />
      </UiField>
      <div class="flex flex-wrap gap-3">
        <UiButton
          type="submit"
          :disabled="busy"
        >
          {{ $t(editing ? 'admin.glossary.save' : 'admin.glossary.add') }}
        </UiButton>
        <UiButton
          v-if="editing"
          variant="secondary"
          @click="reset"
        >
          {{ $t('admin.glossary.cancel') }}
        </UiButton>
      </div>
    </form>

    <template v-if="loaded">
      <p v-if="items.length === 0">
        {{ $t('admin.glossary.empty') }}
      </p>
      <div
        v-else
        class="overflow-x-auto"
      >
        <table class="w-full text-start text-step--1">
          <caption class="sr-only">
            {{ $t('admin.glossary.title') }}
          </caption>
          <thead>
            <tr class="border-b border-border">
              <th
                scope="col"
                class="py-2 pe-4 text-start"
              >
                {{ $t('admin.glossary.term') }}
              </th>
              <th
                scope="col"
                class="py-2 pe-4 text-start"
              >
                {{ $t('admin.glossary.locale') }}
              </th>
              <th
                scope="col"
                class="py-2 pe-4 text-start"
              >
                {{ $t('admin.glossary.rule') }}
              </th>
              <th
                scope="col"
                class="py-2 pe-4 text-start"
              >
                {{ $t('admin.glossary.note') }}
              </th>
              <th
                v-if="canEdit"
                scope="col"
                class="py-2 text-start"
              >
                {{ $t('admin.glossary.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in items"
              :key="item.id"
              class="border-b border-border align-top"
              data-testid="glossary-row"
            >
              <th
                scope="row"
                class="py-2 pe-4 text-start font-strong"
              >
                {{ item.term }}
                <span
                  v-if="item.caseSensitive"
                  class="block font-regular text-text-muted"
                >{{ $t('admin.glossary.exactCase') }}</span>
              </th>
              <td class="py-2 pe-4">
                {{ item.locale ?? $t('admin.glossary.allLocales') }}
              </td>
              <td class="py-2 pe-4">
                {{ rule(item) }}
              </td>
              <td class="py-2 pe-4">
                {{ item.note ?? '—' }}
              </td>
              <td
                v-if="canEdit"
                class="py-2"
              >
                <span class="flex flex-wrap gap-2">
                  <UiButton
                    variant="secondary"
                    size="sm"
                    :aria-label="$t('admin.glossary.editTerm', { term: item.term })"
                    @click="edit(item)"
                  >
                    {{ $t('admin.glossary.edit') }}
                  </UiButton>
                  <UiButton
                    variant="ghost"
                    size="sm"
                    :aria-label="$t('admin.glossary.deleteTerm', { term: item.term })"
                    @click="askDelete(item)"
                  >
                    {{ $t('admin.glossary.delete') }}
                  </UiButton>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <ConfirmDialog
      ref="confirmDelete"
      :title="$t('admin.glossary.confirmTitle')"
      :text="$t('admin.glossary.confirmText', { term: pendingDelete?.term ?? '' })"
      :confirm-label="$t('admin.glossary.delete')"
      @confirm="remove"
    />
  </div>
</template>
