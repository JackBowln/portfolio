// F11-T3: the redirect middleware reads D1 only for paths shaped like an article or a project, in every locale
import { describe, expect, it } from 'vitest'
import { ARTICLE_PATH, articlePath, PROJECT_PATH, projectPath, topicPath } from '../../shared/content/paths'
import { LOCALES } from '../../shared/types/enums'

describe('redirect path shapes', () => {
  it('match articles and projects in the five locales, and nothing else', () => {
    for (const locale of LOCALES) {
      expect(ARTICLE_PATH.test(articlePath(locale, 'um-artigo')), locale).toBe(true)
      expect(PROJECT_PATH.test(projectPath(locale, 'um-projeto')), locale).toBe(true)
      expect(ARTICLE_PATH.test(topicPath(locale, 'um-tema')), locale).toBe(false)
      expect(PROJECT_PATH.test(articlePath(locale, 'um-artigo')), locale).toBe(false)
    }
    for (const path of ['/blog', '/blog/', '/it/blog/x', '/pt-BR/blog/x', '/blog/Maiusculo', '/admin/blog/x', '/projetos', '/en/projetos/x']) {
      expect(ARTICLE_PATH.test(path) || PROJECT_PATH.test(path), path).toBe(false)
    }
  })
})
