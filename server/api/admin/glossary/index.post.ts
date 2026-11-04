// A new glossary term (F09-T2): it changes what every later translation sends and asks, so it needs translation:approve
import { glossaryTermSchema } from '#shared/translation/glossary'
import { createGlossaryTerm } from '../../../services/translation/glossary.service.ts'

export default defineAdminHandler({
  permission: { translation: ['approve'] },
  handler: async (event, auth) => {
    const input = await readValidatedBodyStrict(event, glossaryTermSchema)
    const term = await createGlossaryTerm(useDb(event), auth.user.id, input)
    await auditRequest(event, { action: 'glossary.created', entityType: 'glossary_term', entityId: term.id })
    return term
  },
})
