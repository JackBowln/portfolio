# Matriz de variantes e testes de motion

## Variantes obrigatórias por animação

| Variante | Como ativar | Expectativa |
|---|---|---|
| Desktop | ≥ 768 px, `pointer: fine` | Versão completa do storyboard |
| Mobile | < 768 px ou `pointer: coarse` | Timelines simplificadas, sem pin, sem parallax, sem hover magnético |
| Movimento reduzido | `prefers-reduced-motion: reduce` **ou** toggle do site | GSAP **não baixado**; estado final direto ou fade CSS ≤ 200 ms; View Transitions sem animação |
| Sem JS | JS desabilitado | Todo o conteúdo visível; nenhum elemento preso em `opacity: 0` |
| Falha de carregamento | Bloquear o chunk do GSAP | A classe `motion-ok` é removida em ≤ 3 s; conteúdo visível |

## Testes automatizados (padrões)

```ts
// Nuxt (Vitest): o GSAP não é importado com movimento reduzido
vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
const spy = vi.fn()
vi.doMock('~/composables/motion/gsap-bundle', () => { spy(); return {} })
// monte o componente e avance os timers → expect(spy).not.toHaveBeenCalled()
```

```ts
// Playwright: nenhum chunk de GSAP com movimento reduzido
test('reduced motion skips GSAP', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const gsapRequests: string[] = []
  page.on('request', r => { if (/gsap/i.test(r.url())) gsapRequests.push(r.url()) })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(gsapRequests).toEqual([])
})
```

```ts
// Playwright: conteúdo visível sem JS
test.use({ javaScriptEnabled: false })
test('home content visible without JS', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
```

Os nomes de chunk podem não conter "gsap" depois do build. Nesse caso, identifique pelo manifest ou force o nome com um chunk manual no Vite.

## WCAG relacionados

- 2.2.2 Pausar, parar, ocultar: movimento automático com mais de 5 s precisa de controle.
- 2.3.1 Três flashes: proibido.
- 2.3.3 Animação a partir de interações (AAA, adotado como boa prática): respeitar a preferência de movimento reduzido.
- 2.4.11 Foco não obscurecido: o foco nunca fica sob um elemento animado ou fixo.
