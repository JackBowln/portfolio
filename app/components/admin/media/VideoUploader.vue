<script setup lang="ts">
// Admin-only. Videos are not transcoded (ADR-0007 §4): the owner sends an optimized MP4 or WebM, with a poster from
// the library and an optional WebVTT file per locale. The guide lists what "optimized" means here
import { MEDIA_LIMITS } from '#shared/media/schemas'
import type { VideoManifest } from '#shared/media/schemas'
import { LOCALES } from '#shared/types/enums'
import type { Locale } from '#shared/types/enums'
import { useMediaUpload } from '~/composables/admin/useMediaUpload'
import { useVideoFile, VideoFileError } from '~/composables/admin/useVideoFile'
import MediaPicker from '~/components/admin/media/MediaPicker.vue'
import type { MediaListItem } from '~/utils/admin/media'

const emit = defineEmits<{ uploaded: [id: string] }>()

const { t, locales } = useI18n()
const languageName = (code: Locale) => locales.value.find(item => item.code === code)?.name ?? code
const video = useVideoFile()
const uploader = useMediaUpload()
const picker = useTemplateRef<InstanceType<typeof MediaPicker>>('picker')
const fileInput = useTemplateRef<HTMLInputElement>('file')
const poster = ref<MediaListItem | null>(null)
const tracks = ref<Partial<Record<Locale, File>>>({})
const busy = ref(false)
const errors = ref<{ file?: string, poster?: string, tracks?: string }>({})
const status = ref<{ tone: 'info' | 'success' | 'danger', text: string }>()

function onTrack(locale: Locale, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  const others = Object.entries(tracks.value).filter(([code]) => code !== locale)
  tracks.value = Object.fromEntries(file ? [...others, [locale, file]] : others)
}

function trackError(): string | undefined {
  const files = Object.values(tracks.value)
  if (files.some(file => !file.name.toLowerCase().endsWith('.vtt'))) {
    return t('admin.media.video.errors.trackType')
  }
  return files.some(file => file.size > MEDIA_LIMITS.trackBytes) ? t('admin.media.video.errors.trackTooLarge') : undefined
}

async function send() {
  const file = fileInput.value?.files?.[0]
  const tracksMessage = trackError()
  errors.value = {
    ...(file ? {} : { file: t('admin.media.video.errors.fileRequired') }),
    ...(poster.value ? {} : { poster: t('admin.media.video.errors.posterRequired') }),
    ...(tracksMessage ? { tracks: tracksMessage } : {}),
  }
  if (!file || !poster.value || Object.keys(errors.value).length > 0) {
    return
  }
  busy.value = true
  status.value = undefined
  try {
    const info = await video.inspect(file)
    const entries = Object.entries(tracks.value) as [Locale, File][]
    const manifest: VideoManifest = {
      kind: 'video',
      mimeType: info.mimeType,
      originalFilename: file.name,
      size: file.size,
      width: info.width,
      height: info.height,
      durationMs: info.durationMs,
      sha256: info.sha256,
      posterMediaId: poster.value.id,
      tracks: entries.map(([locale, track]) => ({ locale, kind: 'captions', label: languageName(locale), size: track.size })),
    }
    const id = await uploader.upload({
      manifest,
      files: [{ name: 'original', bytes: file }, ...entries.map(([locale, track]) => ({ name: `captions-${locale}`, bytes: track }))],
    })
    status.value = { tone: 'success', text: t('admin.media.video.done', { name: file.name }) }
    emit('uploaded', id)
  }
  catch (error) {
    const code = error instanceof VideoFileError ? error.code : undefined
    status.value = { tone: 'danger', text: code ? t(`admin.media.video.errors.${code}`) : t('admin.media.errors.upload') }
  }
  finally {
    busy.value = false
  }
}

const progress = computed(() => video.stage.value
  ? t(`admin.media.video.stages.${video.stage.value}`)
  : busy.value ? t('admin.media.progress', { stage: t('admin.media.stages.upload'), done: uploader.sent.value, total: uploader.total.value }) : '')
</script>

<template>
  <div class="grid grid-cols-1">
    <form
      class="grid grid-cols-1 gap-6"
      novalidate
      @submit.prevent="send"
    >
      <div class="grid gap-2">
        <label
          for="video-file"
          class="font-strong"
        >{{ $t('admin.media.video.file') }} <span
          aria-hidden="true"
          class="text-danger"
        >*</span></label>
        <p
          id="video-file-hint"
          class="text-step--1 text-text-muted"
        >
          {{ $t('admin.media.video.fileHint') }}
        </p>
        <input
          id="video-file"
          ref="file"
          type="file"
          accept="video/mp4,video/webm"
          required
          :aria-describedby="errors.file ? 'video-file-hint video-file-error' : 'video-file-hint'"
          :aria-invalid="errors.file ? 'true' : undefined"
          class="min-h-(--target-comfortable) w-full border border-border bg-bg p-2"
          :disabled="busy"
        >
        <UiFieldError
          id="video-file-error"
          :message="errors.file"
        />
      </div>

      <div class="grid gap-2">
        <span
          id="video-poster-label"
          class="font-strong"
        >{{ $t('admin.media.video.poster') }} <span
          aria-hidden="true"
          class="text-danger"
        >*</span></span>
        <p
          id="video-poster-hint"
          class="text-step--1 text-text-muted"
        >
          {{ $t('admin.media.video.posterHint') }}
        </p>
        <p data-testid="video-poster">
          {{ poster ? $t('admin.media.video.posterChosen', { name: poster.originalFilename }) : $t('admin.media.video.noPoster') }}
        </p>
        <div>
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="busy"
            aria-describedby="video-poster-label video-poster-hint video-poster-error"
            @click="picker?.open()"
          >
            {{ poster ? $t('admin.media.video.changePoster') : $t('admin.media.video.choosePoster') }}
          </UiButton>
        </div>
        <UiFieldError
          id="video-poster-error"
          :message="errors.poster"
        />
      </div>

      <fieldset class="grid min-w-0 gap-3 border border-border p-4">
        <legend class="px-1 font-strong">
          {{ $t('admin.media.video.tracks') }}
        </legend>
        <label
          v-for="locale in LOCALES"
          :key="locale"
          class="grid gap-1"
        >
          <span>{{ $t('admin.media.video.track', { language: languageName(locale) }) }}</span>
          <input
            type="file"
            accept=".vtt,text/vtt"
            class="min-h-(--target-comfortable) w-full border border-border bg-bg p-2"
            :disabled="busy"
            :data-locale="locale"
            @change="onTrack(locale, $event)"
          >
        </label>
        <UiFieldError
          id="video-tracks-error"
          :message="errors.tracks"
        />
      </fieldset>

      <details class="border border-border p-4">
        <summary class="cursor-pointer font-strong">
          {{ $t('admin.media.video.guide.summary') }}
        </summary>
        <ul class="mt-3 grid list-disc gap-2 pl-6">
          <li
            v-for="item in ['codec', 'resolution', 'bitrate', 'faststart', 'size']"
            :key="item"
          >
            {{ $t(`admin.media.video.guide.${item}`) }}
          </li>
        </ul>
      </details>

      <div class="flex flex-wrap items-center gap-4">
        <UiButton
          type="submit"
          :disabled="busy"
        >
          {{ $t('admin.media.video.send') }}
        </UiButton>
        <p
          aria-live="polite"
          data-testid="video-progress"
        >
          {{ progress }}
        </p>
      </div>
      <UiStatusMessage
        v-if="status"
        :tone="status.tone"
      >
        {{ status.text }}
      </UiStatusMessage>
    </form>
    <!-- Outside the form: the picker has its own search form, and forms do not nest -->
    <MediaPicker
      ref="picker"
      @select="poster = $event"
    />
  </div>
</template>
