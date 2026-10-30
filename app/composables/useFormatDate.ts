// Dates always go through Intl with the active locale (ADR-0008 §2), in the site's time zone (Q-06): a fixed zone
// keeps SSR and hydration identical, and a post published at 23:00 in São Paulo shows that day
import { SITE_TIME_ZONE } from '#shared/utils/time-zone'

export function useFormatDate() {
  const language = useLocaleLanguage()
  return (value: Date | string) =>
    new Intl.DateTimeFormat(language.value, { dateStyle: 'long', timeZone: SITE_TIME_ZONE }).format(new Date(value))
}
