<script setup lang="ts">
// Always rendered (and never display:none), empty until there is an error: a live region that exists before its
// content changes is the one screen readers announce reliably
defineProps<{
  id: string
  message?: string | undefined
}>()
</script>

<template>
  <p
    :id="id"
    aria-live="polite"
    class="flex items-center gap-2 text-step--1 text-danger"
  >
    <template v-if="message">
      <UiIcon name="circle-alert" />
      {{ message }}
    </template>
  </p>
</template>
