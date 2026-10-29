<script setup lang="ts">
// Media library (RF-06.3): grid with search and filters (type, period, without alt), more on demand, and both
// uploads. Filters live in the query string, so a filtered view can be shared or reloaded
import MediaUploader from '~/components/admin/media/MediaUploader.vue'
import VideoUploader from '~/components/admin/media/VideoUploader.vue'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'
import { formatDateTime } from '~/utils/admin/format'
import type { MediaListItem } from '~/utils/admin/media'
import { thumbnailImage } from '~/utils/admin/media'
import { adminFetch } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const route = useRoute()

interface Filters { q: string, kind: '' | 'image' | 'video', from: string, to: string, missingAlt: boolean }
const fromQuery = (): Filters => ({
  q: String(route.query.q ?? ''),
  kind: (['image', 'video'].includes(String(route.query.kind)) ? route.query.kind : '') as Filters['kind'],
  from: String(route.query.from ?? ''),
  to: String(route.query.to ?? ''),
  missingAlt: route.query.missingAlt === 'true',
})
const filters = ref<Filters>(fromQuery())
const items = ref<MediaListItem[]>([])
const cursor = ref<string | null>(null)
const loaded = ref(false)
const loading = ref(false)

function apiQuery(applied: Filters, after?: string) {
  return {
    limit: 24,
    ...(applied.q.trim() ? { q: applied.q.trim() } : {}),
    ...(applied.kind ? { kind: applied.kind } : {}),
    ...(applied.from ? { from: applied.from } : {}),
    ...(applied.to ? { to: applied.to } : {}),
    ...(applied.missingAlt ? { missingAlt: 'true' } : {}),
    ...(after ? { cursor: after } : {}),
  }
}

async function load(append = false) {
  loading.value = true
  try {
    const page = await adminFetch<{ items: MediaListItem[], nextCursor: string | null }>('/api/admin/media', {
      query: apiQuery(fromQuery(), append ? cursor.value ?? undefined : undefined),
    })
    items.value = append ? [...items.value, ...page.items] : page.items
    cursor.value = page.nextCursor
    loaded.value = true
  }
  finally {
    loading.value = false
  }
}

function apply() {
  const { limit: _limit, ...query } = apiQuery(filters.value)
  return navigateTo({ query })
}

function clear() {
  filters.value = { q: '', kind: '', from: '', to: '', missingAlt: false }
  return navigateTo({ query: {} })
}

watch(() => route.query, () => {
  filters.value = fromQuery()
  load()
})
onMounted(() => load())

const dimensions = (item: MediaListItem) => item.width && item.height ? t('admin.media.dimensions', { width: item.width, height: item.height }) : '—'

useHead({ title: () => t('admin.media.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid grid-cols-1 gap-10">
    <div class="grid gap-4">
      <UiHeading :level="1">
        {{ $t('admin.media.title') }}
      </UiHeading>
      <p>{{ $t('admin.media.intro') }}</p>
    </div>

    <section
      class="grid grid-cols-1 gap-6"
      aria-labelledby="media-upload"
    >
      <UiHeading
        id="media-upload"
        :level="2"
        :size="3"
      >
        {{ $t('admin.media.library.upload') }}
      </UiHeading>
      <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div class="grid grid-cols-1 content-start gap-4">
          <UiHeading
            :level="3"
            :size="1"
          >
            {{ $t('admin.media.library.uploadImage') }}
          </UiHeading>
          <MediaUploader @uploaded="load()" />
        </div>
        <div class="grid grid-cols-1 content-start gap-4">
          <UiHeading
            :level="3"
            :size="1"
          >
            {{ $t('admin.media.library.uploadVideo') }}
          </UiHeading>
          <VideoUploader @uploaded="load()" />
        </div>
      </div>
    </section>

    <section
      class="grid grid-cols-1 gap-6"
      aria-labelledby="media-library"
    >
      <UiHeading
        id="media-library"
        :level="2"
        :size="3"
      >
        {{ $t('admin.media.grid.title') }}
      </UiHeading>

      <form
        role="search"
        class="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]"
        :aria-label="$t('admin.media.filters.legend')"
        @submit.prevent="apply"
      >
        <UiField
          v-slot="field"
          :label="$t('admin.media.filters.search')"
        >
          <UiInput
            v-model="filters.q"
            v-bind="field"
            type="search"
          />
        </UiField>
        <div class="grid gap-2">
          <label
            for="media-kind"
            class="font-strong"
          >{{ $t('admin.media.filters.kind') }}</label>
          <select
            id="media-kind"
            v-model="filters.kind"
            class="min-h-(--target-comfortable) border border-border bg-bg px-3"
          >
            <option value="">
              {{ $t('admin.media.filters.kindAll') }}
            </option>
            <option value="image">
              {{ $t('admin.media.filters.kindImage') }}
            </option>
            <option value="video">
              {{ $t('admin.media.filters.kindVideo') }}
            </option>
          </select>
        </div>
        <UiField
          v-slot="field"
          :label="$t('admin.media.filters.from')"
        >
          <UiInput
            v-model="filters.from"
            v-bind="field"
            type="date"
          />
        </UiField>
        <UiField
          v-slot="field"
          :label="$t('admin.media.filters.to')"
        >
          <UiInput
            v-model="filters.to"
            v-bind="field"
            type="date"
          />
        </UiField>
        <label class="flex min-h-(--target-comfortable) items-center gap-3 sm:col-span-2">
          <input
            v-model="filters.missingAlt"
            type="checkbox"
            class="size-5 accent-(--color-accent)"
          >
          {{ $t('admin.media.filters.missingAlt') }}
        </label>
        <div class="flex flex-wrap gap-3 sm:col-span-2 lg:justify-end">
          <UiButton type="submit">
            {{ $t('admin.media.filters.apply') }}
          </UiButton>
          <UiButton
            variant="secondary"
            @click="clear"
          >
            {{ $t('admin.media.filters.clear') }}
          </UiButton>
        </div>
      </form>

      <template v-if="loaded">
        <p v-if="items.length === 0">
          {{ $t('admin.media.grid.empty') }}
        </p>
        <ul
          v-else
          class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          <li
            v-for="item in items"
            :key="item.id"
            data-testid="media-row"
            :data-media-id="item.id"
          >
            <NuxtLink
              :to="`/admin/midia/${item.id}`"
              class="grid gap-2 border border-border p-2 hover:border-accent"
            >
              <span class="block aspect-square overflow-hidden bg-surface">
                <ResponsiveImage
                  v-if="thumbnailImage(item)"
                  :image="thumbnailImage(item)!"
                  sizes="(min-width: 64rem) 16rem, 45vw"
                  fit="cover"
                />
              </span>
              <span class="font-strong break-all">{{ item.originalFilename }}</span>
              <span class="text-step--1 text-text-muted">{{ dimensions(item) }} · {{ formatDateTime(item.createdAt) }}</span>
              <span class="flex flex-wrap gap-2">
                <UiTag v-if="item.kind === 'video'">{{ $t('admin.media.grid.video') }}</UiTag>
                <UiTag v-if="item.status === 'pending'">{{ $t('admin.media.grid.pending') }}</UiTag>
                <UiTag
                  v-if="item.missingAlt"
                  tone="accent"
                >{{ $t('admin.media.grid.missingAlt') }}</UiTag>
                <UiTag v-if="item.decorative">{{ $t('admin.media.grid.decorative') }}</UiTag>
              </span>
            </NuxtLink>
          </li>
        </ul>
        <div v-if="cursor">
          <UiButton
            variant="secondary"
            :disabled="loading"
            @click="load(true)"
          >
            {{ $t('admin.media.grid.loadMore') }}
          </UiButton>
        </div>
      </template>
    </section>
  </div>
</template>
