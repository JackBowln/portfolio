// The outreach draft (F13-T7, decision D-02): a template filled from what the visitor typed, written in the owner's
// voice. It runs in the browser: nothing is sent, stored or requested. It claims only what the owner's CV supports,
// and the copy comes in as a parameter so this function is tested without the i18n messages
export type OutreachTone = 'professional' | 'concise' | 'warm'

export interface OutreachInput {
  name: string
  company: string
  opportunity: string
  tone: OutreachTone
}

export interface OutreachCopy {
  greeting: Record<OutreachTone, string>
  presentation: Record<OutreachTone, string>
  /** Contains `{company}` */
  forCompany: string
  forOpportunity: string
  closing: Record<OutreachTone, string>
}

/** The draft as plain text, paragraphs separated by a blank line; empty while the opportunity is empty */
export function draftOutreach(input: OutreachInput, copy: OutreachCopy): string {
  const opportunity = input.opportunity.trim()
  if (opportunity === '') {
    return ''
  }
  const name = input.name.trim()
  const company = input.company.trim()
  const greeting = copy.greeting[input.tone].replace('{name}', name === '' ? '' : `, ${name}`)
  const context = company === '' ? copy.forOpportunity : copy.forCompany.replace('{company}', company)
  return [greeting, copy.presentation[input.tone], context, opportunity, copy.closing[input.tone]].join('\n\n')
}
