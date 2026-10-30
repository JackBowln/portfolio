<script setup lang="ts">
// The level is the document outline; the size is the look, so a section can keep a correct h2 at any size.
// Display type (Fraunces) is the default from step 3 up (DISPLAY_FROM_STEP). A word longer than the line (a CMS title,
// a German compound) breaks instead of widening the grid it sits in (wrap-anywhere lowers the min-content width)
import { DISPLAY_FROM_STEP } from '#shared/design/tokens'

type Level = 1 | 2 | 3 | 4 | 5 | 6
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

const props = defineProps<{
  level: Level
  size?: Step
  font?: 'display' | 'sans'
}>()

const DEFAULT_SIZE: Record<Level, Step> = { 1: 6, 2: 4, 3: 3, 4: 1, 5: 0, 6: 0 }

// Full class names, so Tailwind finds them in this file
const SIZE_CLASS: Record<Step, string> = {
  0: 'text-step-0',
  1: 'text-step-1',
  2: 'text-step-2',
  3: 'text-step-3',
  4: 'text-step-4',
  5: 'text-step-5',
  6: 'text-step-6',
  7: 'text-step-7',
}

const step = computed(() => props.size ?? DEFAULT_SIZE[props.level])
const display = computed(() => (props.font ?? (step.value >= DISPLAY_FROM_STEP ? 'display' : 'sans')) === 'display')
</script>

<template>
  <component
    :is="`h${level}`"
    class="text-balance wrap-anywhere"
    :class="[SIZE_CLASS[step], display ? 'font-display font-regular' : 'font-sans font-strong']"
  >
    <slot />
  </component>
</template>
