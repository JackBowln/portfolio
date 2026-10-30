// Project list (F07-T1): every project in the manual order, with each localization's state
import { listProjects } from '../../../services/content/projects.service.ts'

export default defineAdminHandler({
  permission: { project: ['read'] },
  handler: async event => listProjects(useDb(event)),
})
