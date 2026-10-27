<script setup lang="ts">
// Decorative by default (hidden from assistive tech); with `label` it becomes an image with that name
const props = defineProps<{
  name: IconName
  label?: string
}>()

const paths = computed(() => ICONS[props.name])
</script>

<template>
  <svg
    class="inline-block size-(--icon-size) shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    focusable="false"
  >
    <path
      v-for="d in paths"
      :key="d"
      :d="d"
    />
  </svg>
</template>
