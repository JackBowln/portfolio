// A project's period (F07-T2): months as `YYYY-MM`, shown with Intl in the active locale ("março – junho de 2024",
// "March 2024 – June 2025"), "since…" while it has no end. UTC on both sides, so SSR and hydration agree
export function useFormatPeriod() {
  const language = useLocaleLanguage()
  const { t } = useI18n()
  const month = (value: string) => new Date(`${value}-01T00:00:00Z`)
  return (start: string | null, end: string | null): string => {
    const format = new Intl.DateTimeFormat(language.value, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    if (start && end) {
      return start === end ? format.format(month(start)) : format.formatRange(month(start), month(end))
    }
    if (start) {
      return t('projects.since', { date: format.format(month(start)) })
    }
    return end ? format.format(month(end)) : ''
  }
}
