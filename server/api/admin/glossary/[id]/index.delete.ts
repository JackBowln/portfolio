// Deletes a glossary term (F09-T2); translation:approve, audited
import { z } from 'zod'
import { deleteGlossaryTerm } from '../../../../services/translation/glossary.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { translation: ['approve'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    await deleteGlossaryTerm(useDb(event), id)
    await auditRequest(event, { action: 'glossary.deleted', entityType: 'glossary_term', entityId: id })
    return { ok: true }
  },
})
