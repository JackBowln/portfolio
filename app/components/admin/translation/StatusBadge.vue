<script setup lang="ts">
// Admin-only. The translation state of one localization (F09-T1): the locale and the state in words, never color
// alone; outdated stands out because it blocks publishing until someone reviews it
import type { Locale, TranslationState } from '#shared/types/enums'

defineProps<{ locale: Locale, state: TranslationState }>()

const TONES: Record<TranslationState, string> = {
  source: 'border-border text-text',
  approved: 'border-success text-success',
  outdated: 'border-warning text-warning',
  machine: 'border-accent text-text',
  in_review: 'border-accent text-text',
  missing: 'border-border text-text-muted',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-control border px-2 text-step--1"
    :class="TONES[state]"
    :data-state="state"
    data-testid="translation-badge"
  >
    <span class="font-strong">{{ locale }}</span>
    <span>{{ $t(`admin.articles.translationStates.${state}`) }}</span>
  </span>
</template>
