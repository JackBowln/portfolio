// What can be translated (F09-T4): everything on the site in pt-BR, with the state of each locale
import { listTranslatableItems } from '../../../services/translation/review.service.ts'

export default defineAdminHandler({
  permission: { translation: ['review'] },
  handler: async event => ({ items: await listTranslatableItems(useDb(event)) }),
})
