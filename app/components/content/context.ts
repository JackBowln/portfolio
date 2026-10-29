// What every node of a rendered document can read: the media map, the heading anchors and the site origin (to
// tell external links apart). ContentRenderer provides it once
import { inject } from 'vue'
import type { InjectionKey } from 'vue'
import type { PublicMediaMap } from '#shared/media/public'

export interface ContentContext {
  media: PublicMediaMap
  anchors: Map<string, string>
  siteUrl: string
}

export const CONTENT_CONTEXT: InjectionKey<ContentContext> = Symbol('content')

export function useContentContext(): ContentContext {
  const context = inject(CONTENT_CONTEXT)
  if (!context) {
    throw new Error('content nodes render inside ContentRenderer')
  }
  return context
}
