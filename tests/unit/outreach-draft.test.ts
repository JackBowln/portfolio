// F13-T7: the outreach draft is a template filled from what the visitor typed. Without an opportunity there is no draft;
// the name and the company appear only when given; the tone changes the greeting, the presentation and the closing;
// no placeholder is left in the text; and the input is trimmed
import { describe, expect, it } from 'vitest'
import { draftOutreach } from '../../app/utils/outreach/draft'
import type { OutreachCopy } from '../../app/utils/outreach/draft'

const copy: OutreachCopy = {
  greeting: { professional: 'Hello{name},', concise: 'Hi{name},', warm: 'Hi{name}, thanks!' },
  presentation: { professional: 'Professional intro.', concise: 'Short intro.', warm: 'Warm intro.' },
  forCompany: 'About the opportunity at {company}:',
  forOpportunity: 'About your proposal:',
  closing: { professional: 'Professional close.', concise: 'Short close.', warm: 'Warm close.' },
}

const base = { name: '', company: '', opportunity: 'A frontend role on a design system.', tone: 'professional' as const }

describe('outreach draft', () => {
  it('has no draft until there is an opportunity', () => {
    expect(draftOutreach({ ...base, opportunity: '   ' }, copy)).toBe('')
  })

  it('greets by name only when a name is given', () => {
    expect(draftOutreach(base, copy).startsWith('Hello,')).toBe(true)
    expect(draftOutreach({ ...base, name: ' Alex ' }, copy).startsWith('Hello, Alex,')).toBe(true)
  })

  it('names the company only when one is given', () => {
    expect(draftOutreach(base, copy)).toContain('About your proposal:')
    expect(draftOutreach({ ...base, company: 'Acme' }, copy)).toContain('About the opportunity at Acme:')
    expect(draftOutreach({ ...base, company: 'Acme' }, copy)).not.toContain('About your proposal:')
  })

  it('changes the greeting, the presentation and the closing with the tone', () => {
    const warm = draftOutreach({ ...base, tone: 'warm' }, copy)
    expect(warm).toContain('Hi, thanks!')
    expect(warm).toContain('Warm intro.')
    expect(warm).toContain('Warm close.')
    expect(draftOutreach({ ...base, tone: 'concise' }, copy)).toContain('Short close.')
  })

  it('keeps the visitor\'s opportunity as written, and leaves no placeholder', () => {
    const text = draftOutreach({ ...base, opportunity: '  Vue 3 migration, six months.  ', company: 'Acme' }, copy)
    expect(text).toContain('\n\nVue 3 migration, six months.\n\n')
    expect(text).not.toMatch(/\{(name|company)\}/)
  })
})
