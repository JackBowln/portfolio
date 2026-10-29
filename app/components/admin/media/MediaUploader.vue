<script setup lang="ts">
// Admin-only. Picks an image, runs the pipeline in a Web Worker and uploads the result (F04-T2). The stage and
// count are announced politely; Cancel stops the worker and the requests. The full library comes in F04-T4
import { PipelineCancelledError, PipelineFailedError, useImagePipeline } from '~/composables/admin/useImagePipeline'
import { useMediaUpload } from '~/composables/admin/useMediaUpload'

const emit = defineEmits<{ uploaded: [id: string] }>()

const { t } = useI18n()
const pipeline = useImagePipeline()
const uploader = useMediaUpload()
const busy = ref(false)
const uploading = ref(false)
const status = ref<{ tone: 'info' | 'success' | 'danger', text: string }>()
const input = useTemplateRef<HTMLInputElement>('input')

const progress = computed(() => {
  if (uploading.value) {
    return { label: t('admin.media.stages.upload'), done: uploader.sent.value, total: uploader.total.value }
  }
  const current = pipeline.progress.value
  return current ? { label: t(`admin.media.stages.${current.stage}`), done: current.done, total: current.total } : null
})

async function onChange() {
  const file = input.value?.files?.[0]
  if (!file) {
    return
  }
  busy.value = true
  status.value = undefined
  try {
    const result = await pipeline.process(file)
    uploading.value = true
    const id = await uploader.upload(result)
    const seconds = Object.values(result.timings).reduce((sum, ms) => sum + ms, 0) / 1000
    status.value = { tone: 'success', text: t('admin.media.done', { name: file.name, seconds: seconds.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) }) }
    emit('uploaded', id)
  }
  catch (error) {
    if (error instanceof PipelineCancelledError || (error instanceof DOMException && error.name === 'AbortError')) {
      status.value = { tone: 'info', text: t('admin.media.cancelled') }
    }
    else if (error instanceof PipelineFailedError) {
      status.value = { tone: 'danger', text: t(`admin.media.errors.${error.code}`) }
    }
    else {
      status.value = { tone: 'danger', text: t('admin.media.errors.upload') }
    }
  }
  finally {
    busy.value = false
    uploading.value = false
    if (input.value) {
      input.value.value = ''
    }
  }
}

function cancel() {
  pipeline.cancel()
  uploader.abort()
}
</script>

<template>
  <div class="grid gap-4">
    <div class="grid gap-2">
      <label
        for="media-file"
        class="font-strong"
      >{{ $t('admin.media.choose') }}</label>
      <p
        id="media-file-hint"
        class="text-step--1 text-text-muted"
      >
        {{ $t('admin.media.chooseHint') }}
      </p>
      <input
        id="media-file"
        ref="input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        aria-describedby="media-file-hint"
        class="min-h-(--target-comfortable) max-w-full border border-border bg-bg p-2 file:mr-4 file:cursor-pointer file:border-0 file:bg-accent file:px-4 file:py-2 file:font-strong file:text-accent-contrast"
        :disabled="busy"
        @change="onChange"
      >
    </div>

    <div
      v-if="busy && progress"
      class="grid gap-2"
      data-testid="media-progress"
    >
      <p
        id="media-progress-label"
        aria-live="polite"
      >
        {{ $t('admin.media.progress', { stage: progress.label, done: progress.done, total: progress.total }) }}
      </p>
      <progress
        class="w-full accent-(--color-accent)"
        aria-labelledby="media-progress-label"
        :value="progress.done"
        :max="progress.total || 1"
      />
      <div>
        <UiButton
          variant="secondary"
          size="sm"
          @click="cancel"
        >
          {{ $t('admin.media.cancel') }}
        </UiButton>
      </div>
    </div>

    <UiStatusMessage
      v-if="status"
      :tone="status.tone"
    >
      {{ status.text }}
    </UiStatusMessage>
  </div>
</template>
