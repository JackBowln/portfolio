// pnpm check:i18n [--dir i18n/locales]
// Exits 1 when a locale file is missing, extra, or does not mirror the pt-BR keys (docs/architecture/i18n-seo.md §7).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { LOCALES, SOURCE_LOCALE } from '../shared/types/enums.ts'
import { compareMessages, formatIssue } from './i18n/compare.ts'
import type { Messages } from './i18n/compare.ts'

// Admin UI is pt-BR only in v1, `en` optional (i18n-seo §7)
const OPTIONAL_PREFIXES = ['admin']

const { values } = parseArgs({ options: { dir: { type: 'string', default: 'i18n/locales' } } })

const files = readdirSync(values.dir).filter(file => file.endsWith('.json'))
const problems: string[] = []

for (const file of files) {
  if (!LOCALES.includes(file.replace(/\.json$/, '') as (typeof LOCALES)[number])) {
    problems.push(`${file}: not a configured locale`)
  }
}

const read = (locale: string) => JSON.parse(readFileSync(join(values.dir, `${locale}.json`), 'utf8')) as Messages
const source = read(SOURCE_LOCALE)

for (const locale of LOCALES.filter(code => code !== SOURCE_LOCALE)) {
  if (!files.includes(`${locale}.json`)) {
    problems.push(`${locale}: missing ${locale}.json`)
    continue
  }
  problems.push(...compareMessages(source, read(locale), locale, OPTIONAL_PREFIXES).map(formatIssue))
}

if (problems.length > 0) {
  console.error(`check:i18n: ${problems.length} problem(s) against ${SOURCE_LOCALE}\n`)
  for (const problem of problems) {
    console.error(`  ${problem}`)
  }
  process.exit(1)
}

console.log(`check:i18n: ${LOCALES.length} locales mirror ${SOURCE_LOCALE} (${files.length} files)`)
