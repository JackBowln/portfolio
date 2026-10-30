<script setup lang="ts">
// Admin-only. Where an article or a project stands on the site and what can happen next (F06-T4, F07-T1): publish
// now (or publish the changes), take it off the site and, for articles, schedule it in the site's time zone or
// cancel the schedule. The page saves
// pending changes first (`beforeAction`); the server checks every rule again and the reasons it refuses (an image
// without alt, a slug another article uses on the site) come back as messages here
import { can } from '#shared/auth/permissions'
import { SOURCE_LOCALE } from '#shared/types/enums'
import { formatInZone, SITE_TIME_ZONE, utcToZoned, zonedToUtc } from '#shared/utils/time-zone'
import ConfirmDialog from '~/components/admin/ConfirmDialog.vue'
import type { ArticleLocalization } from '~/utils/admin/articles'
import { apiError } from '~/utils/admin/articles'
import { adminFetch, useAdminUser } from '~/utils/admin/session'

type Detail = Record<string, unknown> & { id: string }

const props = withDefaults(defineProps<{
  /** The item's admin API, e.g. /api/admin/articles/{id} */
  apiBase: string
  resource?: 'article' | 'project'
  copy: Pick<ArticleLocalization, 'status' | 'version' | 'publishedAt' | 'scheduledAt'>
  changed: boolean
  beforeAction: () => Promise<boolean>
}>(), { resource: 'article' })
const emit = defineEmits<{ updated: [detail: Detail], conflict: [] }>()

const { t } = useI18n()
const user = useAdminUser()
const role = computed(() => user.value?.role ?? '')
const canPublish = computed(() => can(role.value, { [props.resource]: ['publish'] }))
// Projects are published by hand only (F07-T1, decision 2), and some texts name the type
const PROJECT_TEXTS = new Set(['unpublishTitle', 'unpublishText', 'published', 'unpublished', 'unavailable', 'slugTaken'])
const text = (key: string, group = '') => (props.resource === 'project' && PROJECT_TEXTS.has(key) ? t(`admin.publish.project.${key}`) : t(`admin.publish.${group}${key}`))
const canSchedule = computed(() => props.resource === 'article' && can(role.value, { article: ['schedule'] }))
const at = ref(utcToZoned(new Date(Date.now() + 24 * 3600 * 1000)).slice(0, 11) + '09:00')
const message = ref<{ tone: 'success' | 'danger', text: string }>()
const busy = ref(false)
const atId = useId()
const confirmUnpublish = useTemplateRef<InstanceType<typeof ConfirmDialog>>('confirmUnpublish')

const status = computed(() => {
  const copy = props.copy
  if (copy.status === 'published' && copy.publishedAt) {
    return t('admin.publish.status.published', { date: formatInZone(copy.publishedAt, 'pt-BR') })
  }
  if (copy.status === 'scheduled' && copy.scheduledAt) {
    return t('admin.publish.status.scheduled', { date: formatInZone(copy.scheduledAt, 'pt-BR') })
  }
  return t(`admin.publish.status.${copy.status}`)
})

function failure(error: unknown): string {
  const { status: code, issues } = apiError(error)
  if (code === 403) {
    return t('admin.articles.edit.forbidden')
  }
  if (code === 400) {
    return t('admin.publish.errors.when')
  }
  const missingAlt = issues.filter(issue => issue.message.startsWith('missing_alt:')).length
  if (missingAlt > 0) {
    return t('admin.publish.errors.missingAlt', { count: missingAlt }, missingAlt)
  }
  if (issues.some(issue => issue.message.startsWith('unavailable:'))) {
    return text('unavailable', 'errors.')
  }
  if (issues.some(issue => issue.message === 'published_slug_taken')) {
    return text('slugTaken', 'errors.')
  }
  if (issues.some(issue => issue.path === 'translationState' || issue.path === 'source')) {
    return t('admin.publish.errors.translation')
  }
  return t('admin.common.unexpectedError')
}

async function act(path: string, body: Record<string, unknown>, done: string) {
  message.value = undefined
  if (busy.value) {
    return
  }
  busy.value = true
  try {
    if (!(await props.beforeAction())) {
      message.value = { tone: 'danger', text: t('admin.preview.unsaved') }
      return
    }
    const detail = await adminFetch<Detail>(`${props.apiBase}/${path}`, { method: 'POST', body })
    emit('updated', detail)
    message.value = { tone: 'success', text: done }
  }
  catch (error) {
    const { status: code, issues } = apiError(error)
    if (code === 409 && issues.some(issue => issue.path === 'version')) {
      emit('conflict')
    }
    else {
      message.value = { tone: 'danger', text: failure(error) }
    }
  }
  finally {
    busy.value = false
  }
}

const publish = () => act('publish', { locale: SOURCE_LOCALE, version: props.copy.version }, text('published', 'done.'))
const unpublish = () => act('unpublish', { locale: SOURCE_LOCALE }, text('unpublished', 'done.'))
const unschedule = () => act('unschedule', { locale: SOURCE_LOCALE }, t('admin.publish.done.unscheduled'))

function schedule() {
  const when = zonedToUtc(at.value)
  if (!when || when.getTime() <= Date.now()) {
    message.value = { tone: 'danger', text: t('admin.publish.errors.when') }
    return
  }
  return act('schedule', { locale: SOURCE_LOCALE, version: props.copy.version, at: when.toISOString() }, t('admin.publish.done.scheduled', { date: formatInZone(when, 'pt-BR') }))
}
</script>

<template>
  <div class="grid gap-4">
    <p
      class="font-strong"
      data-testid="publish-status"
    >
      {{ status }}
    </p>
    <p
      v-if="copy.status === 'published' && changed"
      class="text-text-muted"
    >
      {{ $t('admin.publish.changed') }}
    </p>
    <div
      v-if="canPublish"
      class="flex flex-wrap gap-3"
    >
      <UiButton
        v-if="copy.status !== 'published' || changed"
        :disabled="busy"
        @click="publish"
      >
        {{ copy.status === 'published' ? $t('admin.publish.publishChanges') : $t('admin.publish.publish') }}
      </UiButton>
      <UiButton
        v-if="copy.status === 'published'"
        variant="secondary"
        :disabled="busy"
        @click="confirmUnpublish?.open()"
      >
        {{ $t('admin.publish.unpublish') }}
      </UiButton>
    </div>
    <div
      v-if="canSchedule && (copy.status === 'draft' || copy.status === 'unpublished')"
      class="flex flex-wrap items-end gap-3"
    >
      <div class="grid gap-2">
        <label
          :for="atId"
          class="font-strong"
        >{{ $t('admin.publish.at', { zone: SITE_TIME_ZONE }) }}</label>
        <input
          :id="atId"
          v-model="at"
          type="datetime-local"
          class="min-h-(--target-comfortable) border border-border bg-bg px-3"
        >
      </div>
      <UiButton
        variant="secondary"
        :disabled="busy"
        @click="schedule"
      >
        {{ $t('admin.publish.schedule') }}
      </UiButton>
    </div>
    <div v-if="canSchedule && copy.status === 'scheduled'">
      <UiButton
        variant="secondary"
        :disabled="busy"
        @click="unschedule"
      >
        {{ $t('admin.publish.unschedule') }}
      </UiButton>
    </div>
    <p
      v-if="!canPublish && !canSchedule"
      class="text-text-muted"
    >
      {{ $t('admin.publish.notAllowed') }}
    </p>
    <UiStatusMessage
      v-if="message"
      :tone="message.tone"
    >
      {{ message.text }}
    </UiStatusMessage>
    <ConfirmDialog
      ref="confirmUnpublish"
      :title="text('unpublishTitle')"
      :text="text('unpublishText')"
      :confirm-label="$t('admin.publish.unpublish')"
      @confirm="unpublish"
    />
  </div>
</template>
