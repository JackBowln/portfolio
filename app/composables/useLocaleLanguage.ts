// BCP 47 language of the active locale, for <html lang> and Intl
export function useLocaleLanguage() {
  const { locale, locales } = useI18n()
  return computed(() => locales.value.find(item => item.code === locale.value)?.language ?? locale.value)
}
