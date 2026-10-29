<script setup lang="ts">
// Admin-only. Picks a ready image (or, with kind="video", a ready video) from the library: video posters and the
// editor's media blocks (F05-T3). A modal <dialog>
// with the mobile menu's focus handling: Esc closes, Tab wraps, focus returns to the opener. Each image is a button
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'
import type { MediaListItem } from '~/utils/admin/media'
import { thumbnailImage } from '~/utils/admin/media'
import { adminFetch } from '~/utils/admin/session'

const props = withDefaults(defineProps<{ kind?: 'image' | 'video' }>(), { kind: 'image' })
const emit = defineEmits<{ select: [item: MediaListItem] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const search = ref('')
const items = ref<MediaListItem[]>([])
const loaded = ref(false)
const titleId = useId()

// Only the latest request may fill the list: a slow first load must not overwrite a quicker search
let latest = 0
async function load() {
  const request = ++latest
  const query = { kind: props.kind, status: 'ready', limit: 30, ...(search.value.trim() ? { q: search.value.trim() } : {}) }
  const page = await adminFetch<{ items: MediaListItem[] }>('/api/admin/media', { query })
  if (request === latest) {
    items.value = page.items
    loaded.value = true
  }
}

async function open() {
  dialog.value?.showModal()
  await load()
}

function choose(item: MediaListItem) {
  emit('select', item)
  dialog.value?.close()
}

function wrapFocus(event: KeyboardEvent) {
  const controls = [...(dialog.value?.querySelectorAll<HTMLElement>('input, button:not([disabled])') ?? [])]
  const first = controls[0]
  const last = controls.at(-1)
  if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
    event.preventDefault()
    const target = event.shiftKey ? last : first
    target?.focus()
  }
}

defineExpose({ open })
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto max-h-[90dvh] w-[min(56rem,100%-2*var(--spacing-gutter))] max-w-none overflow-y-auto border border-border bg-bg p-6 text-text backdrop:bg-text/40"
    :aria-labelledby="titleId"
    @keydown.tab="wrapFocus"
  >
    <div class="grid gap-4">
      <div class="flex items-center justify-between gap-4">
        <UiHeading
          :id="titleId"
          :level="2"
          :size="3"
        >
          {{ $t('admin.media.picker.title') }}
        </UiHeading>
        <UiButton
          variant="secondary"
          size="sm"
          @click="dialog?.close()"
        >
          {{ $t('admin.media.picker.close') }}
        </UiButton>
      </div>
      <form
        role="search"
        @submit.prevent="load"
      >
        <UiField
          v-slot="field"
          :label="$t('admin.media.picker.search')"
        >
          <UiInput
            v-model="search"
            v-bind="field"
            type="search"
          />
        </UiField>
      </form>
      <p v-if="loaded && items.length === 0">
        {{ $t(props.kind === 'video' ? 'admin.media.picker.emptyVideo' : 'admin.media.picker.empty') }}
      </p>
      <ul
        v-else
        class="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <li
          v-for="item in items"
          :key="item.id"
        >
          <button
            type="button"
            class="grid w-full cursor-pointer gap-2 border border-border p-2 text-left hover:border-accent"
            :aria-label="$t('admin.media.picker.choose', { name: item.originalFilename })"
            data-testid="picker-item"
            @click="choose(item)"
          >
            <span class="block aspect-square overflow-hidden bg-surface">
              <ResponsiveImage
                v-if="thumbnailImage(item)"
                :image="thumbnailImage(item)!"
                sizes="12rem"
                fit="cover"
              />
            </span>
            <span class="text-step--1 break-all">{{ item.originalFilename }}</span>
          </button>
        </li>
      </ul>
    </div>
  </dialog>
</template>
