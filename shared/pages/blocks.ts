// Institutional pages by blocks (F08-T2, data-model §4.6): one schema per PageKey for page_localizations.blocks,
// shared by the admin forms and the server, strict at every level. Rich text (about's introduction, privacy's
// body) is the shared document; everything else is plain text. Empty values are the starting point of a page that
// was never written: no invented content
import { z } from 'zod'
import { documentSchema } from '../content/document-schema.ts'
import type { DocumentJson } from '../content/document-schema.ts'
import type { PageKey } from '../types/enums.ts'

const text = (max: number) => z.string().trim().max(max)
const httpsUrl = z.string().trim().max(500).pipe(z.url({ protocol: /^https$/, hostname: z.regexes.domain, error: 'must be an https: link' }))

/** Pages the home's buttons can point at (decision 5): never a free URL */
export const PAGE_LINK_TARGETS = ['projects', 'blog', 'about', 'contact'] as const
const pageLink = z.strictObject({ label: text(60), target: z.enum(PAGE_LINK_TARGETS) })

export const pageBlockSchemas = {
  home: z.strictObject({
    hero: z.strictObject({ eyebrow: text(80), title: text(160), subtitle: text(300), cta: pageLink }),
    sections: z.array(z.strictObject({ title: text(120), text: text(1500) })).max(6),
    // Featured projects and the latest articles come from what is published (decision 2); only their titles here
    featuredTitle: text(120),
    articlesTitle: text(120),
    closing: z.strictObject({ title: text(160), text: text(500), cta: pageLink }),
  }),
  about: z.strictObject({
    intro: documentSchema.nullable(),
    timeline: z.array(z.strictObject({ period: text(40), title: text(120), text: text(500) })).max(20),
    skills: z.array(z.strictObject({ group: text(60), items: z.array(text(60)).max(20) })).max(10),
    links: z.array(z.strictObject({ label: text(60), url: httpsUrl })).max(10),
  }),
  contact: z.strictObject({ intro: text(600), success: text(300) }),
  privacy: z.strictObject({
    body: documentSchema.nullable(),
    /** YYYY-MM-DD, shown as "updated on" */
    updatedOn: z.iso.date().nullable(),
  }),
  blog: z.strictObject({ title: text(120), intro: text(400) }),
  projects: z.strictObject({ title: text(120), intro: text(400) }),
} satisfies Record<PageKey, z.ZodType>

export type PageBlocks<K extends PageKey> = z.output<(typeof pageBlockSchemas)[K]>

const emptyLink = { label: '', target: 'projects' as const }

/** What a page starts with: empty fields, never invented content */
export const EMPTY_PAGE_BLOCKS: { [K in PageKey]: PageBlocks<K> } = {
  home: {
    hero: { eyebrow: '', title: '', subtitle: '', cta: emptyLink },
    sections: [],
    featuredTitle: '',
    articlesTitle: '',
    closing: { title: '', text: '', cta: { label: '', target: 'contact' } },
  },
  about: { intro: null, timeline: [], skills: [], links: [] },
  contact: { intro: '', success: '' },
  privacy: { body: null, updatedOn: null },
  blog: { title: '', intro: '' },
  projects: { title: '', intro: '' },
}

/** The rich-text documents of a page's blocks, for media uses and the reading time */
export function pageDocuments(key: PageKey, blocks: unknown): DocumentJson[] {
  if (key === 'about') {
    const intro = (blocks as PageBlocks<'about'>).intro
    return intro ? [intro] : []
  }
  if (key === 'privacy') {
    const body = (blocks as PageBlocks<'privacy'>).body
    return body ? [body] : []
  }
  return []
}
