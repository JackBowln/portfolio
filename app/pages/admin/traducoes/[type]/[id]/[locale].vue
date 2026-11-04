<script setup lang="ts">
// Translation review (F09-T4, J-05/J-06): every segment as a group, the pt-BR source first and the editable
// translation after it, so a screen reader reads them in that order; status, the text before the last change, and a
// box to retranslate it. Actions: save (to review), retranslate the chosen or the outdated segments (AI, with an
// estimate and a confirmation), approve (translation:approve), publish the locale (the publishing route and its
// guards). The server checks every permission and every tag
import { can } from '#shared/auth/permissions'
import type { Locale, TranslationState } from '#shared/types/enums'
import AiRunPanel from '~/components/admin/translation/AiRunPanel.vue'
import StatusBadge from '~/components/admin/translation/StatusBadge.vue'
import { adminFetch, useAdminUser } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

interface Segment {
  id: string
  top: string
  source: string
  translation: string | null
  previous: string | null
  status: 'ok' | 'outdated' | 'missing'
}

interface Review {
  type: 'article' | 'project' | 'page'
  id: string
  locale: Locale
  pageKey: string | null
  title: string
  sourcePublished: boolean
  target: { id: string, version: number, state: TranslationState, status: string, slug: string | null, published: boolean } | null
  segments: Segment[]
  missing: string[]
}

const { t } = useI18n()
const route = useRoute()
const user = useAdminUser()
const type = computed(() => String(route.params.type) as Review['type'])
const id = computed(() => String(route.params.id))
const locale = computed(() => String(route.params.locale) as Locale)
const path = computed(() => `/api/admin/translations/review/${type.value}/${encodeURIComponent(id.value)}/${locale.value}`)

const review = ref<Review | null>(null)
const texts = reactive<Record<string, string>>({})
const selected = reactive<Record<string, boolean>>({})
const errors = reactive<Record<string, string | undefined>>({})
const slug = ref('')
const status = ref<{ tone: 'success' | 'danger', text: string } | null>(null)
const busy = ref(false)
const role = computed(() => user.value?.role ?? '')
const canEdit = computed(() => can(role.value, { translation: ['review'] }))
const canRun = computed(() => can(role.value, { translation: ['run'] }))
const canApprove = computed(() => can(role.value, { translation: ['approve'] }))
const canPublish = computed(() => can(role.value, { [type.value]: ['publish'] } as never))

function fill(next: Review) {
  review.value = next
  for (const segment of next.segments) {
    texts[segment.id] = segment.translation ?? ''
    selected[segment.id] = false
    errors[segment.id] = undefined
  }
  slug.value = next.target?.slug ?? ''
}

async function load() {
  try {
    fill(await adminFetch<Review>(path.value))
  }
  catch {
    status.value = { tone: 'danger', text: t('admin.common.unexpectedError') }
  }
}

onMounted(load)

async function finished(message: string) {
  await load()
  status.value = { tone: 'success', text: message }
}

const LABELS: Record<string, string> = { title: 'title', excerpt: 'excerpt', summary: 'summary', role: 'role', seoTitle: 'seoTitle', seoDescription: 'seoDescription' }
const labelOf = (segment: Segment, index: number) => {
  const known = LABELS[segment.id]
  if (known) {
    return t(`admin.translations.fields.${known}`)
  }
  if (segment.id.startsWith('highlights.')) {
    return t('admin.translations.fields.highlight', { n: Number(segment.id.split('.')[1]) + 1 })
  }
  return t('admin.translations.fields.block', { n: index + 1 })
}

const retranslateOutdated = computed(() => review.value?.segments.filter(segment => segment.status !== 'ok').map(segment => segment.id) ?? [])
const chosen = computed(() => Object.entries(selected).filter(([, value]) => value).map(([key]) => key))
const changed = computed(() => Object.fromEntries((review.value?.segments ?? []).filter(segment => texts[segment.id] !== (segment.translation ?? '') && texts[segment.id] !== '').map(segment => [segment.id, texts[segment.id]!])))

async function save() {
  if (!review.value) {
    return
  }
  busy.value = true
  status.value = null
  for (const key of Object.keys(errors)) {
    errors[key] = undefined
  }
  try {
    const body = {
      version: review.value.target?.version ?? 0,
      segments: changed.value,
      ...(type.value !== 'page' && slug.value && slug.value !== review.value.target?.slug ? { slug: slug.value } : {}),
    }
    fill(await adminFetch<Review>(path.value, { method: 'PATCH', body }))
    status.value = { tone: 'success', text: t('admin.translations.saved') }
  }
  catch (error) {
    const issues = (error as { data?: { data?: { issues?: { path: string, message: string }[] } } }).data?.data?.issues ?? []
    for (const issue of issues) {
      if (issue.path.startsWith('segments.')) {
        errors[issue.path.slice('segments.'.length)] = t(`admin.translations.errors.${issue.message}`, t('admin.translations.errors.invalid'))
      }
    }
    const slugIssue = issues.find(issue => issue.path === 'slug')
    status.value = { tone: 'danger', text: slugIssue ? t('admin.translations.errors.slugTaken') : issues.length > 0 ? t('admin.translations.errors.fix') : t('admin.common.unexpectedError') }
  }
  finally {
    busy.value = false
  }
}

async function approve() {
  if (!review.value?.target) {
    return
  }
  busy.value = true
  status.value = null
  try {
    fill(await adminFetch<Review>(`${path.value}/approve`, { method: 'POST', body: { version: review.value.target.version } }))
    status.value = { tone: 'success', text: t('admin.translations.approved') }
  }
  catch (error) {
    const issues = (error as { data?: { data?: { issues?: { path: string, message: string }[] } } }).data?.data?.issues ?? []
    status.value = { tone: 'danger', text: issues.some(issue => issue.message === 'missing') ? t('admin.translations.errors.missing', { count: issues.length }, issues.length) : t('admin.translations.errors.approve') }
  }
  finally {
    busy.value = false
  }
}

async function publish() {
  const current = review.value
  if (!current?.target) {
    return
  }
  busy.value = true
  status.value = null
  const target = current.type === 'page' ? `/api/admin/pages/${current.pageKey}` : `/api/admin/${current.type}s/${encodeURIComponent(current.id)}`
  try {
    await adminFetch(`${target}/publish`, { method: 'POST', body: { locale: current.locale, version: current.target.version } })
    await load()
    status.value = { tone: 'success', text: t('admin.translations.published', { locale: current.locale }) }
  }
  catch (error) {
    const issues = (error as { data?: { data?: { issues?: { path: string, message: string }[] } } }).data?.data?.issues ?? []
    const state = issues.find(issue => issue.path === 'translationState')?.message
    status.value = { tone: 'danger', text: state ? t(`admin.publish.errors.translationStates.${state}`, t('admin.publish.errors.translation')) : issues.some(issue => issue.path === 'source') ? t('admin.publish.errors.sourceNotPublished') : t('admin.common.unexpectedError') }
  }
  finally {
    busy.value = false
  }
}

useHead({ title: () => t('admin.translations.reviewTitle', { title: review.value?.title ?? '', locale: locale.value }), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid gap-8">
    <NuxtLink
      to="/admin/traducoes"
      class="justify-self-start underline underline-offset-(--underline-offset) hover:text-accent"
    >
      {{ $t('admin.translations.back') }}
    </NuxtLink>

    <template v-if="review">
      <div class="grid gap-3">
        <UiHeading :level="1">
          {{ $t('admin.translations.reviewTitle', { title: review.title, locale: review.locale }) }}
        </UiHeading>
        <p class="flex flex-wrap items-center gap-2">
          <StatusBadge
            :locale="review.locale"
            :state="review.target?.state ?? 'missing'"
          />
          <span
            v-if="review.target?.published"
            class="text-step--1 text-text-muted"
          >{{ $t('admin.translations.onSite') }}</span>
        </p>
        <p class="text-step--1 text-text-muted">
          {{ $t('admin.translations.tagsHint', { tags: '<b>, </b>, <a1>, <x1/>' }) }}
        </p>
      </div>

      <UiStatusMessage
        v-if="status"
        :tone="status.tone"
        data-testid="review-status"
      >
        {{ status.text }}
      </UiStatusMessage>

      <AiRunPanel
        v-if="canRun && (!review.target || review.target.state === 'machine')"
        :id="review.id"
        :type="review.type"
        :locale="review.locale"
        :label="$t('admin.translations.translateAll')"
        @done="finished"
      />

      <form
        class="grid gap-6"
        :aria-label="$t('admin.translations.segments')"
        @submit.prevent="save"
      >
        <UiField
          v-if="review.type !== 'page' && review.target"
          v-slot="field"
          :label="$t('admin.translations.slug')"
          :description="$t('admin.translations.slugHint')"
        >
          <UiInput
            v-bind="field"
            v-model="slug"
            :disabled="!canEdit"
            maxlength="120"
          />
        </UiField>

        <section
          v-for="(segment, index) in review.segments"
          :key="segment.id"
          class="grid gap-3 border-b border-border pb-6"
          :aria-labelledby="`segment-${index}`"
          data-testid="review-segment"
          :data-status="segment.status"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <UiHeading
              :id="`segment-${index}`"
              :level="2"
              :size="4"
            >
              {{ labelOf(segment, index) }}
            </UiHeading>
            <span
              v-if="segment.status !== 'ok'"
              class="rounded-control border px-2 text-step--1"
              :class="segment.status === 'outdated' ? 'border-warning text-warning' : 'border-danger text-danger'"
            >{{ $t(`admin.translations.status.${segment.status}`) }}</span>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="grid gap-2">
              <p class="text-step--1 font-strong">
                {{ $t('admin.translations.original') }}
              </p>
              <p
                lang="pt-BR"
                class="whitespace-pre-wrap rounded-control bg-surface p-3"
              >
                {{ segment.source }}
              </p>
            </div>
            <UiField
              v-slot="field"
              :label="$t('admin.translations.translation', { locale: review.locale })"
              :error="errors[segment.id]"
            >
              <UiTextarea
                v-bind="field"
                :model-value="texts[segment.id] ?? ''"
                :lang="review.locale"
                :rows="Math.min(8, Math.max(2, Math.ceil(segment.source.length / 80)))"
                :disabled="!canEdit"
                @update:model-value="texts[segment.id] = $event"
              />
            </UiField>
          </div>
          <details
            v-if="segment.previous"
            class="text-step--1"
          >
            <summary class="cursor-pointer underline underline-offset-(--underline-offset)">
              {{ $t('admin.translations.previous') }}
            </summary>
            <p
              :lang="review.locale"
              class="mt-2 whitespace-pre-wrap text-text-muted"
            >
              {{ segment.previous }}
            </p>
          </details>
          <label
            v-if="canRun && review.target"
            class="flex min-h-(--target-min) items-center gap-2 text-step--1"
          >
            <input
              v-model="selected[segment.id]"
              type="checkbox"
            >
            {{ $t('admin.translations.select', { label: labelOf(segment, index) }) }}
          </label>
        </section>

        <div
          v-if="canEdit"
          class="flex flex-wrap gap-3"
        >
          <UiButton
            type="submit"
            :disabled="busy"
          >
            {{ $t('admin.translations.save') }}
          </UiButton>
        </div>
      </form>

      <div
        v-if="review.target"
        class="grid gap-4"
      >
        <AiRunPanel
          v-if="canRun && chosen.length > 0"
          :id="review.id"
          :key="`chosen-${chosen.join()}`"
          :type="review.type"
          :locale="review.locale"
          :segment-ids="chosen"
          :label="$t('admin.translations.retranslateChosen', { count: chosen.length }, chosen.length)"
          @done="finished"
        />
        <AiRunPanel
          v-if="canRun && retranslateOutdated.length > 0"
          :id="review.id"
          :key="`outdated-${retranslateOutdated.join()}`"
          :type="review.type"
          :locale="review.locale"
          :segment-ids="retranslateOutdated"
          :label="$t('admin.translations.retranslateOutdated', { count: retranslateOutdated.length }, retranslateOutdated.length)"
          @done="finished"
        />
        <div class="flex flex-wrap gap-3">
          <UiButton
            v-if="canApprove && (review.target.state === 'machine' || review.target.state === 'in_review')"
            variant="secondary"
            :disabled="busy"
            @click="approve"
          >
            {{ $t('admin.translations.approve') }}
          </UiButton>
          <UiButton
            v-if="canPublish && review.target.state === 'approved'"
            :disabled="busy"
            @click="publish"
          >
            {{ $t('admin.translations.publish', { locale: review.locale }) }}
          </UiButton>
        </div>
      </div>
    </template>
  </div>
</template>
