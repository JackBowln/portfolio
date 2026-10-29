// F05-T3: the admin editor in Chromium (ADR-0006 §3), on the test page with a save stub that runs the document
// schema on the server: a document with every node built through the toolbar, shortcuts and dialogs passes;
// the toolbar works by keyboard alone; and HTML pasted from elsewhere ends up as allowed nodes only
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { readyImage, readyVideo, uniqueName } from '../support/media-api'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'The editor runs in desktop Chromium here; axe covers the rest')

async function openEditor(page: Page) {
  expect((await page.context().request.post('/api/_test/session?role=owner', { headers: { origin: SITE_ORIGIN } })).status()).toBe(200)
  await page.goto('/admin/_test/editor')
  const text = page.getByRole('textbox', { name: 'Corpo do documento' })
  await expect(text).toBeVisible()
  return { text, toolbar: page.getByRole('toolbar', { name: 'Formatação e blocos' }) }
}

const button = (toolbar: Locator, name: string) => toolbar.getByRole('button', { name, exact: true })

async function save(page: Page) {
  await page.getByRole('button', { name: 'Validar' }).click()
  const output = page.getByTestId('save-result')
  await expect(output).not.toBeEmpty()
  return JSON.parse((await output.textContent())!) as { ok: boolean, issues?: unknown[], types?: string[], derived?: { toc: { text: string }[], mediaUsages: { mediaId: string, context: string }[], wordCount: number } }
}

async function pick(page: Page, name: string) {
  const picker = page.getByRole('dialog', { name: 'Escolher da biblioteca' })
  await expect(picker).toBeVisible()
  await picker.getByRole('searchbox').fill(name)
  await picker.getByRole('searchbox').press('Enter')
  await picker.getByRole('button', { name: `Escolher ${name}` }).click()
  await expect(picker).toBeHidden()
}

test('a document with every node type is built in the editor and passes the server schema', async ({ page }) => {
  test.setTimeout(120_000)
  const request = page.context().request
  const { text, toolbar } = await openEditor(page)
  const names = { photo: uniqueName('foto', 'jpg'), second: uniqueName('segunda', 'jpg'), third: uniqueName('terceira', 'jpg'), poster: uniqueName('capa', 'jpg'), video: uniqueName('clipe', 'mp4') }
  const photo = await readyImage(request, names.photo)
  const second = await readyImage(request, names.second)
  const third = await readyImage(request, names.third)
  const poster = await readyImage(request, names.poster)
  const video = await readyVideo(request, names.video, poster)

  await text.click()
  // Headings and marks by shortcut
  await page.keyboard.press('ControlOrMeta+Alt+2')
  await page.keyboard.type('Introdução')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Texto ')
  await page.keyboard.press('ControlOrMeta+b')
  await page.keyboard.type('forte')
  await page.keyboard.press('ControlOrMeta+b')
  await page.keyboard.press('ControlOrMeta+i')
  await page.keyboard.type(' leve')
  await page.keyboard.press('ControlOrMeta+i')
  await button(toolbar, 'Tachado').click()
  await page.keyboard.type(' riscado')
  await button(toolbar, 'Tachado').click()
  await button(toolbar, 'Código no texto').click()
  await page.keyboard.type(' x()')
  await button(toolbar, 'Código no texto').click()
  // A link on the last word, through the dialog
  await page.keyboard.type(' site')
  for (let step = 0; step < 4; step++) {
    await page.keyboard.press('Shift+ArrowLeft')
  }
  await page.keyboard.press('ControlOrMeta+k')
  const link = page.getByRole('dialog', { name: 'Link' })
  await link.getByLabel('Endereço').fill('javascript:alert(1)')
  await link.getByRole('button', { name: 'Aplicar' }).click()
  await expect(link.getByText('Use um endereço https://')).toBeVisible()
  await link.getByLabel('Endereço').fill('https://example.com/a')
  await link.getByRole('button', { name: 'Aplicar' }).click()
  await expect(link).toBeHidden()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')

  // Lists: Enter on an empty item leaves the list
  await page.keyboard.press('ControlOrMeta+Shift+8')
  await page.keyboard.type('Um')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.keyboard.type('Um ponto um')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.press('ControlOrMeta+Shift+7')
  await page.keyboard.type('Primeiro')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')

  // Quote and callout: wrap, then toggle again to leave on a new paragraph
  await page.keyboard.type('Uma citação')
  await button(toolbar, 'Citação').click()
  await page.keyboard.press('Enter')
  await button(toolbar, 'Citação').click()
  await page.keyboard.type('Atenção aqui')
  await button(toolbar, 'Destaque').click()
  const context = page.getByRole('toolbar', { name: 'Bloco atual' })
  await button(context, 'Perigo').click()
  await expect(button(context, 'Perigo')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Enter')
  await button(toolbar, 'Destaque').click()
  await page.keyboard.press('ControlOrMeta+Alt+3')
  await page.keyboard.type('Blocos')
  await page.keyboard.press('Enter')
  await page.keyboard.press('ControlOrMeta+Alt+4')
  await page.keyboard.type('Detalhe')
  await page.keyboard.press('Enter')
  await button(toolbar, 'Divisor').click()

  // Code: the node view highlights with Shiki in the browser
  await button(toolbar, 'Bloco de código').click()
  const code = page.locator('[data-node-view="codeBlock"]')
  await code.getByLabel('Linguagem').selectOption('ts')
  await code.getByLabel('Código').fill('const answer: number = 42\nconsole.log(answer)')
  await expect(code.getByRole('group', { name: 'Pré-visualização do destaque' }).locator('pre.shiki span[style]').first()).toBeVisible()

  // Media from the library
  await button(toolbar, 'Imagem').click()
  await pick(page, names.photo)
  await page.locator('[data-node-view="image"]').getByLabel('Legenda (opcional)').fill('Legenda da foto')
  await button(toolbar, 'Galeria').click()
  const gallery = page.getByRole('dialog', { name: 'Inserir galeria' })
  await expect(gallery.getByRole('button', { name: 'Inserir galeria' })).toBeDisabled()
  await gallery.getByRole('button', { name: 'Adicionar imagem' }).click()
  await pick(page, names.second)
  await gallery.getByRole('button', { name: 'Adicionar imagem' }).click()
  await pick(page, names.third)
  await gallery.getByRole('button', { name: 'Inserir galeria' }).click()
  await expect(gallery).toBeHidden()
  await button(toolbar, 'Vídeo').click()
  await pick(page, names.video)
  await button(toolbar, 'Incorporar').click()
  const embed = page.getByRole('dialog', { name: 'Incorporar vídeo' })
  await embed.getByLabel('ID do vídeo').fill('https://youtu.be/x')
  await embed.getByRole('button', { name: 'Incorporar' }).click()
  await expect(embed.getByText('Um ID do YouTube tem 11 letras')).toBeVisible()
  await embed.getByLabel('ID do vídeo').fill('dQw4w9WgXcQ')
  await embed.getByLabel('Título do vídeo').fill('Palestra sobre acessibilidade')
  await embed.getByRole('button', { name: 'Escolher imagem de capa' }).click()
  await pick(page, names.poster)
  await embed.getByRole('button', { name: 'Incorporar', exact: true }).click()
  await expect(embed).toBeHidden()

  // A table, filled from its first cell
  await button(toolbar, 'Tabela').click()
  await page.keyboard.type('Coluna')
  await button(page.getByRole('toolbar', { name: 'Bloco atual' }), 'Adicionar coluna').click()

  const result = await save(page)
  expect(result.issues ?? []).toEqual([])
  expect(result.ok).toBe(true)
  expect(result.types).toEqual(['blockquote', 'bulletList', 'callout', 'codeBlock', 'doc', 'embed', 'gallery', 'heading', 'horizontalRule', 'image', 'listItem', 'orderedList', 'paragraph', 'table', 'tableCell', 'tableHeader', 'tableRow', 'text', 'video'])
  expect(result.derived!.toc.map(entry => entry.text)).toEqual(['Introdução', 'Blocos'])
  expect(result.derived!.mediaUsages).toEqual(expect.arrayContaining([
    { mediaId: photo, context: 'body' },
    { mediaId: video, context: 'body' },
    { mediaId: second, context: 'gallery' },
    { mediaId: third, context: 'gallery' },
    { mediaId: poster, context: 'poster' },
  ]))
  await expect(page.getByTestId('editor-stats')).toContainText(`${result.derived!.wordCount} palavras`)
})

test('the toolbar and the editor work by keyboard alone', async ({ page }) => {
  const { text, toolbar } = await openEditor(page)
  // One tab stop for the toolbar, then the text
  const first = button(toolbar, 'Parágrafo')
  for (let step = 0; step < 20 && !(await first.evaluate(element => element === document.activeElement)); step++) {
    await page.keyboard.press('Tab')
  }
  await expect(first).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(button(toolbar, 'Título 2')).toBeFocused()
  await page.keyboard.press('End')
  await expect(button(toolbar, 'Atalhos')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(first).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(text).toBeFocused()

  await page.keyboard.type('Primeiro')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Segundo')
  await page.keyboard.press('Alt+Shift+ArrowUp')
  await expect(text.locator('p').first()).toHaveText('Segundo')
  // Esc leaves the text for the toolbar, on the last used button
  await page.keyboard.press('Escape')
  await expect(first).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(text.locator('h2')).toHaveText('Segundo')

  // Every shortcut is listed; the dialog opens by keyboard and closes with Esc
  await text.click()
  await page.keyboard.press('ControlOrMeta+/')
  const shortcuts = page.getByRole('dialog', { name: 'Atalhos do editor' })
  await expect(shortcuts).toBeVisible()
  await expect(shortcuts.getByRole('row')).toHaveCount(23)
  await page.keyboard.press('Escape')
  await expect(shortcuts).toBeHidden()

  for (const name of ['Negrito', 'Lista', 'Imagem', 'Mover bloco para cima', 'Desfazer']) {
    const control = button(toolbar, name)
    await expect(control).toHaveAccessibleName(name)
  }
  await expect(button(toolbar, 'Negrito')).toHaveAttribute('aria-keyshortcuts', /^(?:Control|Meta)\+B$/)
  expect((await save(page)).ok).toBe(true)
})

test('HTML pasted from elsewhere keeps only allowed nodes and passes the schema', async ({ page }) => {
  const { text } = await openEditor(page)
  await text.click()
  await text.evaluate((element) => {
    const data = new DataTransfer()
    data.setData('text/html', [
      '<h1>Título de fora</h1><p style="color:red">Texto <b>forte</b> <u>sublinhado</u> <a href="javascript:alert(1)">mau</a> <a href="https://example.com/b" target="_blank">bom</a></p>',
      '<img src="https://example.com/x.png" onerror="alert(1)"><script>alert(1)</script><iframe src="https://example.com"></iframe>',
      '<table><tr><td colspan="3"><h2>Célula</h2></td></tr></table><pre class="language-js"><code>let a = 1</code></pre>',
    ].join(''))
    data.setData('text/plain', 'Título de fora')
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
  await expect(text.locator('pre, [data-node-view="codeBlock"]').first()).toBeVisible()
  const result = await save(page)
  expect(result.issues ?? []).toEqual([])
  expect(result.ok).toBe(true)
  await expect(text).toContainText('Título de fora')
  await expect(text.locator('a[href^="javascript"], img, iframe, script, u, h1')).toHaveCount(0)
  await expect(text.locator('a[href="https://example.com/b"]')).toHaveCount(1)
})
