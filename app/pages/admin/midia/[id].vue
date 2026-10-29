<script setup lang="ts">
// One media item (RF-06.4–RF-06.6): preview, texts per locale, focal point, where it is used and safe deletion.
// Every rule is the server's; the screen shows the same ones before sending
import DeleteMediaDialog from '~/components/admin/media/DeleteMediaDialog.vue'
import FocalPointPicker from '~/components/admin/media/FocalPointPicker.vue'
import MediaMetadataForm from '~/components/admin/media/MediaMetadataForm.vue'
import MediaUsages from '~/components/admin/media/MediaUsages.vue'
import MediaVideo from '~/components/media/MediaVideo.vue'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'
import { formatDateTime } from '~/utils/admin/format'
import type { MediaDetail, MediaUsage } from '~/utils/admin/media'
import { previewImage } from '~/utils/admin/media'
import { adminFetch } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const route = useRoute()
const id = computed(() => String(route.params.id))
const media = ref<MediaDetail | null>(null)
const poster = ref<MediaDetail | null>(null)
const missing = ref(false)
const focal = ref({ x: 0.5, y: 0.5 })
const focalStatus = ref<{ tone: 'success' | 'danger', text: string }>()
const deleteStatus = ref<{ tone: 'success' | 'danger', text: string, usages?: MediaUsage[] }>()
const confirmDialog = useTemplateRef<InstanceType<typeof DeleteMediaDialog>>('confirm')

async function load() {
  try {
    media.value = await adminFetch<MediaDetail>(`/api/admin/media/${encodeURIComponent(id.value)}`)
    focal.value = { x: media.value.focalX, y: media.value.focalY }
    poster.value = media.value.posterMediaId ? await adminFetch<MediaDetail>(`/api/admin/media/${encodeURIComponent(media.value.posterMediaId)}`) : null
  }
  catch {
    missing.value = true
  }
}
onMounted(load)

const image = computed(() => media.value?.kind === 'image' ? previewImage(media.value) : null)
const video = computed(() => media.value?.kind === 'video'
  ? {
      width: media.value.width ?? 0,
      height: media.value.height ?? 0,
      key: media.value.fileKey ?? '',
      mimeType: media.value.mimeType,
      durationMs: media.value.durationMs,
      poster: poster.value ? previewImage(poster.value) : null,
      tracks: media.value.tracks,
    }
  : null)
const missingAlt = computed(() => media.value?.kind === 'image' && !media.value.decorative
  && !media.value.localizations.find(item => item.locale === 'pt-BR')?.alt)

async function saveFocal() {
  try {
    media.value = await adminFetch<MediaDetail>(`/api/admin/media/${encodeURIComponent(id.value)}`, { method: 'PATCH', body: { focalX: focal.value.x, focalY: focal.value.y } })
    focalStatus.value = { tone: 'success', text: t('admin.media.focal.saved') }
  }
  catch {
    focalStatus.value = { tone: 'danger', text: t('admin.common.unexpectedError') }
  }
}

async function remove() {
  try {
    await adminFetch(`/api/admin/media/${encodeURIComponent(id.value)}`, { method: 'DELETE' })
    await navigateTo('/admin/midia')
  }
  catch (error) {
    const response = (error as { response?: { status: number } }).response
    if (response?.status === 409) {
      await load()
      deleteStatus.value = { tone: 'danger', text: t('admin.media.delete.blocked') }
    }
    else {
      deleteStatus.value = { tone: 'danger', text: t('admin.common.unexpectedError') }
    }
  }
}

useHead({ title: () => media.value?.originalFilename ?? t('admin.media.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid grid-cols-1 gap-10">
    <p>
      <NuxtLink
        to="/admin/midia"
        class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
      >
        {{ $t('admin.media.detail.back') }}
      </NuxtLink>
    </p>

    <p v-if="missing">
      {{ $t('admin.media.detail.notFound') }}
    </p>

    <template v-else-if="media">
      <div class="grid gap-3">
        <UiHeading
          :level="1"
          :size="4"
          class="break-all"
        >
          {{ media.originalFilename }}
        </UiHeading>
        <p class="text-text-muted">
          {{ $t('admin.media.detail.info', {
            kind: $t(`admin.media.detail.kinds.${media.kind === 'video' ? 'video' : 'image'}`),
            dimensions: media.width && media.height ? $t('admin.media.dimensions', { width: media.width, height: media.height }) : '—',
            date: formatDateTime(media.createdAt),
          }) }}
        </p>
        <UiStatusMessage
          v-if="missingAlt"
          tone="warning"
        >
          {{ $t('admin.media.metadata.missingAltWarning') }}
        </UiStatusMessage>
      </div>

      <section
        v-if="video"
        class="grid gap-4"
        aria-labelledby="media-preview"
      >
        <UiHeading
          id="media-preview"
          :level="2"
          :size="3"
        >
          {{ $t('admin.media.detail.preview') }}
        </UiHeading>
        <MediaVideo
          class="max-w-2xl"
          :video="video"
        />
      </section>

      <template v-if="image">
        <section
          class="grid gap-4"
          aria-labelledby="media-texts"
        >
          <UiHeading
            id="media-texts"
            :level="2"
            :size="3"
          >
            {{ $t('admin.media.metadata.title') }}
          </UiHeading>
          <div class="max-w-md">
            <ResponsiveImage
              :image="image"
              sizes="28rem"
            />
          </div>
          <MediaMetadataForm
            :media="media"
            @saved="media = $event"
          />
        </section>

        <section
          class="grid gap-4"
          aria-labelledby="media-focal"
        >
          <UiHeading
            id="media-focal"
            :level="2"
            :size="3"
          >
            {{ $t('admin.media.focal.title') }}
          </UiHeading>
          <p>{{ $t('admin.media.focal.hint') }}</p>
          <FocalPointPicker
            v-model="focal"
            :image="image"
          />
          <div>
            <UiButton @click="saveFocal">
              {{ $t('admin.media.focal.save') }}
            </UiButton>
          </div>
          <UiStatusMessage
            v-if="focalStatus"
            :tone="focalStatus.tone"
          >
            {{ focalStatus.text }}
          </UiStatusMessage>
        </section>
      </template>

      <section
        class="grid gap-4"
        aria-labelledby="media-usages"
      >
        <UiHeading
          id="media-usages"
          :level="2"
          :size="3"
        >
          {{ $t('admin.media.usages.title') }}
        </UiHeading>
        <MediaUsages :usages="media.usages" />
        <p
          v-if="media.usages.length > 0"
          id="media-delete-blocked"
        >
          {{ $t('admin.media.delete.inUse') }}
        </p>
        <div>
          <UiButton
            variant="secondary"
            :disabled="media.usages.length > 0"
            :aria-describedby="media.usages.length > 0 ? 'media-delete-blocked' : undefined"
            @click="confirmDialog?.open()"
          >
            {{ $t('admin.media.delete.button') }}
          </UiButton>
        </div>
        <UiStatusMessage
          v-if="deleteStatus"
          :tone="deleteStatus.tone"
        >
          {{ deleteStatus.text }}
        </UiStatusMessage>
        <DeleteMediaDialog
          ref="confirm"
          @confirm="remove"
        />
      </section>
    </template>
  </div>
</template>
