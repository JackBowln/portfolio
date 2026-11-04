// Edits a glossary term (F09-T2): the whole entry is sent again; translation:approve, audited without the text
import { z } from 'zod'
import { glossaryTermSchema } from '#shared/translation/glossary'
import { updateGlossaryTerm } from '../../../../services/translation/glossary.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { translation: ['approve'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const input = await readValidatedBodyStrict(event, glossaryTermSchema)
    const term = await updateGlossaryTerm(useDb(event), auth.user.id, id, input)
    await auditRequest(event, { action: 'glossary.updated', entityType: 'glossary_term', entityId: id })
    return term
  },
})
