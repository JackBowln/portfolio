<script setup lang="ts">
// Admin-only. A preview link for the article (F06-T3): choose how long it works (1, 8 or 24 h), generate it, then
// copy or open it. The page saves pending changes first (`beforeCreate`), so the link shows the current text.
// Anyone with the link sees the draft until it expires
import { PREVIEW_HOURS } from '#shared/content/article-input'
import { formatInZone } from '#shared/utils/time-zone'
import { apiError } from '~/utils/admin/articles'
import { adminFetch } from '~/utils/admin/session'

const props = defineProps<{ articleId: string, beforeCreate: () => Promise<boolean> }>()

const { t } = useI18n()
const hours = ref<number>(24)
const link = ref<{ url: string, expiresAt: string } | null>(null)
const message = ref<{ tone: 'success' | 'danger', text: string }>()
const hoursId = useId()
const urlId = useId()

const expires = computed(() => (link.value ? formatInZone(link.value.expiresAt, 'pt-BR') : ''))

async function create() {
  message.value = undefined
  if (!(await props.beforeCreate())) {
    message.value = { tone: 'danger', text: t('admin.preview.unsaved') }
    return
  }
  try {
    link.value = await adminFetch<{ url: string, expiresAt: string }>(`/api/admin/articles/${encodeURIComponent(props.articleId)}/preview-link`, { method: 'POST', body: { hours: hours.value } })
  }
  catch (error) {
    message.value = { tone: 'danger', text: apiError(error).status === 403 ? t('admin.articles.edit.forbidden') : t('admin.common.unexpectedError') }
  }
}

async function copy() {
  if (!link.value) {
    return
  }
  try {
    await navigator.clipboard.writeText(link.value.url)
    message.value = { tone: 'success', text: t('admin.preview.copied') }
  }
  catch {
    message.value = { tone: 'danger', text: t('admin.preview.copyFailed') }
  }
}
</script>

<template>
  <div class="grid gap-4">
    <p class="text-text-muted">
      {{ $t('admin.preview.intro') }}
    </p>
    <div class="flex flex-wrap items-end gap-3">
      <div class="grid gap-2">
        <label
          :for="hoursId"
          class="font-strong"
        >{{ $t('admin.preview.hours') }}</label>
        <select
          :id="hoursId"
          v-model.number="hours"
          class="min-h-(--target-comfortable) border border-border bg-bg px-3"
        >
          <option
            v-for="option in PREVIEW_HOURS"
            :key="option"
            :value="option"
          >
            {{ $t('admin.preview.hoursOption', { hours: option }, option) }}
          </option>
        </select>
      </div>
      <UiButton
        variant="secondary"
        @click="create"
      >
        {{ $t('admin.preview.create') }}
      </UiButton>
    </div>
    <div
      v-if="link"
      class="grid gap-2"
    >
      <label
        :for="urlId"
        class="font-strong"
      >{{ $t('admin.preview.link', { date: expires }) }}</label>
      <input
        :id="urlId"
        :value="link.url"
        readonly
        class="min-h-(--target-comfortable) w-full border border-border bg-surface px-3 font-mono text-step--1"
        data-testid="preview-url"
        @focus="($event.target as HTMLInputElement).select()"
      >
      <div class="flex flex-wrap gap-3">
        <UiButton
          size="sm"
          @click="copy"
        >
          {{ $t('admin.preview.copy') }}
        </UiButton>
        <UiLink
          :href="link.url"
          variant="standalone"
          target="_blank"
        >
          {{ $t('admin.preview.open') }}
        </UiLink>
      </div>
    </div>
    <UiStatusMessage
      v-if="message"
      :tone="message.tone"
    >
      {{ message.text }}
    </UiStatusMessage>
  </div>
</template>
