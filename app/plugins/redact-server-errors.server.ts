// Nuxt serializes the caught error into the page payload with its message (the stack is already dropped in
// production), and an unhandled exception's message may carry internal details. Server errors (5xx) keep only
// the generic status text; error.vue never shows the message anyway. app:rendered runs before the payload is written
export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.dev) {
    return
  }
  nuxtApp.hook('app:rendered', ({ ssrContext }) => {
    const error = ssrContext?.payload.error
    if (error && (error.status ?? error.statusCode ?? 500) >= 500) {
      error.message = error.statusText ?? error.statusMessage ?? 'Server Error'
    }
  })
})
