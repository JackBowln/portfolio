<script setup lang="ts">
// Admin-only. An AI translation run (F09-T3/T4): estimate first (tokens, neurons, today's balance), then an explicit
// confirmation, then the run, called again while the job is running (each call does at most 20 batches). The server
// checks the cost guard before every batch; this panel only shows what it says
import type { Locale } from '#shared/types/enums'
import { adminFetch } from '~/utils/admin/session'

const props = defineProps<{
  type: 'article' | 'project' | 'page'
  id: string
  locale: Locale
  /** Only these segments (a partial retranslation); all of them when absent */
  segmentIds?: string[] | undefined
  label: string
}>()
// `done` carries the result text: the page shows it, since this panel may leave once nothing is pending
const emit = defineEmits<{ done: [message: string] }>()

interface Job {
  id: string
  status: 'estimated' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  segmentsTotal: number
  segmentsDone: number
  estimate: { neurons: number }
  failedSegments: string[]
  error: string | null
  blocked?: string | null
}

const { t } = useI18n()
const job = ref<Job | null>(null)
const busy = ref(false)
const message = ref<{ tone: 'info' | 'success' | 'danger', text: string } | null>(null)
const number = new Intl.NumberFormat('pt-BR')

const reasonText = (reason: string) => t(`admin.translations.blocked.${reason}`, reason)

async function estimate() {
  busy.value = true
  message.value = null
  try {
    job.value = await adminFetch<Job>('/api/admin/translations/estimate', {
      method: 'POST',
      body: { entityType: props.type, entityId: props.id, locale: props.locale, ...(props.segmentIds ? { segmentIds: props.segmentIds } : {}) },
    })
    if (job.value.blocked) {
      message.value = { tone: 'danger', text: reasonText(job.value.blocked) }
    }
  }
  catch (error) {
    const issue = (error as { data?: { data?: { issues?: { message: string }[] } } }).data?.data?.issues?.[0]?.message
    message.value = { tone: 'danger', text: issue ? t(`admin.translations.refused.${issue}`, t('admin.common.unexpectedError')) : t('admin.common.unexpectedError') }
  }
  finally {
    busy.value = false
  }
}

async function run() {
  if (!job.value) {
    return
  }
  busy.value = true
  message.value = { tone: 'info', text: t('admin.translations.running') }
  try {
    let current = job.value
    do {
      current = await adminFetch<Job>('/api/admin/translations/run', { method: 'POST', body: { jobId: current.id, confirm: true } })
      job.value = current
    } while (current.status === 'running')
    if (current.status === 'succeeded') {
      message.value = null
      emit('done', t('admin.translations.succeeded', { failed: current.failedSegments.length }, current.failedSegments.length))
    }
    else {
      message.value = { tone: 'danger', text: t('admin.translations.failed', { error: current.error ?? '' }) }
    }
  }
  catch (error) {
    const issue = (error as { data?: { data?: { issues?: { message: string }[] } } }).data?.data?.issues?.[0]?.message
    message.value = { tone: 'danger', text: issue ? reasonText(issue) : t('admin.common.unexpectedError') }
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div
    class="grid gap-3 border border-border p-4"
    data-testid="ai-run"
  >
    <div class="flex flex-wrap items-center gap-3">
      <UiButton
        variant="secondary"
        :disabled="busy"
        @click="estimate"
      >
        {{ label }}
      </UiButton>
      <template v-if="job && job.status === 'estimated' && !job.blocked">
        <p data-testid="ai-estimate">
          {{ $t('admin.translations.estimate', { segments: job.segmentsTotal, neurons: number.format(job.estimate.neurons) }) }}
        </p>
        <UiButton
          :disabled="busy"
          @click="run"
        >
          {{ $t('admin.translations.confirm') }}
        </UiButton>
      </template>
      <UiButton
        v-else-if="job && job.status === 'failed' && !job.error?.startsWith('cost_guard')"
        :disabled="busy"
        @click="run"
      >
        {{ $t('admin.translations.resume') }}
      </UiButton>
    </div>
    <p
      v-if="job && (job.status === 'running' || busy)"
      class="text-step--1 text-text-muted"
    >
      {{ $t('admin.translations.progress', { done: job.segmentsDone, total: job.segmentsTotal }) }}
    </p>
    <UiStatusMessage
      v-if="message"
      :tone="message.tone"
      data-testid="ai-message"
    >
      {{ message.text }}
    </UiStatusMessage>
  </div>
</template>
