<script setup lang="ts">
// Admin-only. An embed from the allowlist (ADR-0012): provider, the provider's video id, a title and a poster from
// the library. F05-T5 replaces the id field with a URL parser and adds the facade
import { EMBED_ID_PATTERNS, EMBED_PROVIDERS } from '#shared/content/document-schema'
import type { EmbedProvider } from '#shared/content/document-schema'
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
const provider = ref<EmbedProvider>('youtube')
const externalId = ref('')
const title = ref('')
const poster = ref<MediaListItem>()
const errors = ref<Partial<Record<'externalId' | 'title' | 'poster', string>>>({})
const providerId = useId()
const { t } = useI18n()

function open() {
  provider.value = 'youtube'
  externalId.value = ''
  title.value = ''
  poster.value = undefined
  errors.value = {}
  frame.value?.open()
}

function insert() {
  const id = externalId.value.trim()
  errors.value = {
    ...(EMBED_ID_PATTERNS[provider.value].test(id) ? {} : { externalId: t(`admin.editor.embed.invalidId.${provider.value}`) }),
    ...(title.value.trim() ? {} : { title: t('admin.editor.embed.titleRequired') }),
    ...(poster.value ? {} : { poster: t('admin.editor.embed.posterRequired') }),
  }
  if (Object.keys(errors.value).length > 0 || !poster.value) {
    return
  }
  emit('insert', { provider: provider.value, externalId: id, title: title.value.trim(), posterMediaId: poster.value.id })
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
      <div class="grid gap-2">
        <label
          :for="providerId"
          class="font-strong"
        >{{ $t('admin.editor.embed.provider') }}</label>
        <select
          :id="providerId"
          v-model="provider"
          class="min-h-(--target-comfortable) border border-border bg-bg px-3"
        >
          <option
            v-for="item in EMBED_PROVIDERS"
            :key="item"
            :value="item"
          >
            {{ $t(`admin.editor.embed.providers.${item}`) }}
          </option>
        </select>
      </div>
      <UiField
        v-slot="field"
        :label="$t('admin.editor.embed.externalId')"
        :description="$t(`admin.editor.embed.idHint.${provider}`)"
        :error="errors.externalId"
        required
      >
        <UiInput
          v-model="externalId"
          v-bind="field"
          autocomplete="off"
          spellcheck="false"
        />
      </UiField>
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
          :aria-describedby="errors.poster ? `${providerId}-poster-error` : undefined"
          @click="picker?.open()"
        >
          {{ poster ? $t('admin.editor.embed.changePoster') : $t('admin.editor.embed.choosePoster') }}
        </UiButton>
        <UiFieldError
          :id="`${providerId}-poster-error`"
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
