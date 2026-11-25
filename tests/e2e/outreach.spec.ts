// F13-T7 (decision D-02): the outreach draft on the contact page. The visitor describes an opportunity, chooses a tone and
// gets a draft; the draft is made in the browser (no request is sent while it is made, nothing is stored), and it can be
// copied to the clipboard
import { expect, test } from '@playwright/test'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'The clipboard check runs in desktop Chromium')

test('the draft is made in the browser, with no request, and can be copied', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/contato')
  await expect(page.getByRole('heading', { name: 'Rascunhar uma mensagem' })).toBeVisible({ timeout: 30_000 })

  await page.getByLabel('Seu nome (opcional)').fill('Alex')
  await page.getByLabel('Empresa ou equipe (opcional)').fill('Acme')
  await page.getByLabel('A oportunidade ou colaboração').fill('Uma vaga de frontend num sistema de design, com migração para Vue 3.')
  await page.getByRole('radio', { name: 'Direto' }).check()

  const requests: string[] = []
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType()) || request.method() !== 'GET') {
      requests.push(`${request.method()} ${request.url()}`)
    }
  })
  await page.getByRole('button', { name: 'Gerar rascunho' }).click()

  const draft = page.getByRole('textbox', { name: 'Rascunho' })
  await expect(draft).toHaveValue(/Oi, Alex,/)
  await expect(draft).toHaveValue(/Sobre a oportunidade na Acme:/)
  await expect(draft).toHaveValue(/Uma vaga de frontend num sistema de design, com migração para Vue 3\./)
  await expect(draft).toHaveValue(/Se fizer sentido, podemos conversar\./)
  expect(requests, 'the draft must not send anything').toEqual([])

  await page.getByRole('button', { name: 'Copiar rascunho' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Rascunho copiado.' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await draft.inputValue())
})
