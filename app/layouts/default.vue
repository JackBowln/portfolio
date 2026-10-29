<template>
  <div>
    <!-- Minimal shell until the public layout (F01-T5) -->
    <header class="flex flex-wrap items-center gap-x-6 gap-y-2 px-gutter py-4">
      <nav :aria-label="$t('layout.nav.label')">
        <ul class="flex flex-wrap gap-x-4">
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
      <LayoutThemeToggle />
    </header>
    <slot />
  </div>
</template>

<style scoped>
/* WCAG 2.5.8 minimum target for the temporary shell; F01-T4/T5 replace it with the tokenized layout */
header :deep(a) {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--target-min);
}
</style>
