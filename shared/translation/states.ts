// Translation states of a localization ≠ pt-BR (F09-T1, data-model §8, ADR-0009 §8). Pure, shared by the server, which
// decides, and the admin, which only labels. Nothing machine-translated is published without a human approval
import type { TranslationState } from '../types/enums.ts'

export const TRANSLATION_TRANSITIONS: Record<TranslationState, readonly TranslationState[]> = {
  source: [],
  missing: ['machine', 'in_review'],
  machine: ['in_review', 'approved'],
  in_review: ['approved'],
  approved: ['outdated'],
  outdated: ['in_review'],
}

export function canTransition(from: TranslationState, to: TranslationState): boolean {
  return TRANSLATION_TRANSITIONS[from].includes(to)
}

/** States that still need someone before a locale can be published */
export const PENDING_STATES = ['missing', 'machine', 'in_review', 'outdated'] as const satisfies readonly TranslationState[]

export function isPublishable(state: TranslationState): boolean {
  return state === 'source' || state === 'approved'
}
