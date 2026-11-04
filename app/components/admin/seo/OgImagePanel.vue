<script setup lang="ts">
// Admin-only. The pt-BR share image (F11-T2): a preview of the image as it would be drawn now, and a button that makes
// it and sets it on the item, replacing one chosen by hand. Publishing makes it too (PublishPanel), keeping one chosen
// by hand. The page saves pending changes first (`beforeAction`), so the image shows the saved title
import { SOURCE_LOCALE } from '#shared/types/enums'
import { useOgImage } from '~/composables/admin/useOgImage'
import type { OgTarget } from '~/composables/admin/useOgImage'
import { OG_HEIGHT, OG_WIDTH } from '~/utils/admin/og-image'
import { apiError } from '~/utils/admin/articles'

type Detail = Record<string, unknown> & { id: string }

const props = defineProps<{
  target: Omit<OgTarget, 'locale'>
  beforeAction: () => Promise<boolean>
}>()
const emit = defineEmits<{ updated: [detail: Detail], conflict: [] }>()

const { t } = useI18n()
const og = useOgImage()
const busy = ref(false)
const url = ref<string>()
const message = ref<{ tone: 'success' | 'danger', text: string }>()

// A data: URL, since the CSP allows no blob: images (server/utils/csp.ts)
function show(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      url.value = String(reader.result)
      resolve()
    }
    reader.onerror = () => reject(reader.error ?? new Error('Preview failed'))
    reader.readAsDataURL(blob)
  })
}

async function run(task: () => Promise<string>) {
  if (busy.value) {
    return
  }
  busy.value = true
  message.value = undefined
  try {
    if (!(await props.beforeAction())) {
      message.value = { tone: 'danger', text: t('admin.preview.unsaved') }
      return
    }
    message.value = { tone: 'success', text: await task() }
  }
  catch (error) {
    const { status, issues } = apiError(error)
    if (status === 409 && issues.some(issue => issue.path === 'version')) {
      emit('conflict')
    }
    else {
      message.value = { tone: 'danger', text: t('admin.ogImage.failed') }
    }
  }
  finally {
    busy.value = false
  }
}

const target = () => ({ ...props.target, locale: SOURCE_LOCALE })

const preview = () => run(async () => {
  await show(await og.preview(target()))
  return t('admin.ogImage.previewReady')
})

const generate = () => run(async () => {
  const { outcome, detail } = await og.ensure<Detail>(target(), { replace: true })
  if (detail) {
    emit('updated', detail)
  }
  await show(await og.preview(target()))
  return t(`admin.ogImage.outcomes.${outcome}`)
})
</script>

<template>
  <div class="grid gap-3">
    <p class="font-strong">
      {{ $t('admin.ogImage.title') }}
    </p>
    <p class="text-step--1 text-text-muted">
      {{ $t('admin.ogImage.hint') }}
    </p>
    <div class="flex flex-wrap gap-3">
      <UiButton
        variant="secondary"
        :disabled="busy"
        @click="preview"
      >
        {{ $t('admin.ogImage.preview') }}
      </UiButton>
      <UiButton
        variant="secondary"
        :disabled="busy"
        @click="generate"
      >
        {{ $t('admin.ogImage.generate') }}
      </UiButton>
    </div>
    <img
      v-if="url"
      :src="url"
      :width="OG_WIDTH"
      :height="OG_HEIGHT"
      :alt="$t('admin.ogImage.previewAlt')"
      class="h-auto w-full max-w-xl border border-border"
      data-testid="og-preview"
    >
    <UiStatusMessage
      v-if="message"
      :tone="message.tone"
      data-testid="og-status"
    >
      {{ message.text }}
    </UiStatusMessage>
  </div>
</template>
