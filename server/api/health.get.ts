import { getHealth } from '../services/health/health.service'

export default defineEventHandler((event) => {
  return getHealth(useRuntimeConfig(event).appVersion)
})
