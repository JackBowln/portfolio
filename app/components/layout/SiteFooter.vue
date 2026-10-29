<script setup lang="ts">
// Footer: every section again (the way through the site without JS, since the mobile menu needs a modern browser
// or hydration), the privacy page, the language switcher and the copyright line
const language = useLocaleLanguage()
const year = computed(() => new Intl.DateTimeFormat(language.value, { year: 'numeric', timeZone: 'UTC' }).format(new Date()))
</script>

<template>
  <footer class="border-t border-border">
    <UiContainer class="grid gap-6 py-8 text-step--1 md:grid-cols-[1fr_auto] md:items-start">
      <LayoutSiteNav
        :label="$t('layout.footer.nav')"
        with-privacy
      />
      <LayoutLanguageSwitcher />
      <p class="text-text-muted md:col-span-2">
        {{ $t('layout.footer.copyright', { year, name: $t('seo.siteName') }) }}
      </p>
    </UiContainer>
  </footer>
</template>
