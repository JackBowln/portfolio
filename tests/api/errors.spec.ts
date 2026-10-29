// F01-T5: localized 404 and 500 pages (RF-01.8) with the right status, the locale's language and a way home.
// /_test/server-error exists only in the test build
import { expect, test } from '@playwright/test'

const HTML = { 'accept': 'text/html', 'sec-fetch-mode': 'navigate' }

const LOCALES = [
  { prefix: '', lang: 'pt-BR', home: '/', notFound: 'Página não encontrada', server: 'Algo deu errado', back: 'Voltar para a página inicial' },
  { prefix: '/en', lang: 'en', home: '/en', notFound: 'Page not found', server: 'Something went wrong', back: 'Back to the home page' },
  { prefix: '/es', lang: 'es', home: '/es', notFound: 'Página no encontrada', server: 'Algo salió mal', back: 'Volver a la página de inicio' },
  { prefix: '/de', lang: 'de', home: '/de', notFound: 'Seite nicht gefunden', server: 'Etwas ist schiefgelaufen', back: 'Zurück zur Startseite' },
  { prefix: '/fr', lang: 'fr', home: '/fr', notFound: 'Page introuvable', server: 'Une erreur s’est produite', back: 'Retour à l’accueil' },
]

/** Visible text of the page body, without Vue's fragment comments and the inline scripts */
function bodyText(html: string): string {
  return html.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '')
}

for (const locale of LOCALES) {
  test(`${locale.lang}: an unknown route is a localized 404 with a link to the locale's home`, async ({ request }) => {
    for (const path of [`${locale.prefix}/does-not-exist`, `${locale.prefix}/blog/x/y`]) {
      const response = await request.get(path, { headers: HTML })
      const html = await response.text()
      const text = bodyText(html)

      expect(response.status(), path).toBe(404)
      expect(response.headers()['set-cookie'], path).toBeUndefined()
      expect(html, path).toMatch(new RegExp(`<html\\s+lang="${locale.lang}"`))
      expect(text, path).toMatch(new RegExp(`<h1[^>]*>${locale.notFound}</h1>`))
      expect(text, path).toMatch(new RegExp(`<a href="${locale.home}"[^>]*>${locale.back}</a>`))
      expect(html, path).toContain('<meta name="robots" content="noindex">')
    }
  })

  test(`${locale.lang}: a server error is a localized 500 that shows no error details`, async ({ request }) => {
    for (const query of ['', '?unhandled']) {
      const path = `${locale.prefix}/_test/server-error${query}`
      const response = await request.get(path, { headers: HTML })
      const html = await response.text()

      expect(response.status(), path).toBe(500)
      expect(response.headers()['set-cookie'], path).toBeUndefined()
      expect(html, path).toMatch(new RegExp(`<html\\s+lang="${locale.lang}"`))
      expect(bodyText(html), path).toMatch(new RegExp(`<h1[^>]*>${locale.server}</h1>`))
      expect(html, path).not.toContain('TEST internal detail')
      expect(html, path).not.toMatch(/server-error\.vue|at\s+\S+\s+\(/)
    }
  })
}
