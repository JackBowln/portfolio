// Owner bootstrap status (ADR-0005 §3). Anonymous, so it lives outside /api/admin; 404 once an owner exists or when no
// BOOTSTRAP_TOKEN is configured, which hides the flow entirely
import { isBootstrapOpen } from '../../services/auth/bootstrap.service.ts'

export default defineEventHandler(async (event) => {
  if (!(await isBootstrapOpen(useDb(event), useEnv(event)))) {
    throw createAppError('not_found')
  }
  return { open: true }
})
