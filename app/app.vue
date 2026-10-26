<script setup lang="ts">
// <html lang> follows the active locale (i18n-seo §4); the full head comes with usePageSeo in F02-T3
const language = useLocaleLanguage()
useHead({ htmlAttrs: { lang: language } })
</script>

<template>
  <NuxtRouteAnnouncer />
  <!-- Minimal shell until the public layout (F01-T5) -->
  <header>
    <nav :aria-label="$t('layout.nav.label')">
      <ul>
        <li>
          <UiLocalizedLink to="/projetos">
            {{ $t('layout.nav.projects') }}
          </UiLocalizedLink>
        </li>
        <li>
          <UiLocalizedLink to="/blog">
            {{ $t('layout.nav.blog') }}
          </UiLocalizedLink>
        </li>
        <li>
          <UiLocalizedLink to="/sobre">
            {{ $t('layout.nav.about') }}
          </UiLocalizedLink>
        </li>
        <li>
          <UiLocalizedLink to="/contato">
            {{ $t('layout.nav.contact') }}
          </UiLocalizedLink>
        </li>
      </ul>
    </nav>
    <LayoutLanguageSwitcher />
  </header>
  <NuxtPage />
</template>

<style scoped>
/* WCAG 2.5.8 minimum target (24 CSS px) for the temporary shell; F01-T4/T5 replace it with the tokenized layout */
header :deep(a) {
  display: inline-flex;
  align-items: center;
  min-block-size: 1.5rem;
}
</style>
