// One registry for the three content types, so the localization and revision repositories are written once.
// The tables share their column groups (server/db/schema/content.ts); only the entity foreign key differs
import {
  articleLocalizations,
  articleRevisions,
  articles,
  pageLocalizations,
  pageRevisions,
  pages,
  projectLocalizations,
  projectRevisions,
  projects,
} from '../../db/schema/content.ts'

export const contentTables = {
  article: {
    entity: articles,
    localizations: articleLocalizations,
    revisions: articleRevisions,
    localizationEntityId: articleLocalizations.articleId,
    revisionEntityId: articleRevisions.articleId,
    entityKey: 'articleId',
  },
  project: {
    entity: projects,
    localizations: projectLocalizations,
    revisions: projectRevisions,
    localizationEntityId: projectLocalizations.projectId,
    revisionEntityId: projectRevisions.projectId,
    entityKey: 'projectId',
  },
  page: {
    entity: pages,
    localizations: pageLocalizations,
    revisions: pageRevisions,
    localizationEntityId: pageLocalizations.pageId,
    revisionEntityId: pageRevisions.pageId,
    entityKey: 'pageId',
  },
} as const

export type ContentTables = typeof contentTables

/** The lead text of a public list item: the excerpt of an article, the summary of a project */
export const publishedLead = {
  article: articleLocalizations.publishedExcerpt,
  project: projectLocalizations.publishedSummary,
} as const
