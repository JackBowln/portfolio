import { runBindingsDiagnostic } from '../../services/diagnostics/bindings.service'

export default defineEventHandler(async (event) => {
  const env = useEnv(event)
  // Defense in depth: `$production.ignore` already keeps this route out of production builds
  if (env.ENVIRONMENT !== 'local') {
    throw createError({ statusCode: 404 })
  }
  setResponseHeader(event, 'cache-control', 'no-store')
  return runBindingsDiagnostic(env.DB, env.MEDIA, new Date().toISOString())
})
