// robots.txt per environment (ADR-0008 §6): production allows everything but the private areas and points to the
// sitemap; any other environment (local, preview) blocks crawling
export function robotsTxt(environment: string, siteUrl: string): string {
  const lines = environment === 'production'
    ? ['User-agent: *', 'Disallow: /admin', 'Disallow: /api', 'Disallow: /preview', '', `Sitemap: ${siteUrl.replace(/\/$/, '')}/sitemap.xml`]
    : ['User-agent: *', 'Disallow: /']
  return `${lines.join('\n')}\n`
}
