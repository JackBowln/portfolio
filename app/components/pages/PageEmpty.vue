<script setup lang="ts">
// An institutional page with nothing published yet (F08-T2, decision 4): its name and one neutral line, never
// placeholder text; the page is noindex meanwhile
defineProps<{ title: string }>()
</script>

<template>
  <div
    class="grid gap-4"
    data-testid="page-empty"
  >
    <UiHeading :level="1">
      {{ title }}
    </UiHeading>
    <p class="text-text-muted">
      {{ $t('pages.empty') }}
    </p>
  </div>
</template>
