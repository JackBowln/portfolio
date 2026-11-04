// The glossary (F09-T2): every term, for whoever reviews translations
import { listGlossary } from '../../../services/translation/glossary.service.ts'

export default defineAdminHandler({
  permission: { translation: ['review'] },
  handler: async event => ({ items: await listGlossary(useDb(event)) }),
})
