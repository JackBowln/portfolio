// Admin-only. The admin is pt-BR (i18n: false) and renders in the browser (ssr: false), so times use the viewer's zone
const DATE_TIME = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDateTime(value: string | Date): string {
  return DATE_TIME.format(new Date(value))
}
