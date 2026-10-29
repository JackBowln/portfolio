<script setup lang="ts">
// Media (F04-T2): send images through the browser pipeline and see the latest ones. The library with search,
// filters, alt per locale and safe deletion arrives in F04-T4
import MediaUploader from '~/components/admin/media/MediaUploader.vue'
import { formatDateTime } from '~/utils/admin/format'
import { adminFetch } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

interface MediaItem {
  id: string
  kind: string
  status: 'pending' | 'ready'
  originalFilename: string
  width: number | null
  height: number | null
  createdAt: string
}

const { t } = useI18n()
const items = ref<MediaItem[]>([])
const loaded = ref(false)

async function load() {
  items.value = (await adminFetch<{ items: MediaItem[] }>('/api/admin/media', { query: { limit: 20 } })).items
  loaded.value = true
}

onMounted(load)

useHead({ title: () => t('admin.media.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid gap-8">
    <div class="grid gap-4">
      <UiHeading :level="1">
        {{ $t('admin.media.title') }}
      </UiHeading>
      <p>{{ $t('admin.media.intro') }}</p>
    </div>

    <MediaUploader @uploaded="load" />

    <section
      class="grid gap-4"
      aria-labelledby="media-recent"
    >
      <UiHeading
        id="media-recent"
        :level="2"
        :size="3"
      >
        {{ $t('admin.media.recent') }}
      </UiHeading>
      <template v-if="loaded">
        <p v-if="items.length === 0">
          {{ $t('admin.media.empty') }}
        </p>
        <div
          v-else
          class="overflow-x-auto"
        >
          <table class="w-full text-left text-step--1">
            <thead>
              <tr class="border-b border-border">
                <th
                  scope="col"
                  class="py-2 pr-4"
                >
                  {{ $t('admin.media.columns.name') }}
                </th>
                <th
                  scope="col"
                  class="py-2 pr-4"
                >
                  {{ $t('admin.media.columns.status') }}
                </th>
                <th
                  scope="col"
                  class="py-2 pr-4"
                >
                  {{ $t('admin.media.columns.size') }}
                </th>
                <th
                  scope="col"
                  class="py-2"
                >
                  {{ $t('admin.media.columns.date') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in items"
                :key="item.id"
                class="border-b border-border"
                data-testid="media-row"
                :data-media-id="item.id"
              >
                <td class="py-2 pr-4 break-all">
                  {{ item.originalFilename }}
                </td>
                <td class="py-2 pr-4">
                  {{ $t(`admin.media.status.${item.status}`) }}
                </td>
                <td class="py-2 pr-4">
                  {{ item.width && item.height ? $t('admin.media.dimensions', { width: item.width, height: item.height }) : '—' }}
                </td>
                <td class="py-2">
                  {{ formatDateTime(item.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>
  </div>
</template>
