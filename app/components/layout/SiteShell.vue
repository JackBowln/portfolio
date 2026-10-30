<script setup lang="ts">
// Frame of every public page: skip link first, then header, the single <main> (skip link target) and footer.
// The layouts only choose the width of <main>. It loads the locale's global settings (F08-T1) before the page renders,
// and again when the locale changes in the browser
withDefaults(defineProps<{ size?: 'default' | 'reading' }>(), { size: 'default' })

const { locale } = useI18n()
const loadSettings = useSiteSettingsLoader()
await loadSettings(locale.value)
watch(locale, code => loadSettings(code))
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <UiSkipLink>{{ $t('layout.skipLink') }}</UiSkipLink>
    <LayoutSiteHeader />
    <UiContainer
      id="main"
      as="main"
      tabindex="-1"
      :size="size"
      class="flex-1 py-section focus:outline-none"
    >
      <slot />
    </UiContainer>
    <LayoutSiteFooter />
  </div>
</template>
