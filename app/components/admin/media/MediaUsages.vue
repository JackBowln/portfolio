<script setup lang="ts">
// Admin-only. Where a media item is used (media_usages), so a deletion never surprises anyone
import type { MediaUsage } from '~/utils/admin/media'

defineProps<{ usages: MediaUsage[] }>()
</script>

<template>
  <div class="grid gap-3">
    <p v-if="usages.length === 0">
      {{ $t('admin.media.usages.none') }}
    </p>
    <ul
      v-else
      class="grid gap-2"
      data-testid="media-usages"
    >
      <li
        v-for="usage in usages"
        :key="`${usage.entityType}:${usage.entityId}:${usage.locale}:${usage.context}`"
        class="border-b border-border py-2"
      >
        <code class="font-mono">{{ $t('admin.media.usages.item', { entity: usage.entityType, id: usage.entityId }) }}</code>
        · {{ $t(`admin.media.usages.contexts.${usage.context}`) }}
        · {{ usage.locale ?? $t('admin.media.usages.allLocales') }}
      </li>
    </ul>
  </div>
</template>
