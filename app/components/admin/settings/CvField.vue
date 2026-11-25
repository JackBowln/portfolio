<script setup lang="ts">
// The CV in the identity settings (F13-T5, ADR-0017): one PDF, sent as it is (no image pipeline). The browser computes
// its SHA-256; the server checks the header bytes and the size, and the setting keeps the finished media id. Admin only
import type { FileManifest } from '#shared/media/schemas'
import { useMediaUpload } from '~/composables/admin/useMediaUpload'

const model = defineModel<string | null | undefined>({ required: true })
const props = defineProps<{
  label: string
  choose: string
  remove: string
  uploading: string
  uploaded: string
  invalid: string
}>()

const MAX_BYTES = 5_000_000
const upload = useMediaUpload()
const busy = ref(false)
const error = ref('')
const fileName = ref('')

async function onChoose(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }
  error.value = ''
  if (file.type !== 'application/pdf' || file.size < 1 || file.size > MAX_BYTES) {
    error.value = props.invalid
    return
  }
  busy.value = true
  try {
    const bytes = await file.arrayBuffer()
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    const manifest: FileManifest = {
      kind: 'file',
      mimeType: 'application/pdf',
      originalFilename: file.name,
      size: file.size,
      sha256: [...digest].map(byte => byte.toString(16).padStart(2, '0')).join(''),
    }
    model.value = await upload.upload({ manifest, files: [{ name: 'original', bytes }] })
    fileName.value = file.name
  }
  catch {
    error.value = props.invalid
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="grid gap-3">
    <p class="font-strong">
      {{ label }}
    </p>
    <p
      v-if="model"
      class="text-text-muted"
    >
      {{ fileName || uploaded }}
    </p>
    <input
      type="file"
      accept="application/pdf"
      class="min-h-(--target-min) max-w-full"
      :aria-label="label"
      :disabled="busy"
      @change="onChoose"
    >
    <p
      v-if="busy"
      role="status"
    >
      {{ uploading }}
    </p>
    <p
      v-if="error"
      role="alert"
      class="text-danger"
    >
      {{ error }}
    </p>
    <button
      v-if="model && !busy"
      type="button"
      class="justify-self-start min-h-(--target-min) underline"
      @click="model = null"
    >
      {{ remove }}
    </button>
  </div>
</template>
