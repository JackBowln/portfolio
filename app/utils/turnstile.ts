// Turnstile widget (F08-T3): the script loads only on the contact page and only once the visitor reaches for the
// form (focus or pointer), so it never competes with the LCP. The CSP allows its origin on that page alone
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export interface TurnstileRenderOptions {
  'sitekey': string
  'language'?: string
  'callback': (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

interface TurnstileApi {
  render: (element: HTMLElement, options: TurnstileRenderOptions) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

let loading: Promise<TurnstileApi> | undefined

export function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => {
      const api = (window as { turnstile?: TurnstileApi }).turnstile
      if (api) {
        resolve(api)
      }
      else {
        reject(new Error('turnstile unavailable'))
      }
    }
    script.onerror = () => {
      loading = undefined
      reject(new Error('turnstile failed to load'))
    }
    document.head.appendChild(script)
  })
  return loading
}
