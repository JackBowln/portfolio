// pnpm check:contrast [--css app/assets/css/main.css]
// Exits 1 when a semantic color pair is under WCAG 2.2 AA in either theme (ADR-0010 §2), when a pair names a missing
// token, or when a color is outside sRGB.
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { AA_MINIMUM, checkContrast, contrastPasses } from '../shared/design/contrast.ts'
import { themeColors } from '../shared/design/css-tokens.ts'

const { values } = parseArgs({ options: { css: { type: 'string', default: 'app/assets/css/main.css' } } })

const report = checkContrast(themeColors(readFileSync(values.css, 'utf8')))
// Truncated, so a ratio just under the minimum never prints as passing
const format = (ratio: number) => `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`

for (const result of report.results) {
  const mark = result.pass ? 'ok  ' : 'FAIL'
  console.log(`${mark} ${result.theme.padEnd(5)} ${`${result.foreground} × ${result.background}`.padEnd(28)} ${format(result.ratio).padStart(8)}  (${result.use} ≥ ${AA_MINIMUM[result.use]}:1)`)
}
for (const problem of report.problems) {
  console.log(`FAIL ${problem}`)
}

if (!contrastPasses(report)) {
  const failed = report.results.filter(result => !result.pass).length + report.problems.length
  console.error(`\ncheck:contrast: ${failed} failure(s) in ${values.css}`)
  process.exit(1)
}

console.log(`\ncheck:contrast: ${report.results.length} pairs pass AA in ${values.css}`)
