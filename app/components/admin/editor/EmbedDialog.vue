<script setup lang="ts">
// Admin-only. An embed from the allowlist (ADR-0012): the video's URL as the owner copies it from YouTube or Vimeo
// (parsed into provider and id, F05-T5), a title and a poster from the library. Nothing is fetched from the provider
import type { EmbedProvider } from '#shared/content/document-schema'
import { EMBED_PROVIDER_NAMES, parseEmbedUrl } from '#shared/content/embeds'
import MediaPicker from '~/components/admin/media/MediaPicker.vue'
import type { MediaListItem } from '~/utils/admin/media'
import EditorDialog from './EditorDialog.vue'

export interface EmbedAttrs {
  provider: EmbedProvider
  externalId: string
  title: string
  posterMediaId: string
}

const emit = defineEmits<{ insert: [attrs: EmbedAttrs] }>()

const frame = useTemplateRef<InstanceType<typeof EditorDialog>>('frame')
const picker = useTemplateRef<InstanceType<typeof MediaPicker>>('picker')
const url = ref('')
const title = ref('')
const poster = ref<MediaListItem>()
const errors = ref<Partial<Record<'url' | 'title' | 'poster', string>>>({})
const formId = useId()
const { t } = useI18n()

const parsed = computed(() => parseEmbedUrl(url.value))

function open() {
  url.value = ''
  title.value = ''
  poster.value = undefined
  errors.value = {}
  frame.value?.open()
}

function insert() {
  const result = parsed.value
  errors.value = {
    ...(result.ok ? {} : { url: t(`admin.editor.embed.invalidUrl.${result.reason}`) }),
    ...(title.value.trim() ? {} : { title: t('admin.editor.embed.titleRequired') }),
    ...(poster.value ? {} : { poster: t('admin.editor.embed.posterRequired') }),
  }
  if (Object.keys(errors.value).length > 0 || !poster.value || !result.ok) {
    return
  }
  emit('insert', { provider: result.provider, externalId: result.externalId, title: title.value.trim(), posterMediaId: poster.value.id })
  frame.value?.close()
}

defineExpose({ open })
</script>

<template>
  <EditorDialog
    ref="frame"
    :title="$t('admin.editor.embed.title')"
  >
    <form
      class="grid gap-4"
      novalidate
      @submit.prevent="insert"
    >
      <UiField
        v-slot="field"
        :label="$t('admin.editor.embed.url')"
        :description="$t('admin.editor.embed.urlHint')"
        :error="errors.url"
        required
      >
        <UiInput
          v-model="url"
          v-bind="field"
          type="url"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
        />
      </UiField>
      <p
        role="status"
        class="text-step--1 text-text-muted"
        data-testid="embed-detected"
      >
        <template v-if="parsed.ok">
          {{ $t('admin.editor.embed.detected', { provider: EMBED_PROVIDER_NAMES[parsed.provider], id: parsed.externalId }) }}
        </template>
      </p>
      <UiField
        v-slot="field"
        :label="$t('admin.editor.embed.videoTitle')"
        :description="$t('admin.editor.embed.videoTitleHint')"
        :error="errors.title"
        required
      >
        <UiInput
          v-model="title"
          v-bind="field"
        />
      </UiField>
      <div class="grid gap-2">
        <p class="font-strong">
          {{ $t('admin.editor.embed.poster') }}
        </p>
        <p
          v-if="poster"
          data-testid="embed-poster"
        >
          {{ poster.originalFilename }}
        </p>
        <UiButton
          variant="secondary"
          size="sm"
          :aria-describedby="errors.poster ? `${formId}-poster-error` : undefined"
          @click="picker?.open()"
        >
          {{ poster ? $t('admin.editor.embed.changePoster') : $t('admin.editor.embed.choosePoster') }}
        </UiButton>
        <UiFieldError
          :id="`${formId}-poster-error`"
          :message="errors.poster"
        />
      </div>
      <div class="flex flex-wrap gap-3">
        <UiButton type="submit">
          {{ $t('admin.editor.embed.insert') }}
        </UiButton>
        <UiButton
          variant="ghost"
          @click="frame?.close()"
        >
          {{ $t('admin.editor.cancel') }}
        </UiButton>
      </div>
    </form>
  </EditorDialog>
  <!-- Outside the frame, so its hidden controls stay out of the frame's focus wrap -->
  <MediaPicker
    ref="picker"
    @select="poster = $event"
  />
</template>
