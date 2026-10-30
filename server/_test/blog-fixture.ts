// Test-only (PORTFOLIO_TEST_BUILD=1): the content the route, layout, CSP and a11y specs open at /blog/x,
// /blog/temas/x (F06-T5) and /projetos/x (F07-T2) since those pages are real. Idempotent: an article and a project
// with slug `x` published in the five locales, a topic `x` named in all of them and a technology. Translations are
// written straight to the table, as the translation flow is F09
import { eq } from 'drizzle-orm'
import { LOCALES, SOURCE_LOCALE } from '../../shared/types/enums.ts'
import type { Db } from '../db/client.ts'
import { users } from '../db/schema/auth.ts'
import { tagLocalizations } from '../db/schema/taxonomy.ts'
import { findPublishedArticle, findTopic } from '../services/content/blog.repo.ts'
import { createArticle, getArticle, updateArticle } from '../services/content/articles.service.ts'
import { createLocalization } from '../services/content/localized.repo.ts'
import { publishArticle } from '../services/content/publishing.service.ts'
import { findPublishedProject, findTechnology } from '../services/content/projects-public.repo.ts'
import { createProject, getProject, publishProject, updateProject } from '../services/content/projects.service.ts'
import { createTag, createTopic } from '../services/content/tags.service.ts'

const EMAIL = 'blog-fixture@example.test'
const body = {
  type: 'doc' as const,
  content: [
    { type: 'paragraph' as const, attrs: { id: 'p1' }, content: [{ type: 'text' as const, text: '[PLACEHOLDER] Texto de exemplo do artigo de teste.' }] },
    { type: 'heading' as const, attrs: { id: 'h1', level: 2 as const }, content: [{ type: 'text' as const, text: 'Primeira seção' }] },
    { type: 'paragraph' as const, attrs: { id: 'p2' }, content: [{ type: 'text' as const, text: '[PLACEHOLDER] Mais texto.' }] },
    { type: 'heading' as const, attrs: { id: 'h2', level: 2 as const }, content: [{ type: 'text' as const, text: 'Segunda seção' }] },
    { type: 'paragraph' as const, attrs: { id: 'p3' }, content: [{ type: 'text' as const, text: '[PLACEHOLDER] Fim.' }] },
  ],
}

async function fixtureUser(db: Db): Promise<string> {
  const [found] = await db.select({ id: users.id }).from(users).where(eq(users.email, EMAIL))
  return found?.id ?? (await db.insert(users).values({ name: 'Blog fixture', email: EMAIL }).returning({ id: users.id }))[0]!.id
}

/** The project `x` in the five locales, with one technology and one result */
async function ensureProjectFixture(db: Db, userId: string): Promise<void> {
  if (await findPublishedProject(db, SOURCE_LOCALE, 'x')) {
    return
  }
  const actor = { userId, ip: null, ipHashSalt: undefined }
  const technologyId = (await findTechnology(db, SOURCE_LOCALE, 'tecnologia-x'))?.id ?? (await createTag(db, userId, 'technology', { name: 'Tecnologia X', slug: 'tecnologia-x' })).id
  const project = await createProject(db, userId, 'x')
  const saved = await updateProject(db, userId, project, {
    version: 1,
    title: 'Projeto de exemplo [PLACEHOLDER]',
    slug: 'x',
    summary: '[PLACEHOLDER] Resumo do projeto de exemplo.',
    role: '[PLACEHOLDER] Papel',
    highlights: [{ label: '[PLACEHOLDER] Resultado', value: '[PLACEHOLDER]' }],
    body,
    technologyIds: [technologyId],
    periodStart: '2024-01',
    periodEnd: '2024-06',
    repoUrl: 'https://example.com/repo',
  })
  await publishProject(db, actor, saved, SOURCE_LOCALE, 2)
  const entity = { coverMediaId: null, galleryMediaIds: [], technologyIds: [technologyId], periodStart: '2024-01', periodEnd: '2024-06', repoUrl: 'https://example.com/repo', demoUrl: null }
  for (const locale of LOCALES.filter(code => code !== SOURCE_LOCALE)) {
    await createLocalization(db, 'project', { projectId: project.id, locale, title: `Example project (${locale}) [PLACEHOLDER]`, slug: 'x', summary: '[PLACEHOLDER]', role: '[PLACEHOLDER]', highlights: [{ label: '[PLACEHOLDER]', value: '[PLACEHOLDER]' }], body, translationState: 'approved' }, entity)
    await publishProject(db, actor, await getProject(db, project.id), locale, 1)
  }
}

/** Creates the fixture once; returns the article's id */
export async function ensureBlogFixture(db: Db): Promise<{ articleId: string }> {
  const userId = await fixtureUser(db)
  await ensureProjectFixture(db, userId)
  const existing = await findPublishedArticle(db, SOURCE_LOCALE, 'x')
  if (existing) {
    return { articleId: existing.articleId }
  }
  const actor = { userId, ip: null, ipHashSalt: undefined }

  const topicId = (await findTopic(db, SOURCE_LOCALE, 'x'))?.id ?? (await createTopic(db, userId, { name: 'x', slug: 'x' })).id
  await db.insert(tagLocalizations)
    .values(LOCALES.filter(locale => locale !== SOURCE_LOCALE).map(locale => ({ tagId: topicId, locale, name: 'x', slug: 'x', translationState: 'approved' as const })))
    .onConflictDoNothing()

  const article = await createArticle(db, userId, 'x')
  const saved = await updateArticle(db, userId, article, { version: 1, title: 'Artigo de exemplo [PLACEHOLDER]', slug: 'x', excerpt: '[PLACEHOLDER] Resumo do artigo de exemplo.', body, tagIds: [topicId] })
  await publishArticle(db, actor, saved, SOURCE_LOCALE, 2)
  for (const locale of LOCALES.filter(code => code !== SOURCE_LOCALE)) {
    await createLocalization(db, 'article', { articleId: article.id, locale, title: `Example article (${locale}) [PLACEHOLDER]`, slug: 'x', excerpt: '[PLACEHOLDER]', body, translationState: 'approved' }, { coverMediaId: null, tagIds: [topicId] })
    await publishArticle(db, actor, await getArticle(db, article.id), locale, 1)
  }
  return { articleId: article.id }
}
