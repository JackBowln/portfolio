// Real images for browser tests: a JPEG screenshot with an EXIF/GPS block, so the admin pipeline gets a phone-like
// photo and no binary fixture lives in the repository
import { randomBytes } from 'node:crypto'
import type { Browser } from '@playwright/test'
import { withExif } from './media'

/**
 * A colorful JPEG of the given size, rendered by the browser itself. The random color makes each fixture a new
 * file: the API stores a hash once, and the local database outlives a run
 */
export async function photo(browser: Browser, width: number, height: number): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width, height } })
  const color = `#${randomBytes(3).toString('hex')}`
  await page.setContent(`<body style="margin:0;background:
    radial-gradient(circle at 30% 40%, ${color}, transparent 40%),
    radial-gradient(circle at 70% 60%, #3dd5ff, transparent 45%),
    linear-gradient(135deg, #1b2a4a, #f2c14e)"></body>`)
  const jpeg = await page.screenshot({ type: 'jpeg', quality: 90 })
  await page.close()
  return withExif(jpeg)
}
