// Dates always go through Intl with the active locale (ADR-0008 §2). UTC keeps SSR and hydration identical;
// the site time zone for publication dates is decided with the content (F05)
export function useFormatDate() {
  const language = useLocaleLanguage()
  return (value: Date | string) =>
    new Intl.DateTimeFormat(language.value, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value))
}
