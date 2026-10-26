// Pure logic of `pnpm check:i18n` (ADR-0008 §2): every locale must mirror the pt-BR message tree
export interface Messages {
  [key: string]: string | Messages
}

export type IssueKind = 'missing' | 'orphan' | 'type' | 'empty' | 'placeholders' | 'plural-forms'

export interface I18nIssue {
  locale: string
  key: string
  kind: IssueKind
  detail?: string
}

type Leaf = string | Messages

function flatten(messages: Messages, prefix = '', out = new Map<string, Leaf>()): Map<string, Leaf> {
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key
    out.set(path, value)
    if (typeof value === 'object') {
      flatten(value, path, out)
    }
  }
  return out
}

// Named interpolations ({date}); vue-i18n literal interpolations ({'@'}) are not variables
function parentOf(key: string): string {
  return key.includes('.') ? key.slice(0, key.lastIndexOf('.')) : ''
}

// A key is reported only when its parent is a group on the other side; otherwise the parent already carries the issue
function parentIsGroup(keys: Map<string, Leaf>, key: string): boolean {
  const parent = parentOf(key)
  return parent === '' || typeof keys.get(parent) === 'object'
}

function placeholders(message: string): string[] {
  return [...new Set([...message.matchAll(/\{\s*([A-Za-z_]\w*)\s*\}/g)].map(match => match[1] ?? ''))].sort()
}

function pluralForms(message: string): number {
  return message.split('|').length
}

/** Compares one locale against the source; keys under `optionalPrefixes` may be missing (e.g. pt-BR-only admin) */
export function compareMessages(
  source: Messages,
  target: Messages,
  locale: string,
  optionalPrefixes: readonly string[] = [],
): I18nIssue[] {
  const issues: I18nIssue[] = []
  const sourceKeys = flatten(source)
  const targetKeys = flatten(target)
  const isOptional = (key: string) => optionalPrefixes.some(prefix => key === prefix || key.startsWith(`${prefix}.`))

  for (const [key, sourceValue] of sourceKeys) {
    const targetValue = targetKeys.get(key)
    if (targetValue === undefined) {
      if (!isOptional(key) && parentIsGroup(targetKeys, key)) {
        issues.push({ locale, key, kind: 'missing' })
      }
      continue
    }
    if (typeof sourceValue !== typeof targetValue) {
      issues.push({ locale, key, kind: 'type', detail: `expected ${typeof sourceValue === 'string' ? 'message' : 'group'}` })
      continue
    }
    if (typeof sourceValue !== 'string' || typeof targetValue !== 'string') {
      continue
    }
    if (targetValue.trim() === '') {
      issues.push({ locale, key, kind: 'empty' })
      continue
    }
    const expected = placeholders(sourceValue).join(', ')
    const actual = placeholders(targetValue).join(', ')
    if (expected !== actual) {
      issues.push({ locale, key, kind: 'placeholders', detail: `expected {${expected}}, found {${actual}}` })
    }
    if (pluralForms(sourceValue) !== pluralForms(targetValue)) {
      issues.push({ locale, key, kind: 'plural-forms', detail: `expected ${pluralForms(sourceValue)}, found ${pluralForms(targetValue)}` })
    }
  }

  for (const key of targetKeys.keys()) {
    if (!sourceKeys.has(key) && parentIsGroup(sourceKeys, key)) {
      issues.push({ locale, key, kind: 'orphan' })
    }
  }

  return issues
}

export function formatIssue(issue: I18nIssue): string {
  return `${issue.locale.padEnd(6)} ${issue.kind.padEnd(13)} ${issue.key}${issue.detail ? `  (${issue.detail})` : ''}`
}
