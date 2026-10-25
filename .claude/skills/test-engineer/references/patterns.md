# Padrões de teste (referência)

> Confira as APIs nas versões instaladas. A configuração exata do `@cloudflare/vitest-pool-workers` 0.23 com Vitest 4.1 é definida na F00-T4: siga o README do pacote nessa versão.

## Factories determinísticas

```ts
// tests/factories/article.ts
let seq = 0
export function makeArticleInput(overrides: Partial<ArticleInput> = {}): ArticleInput {
  seq += 1
  return {
    title: `[PLACEHOLDER] Article ${seq}`,
    slug: `placeholder-article-${seq}`,
    excerpt: '[PLACEHOLDER] excerpt',
    body: minimalDoc(),
    ...overrides,
  }
}
```

## Relógio falso (agendamento e expiração)

```ts
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T10:00:00Z')) })
afterEach(() => vi.useRealTimers())
```

## Passkey com autenticador WebAuthn virtual (Playwright + Chromium/CDP)

```ts
test('owner registers and signs in with a passkey', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  // … fluxo de registro e login pela interface
})
```

## axe (WCAG 2.2 AA)

```ts
import AxeBuilder from '@axe-core/playwright'

export async function expectNoSeriousA11yViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const serious = violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, JSON.stringify(serious.map(v => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([])
}
```

## Preferências de mídia e JS

```ts
await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
test.use({ javaScriptEnabled: false }) // por arquivo ou describe
```

## Matriz de autorização gerada

```ts
import { roles, statements } from '~~/shared/auth/permissions'
for (const role of Object.keys(roles)) {
  for (const [resource, actions] of Object.entries(statements)) {
    for (const action of actions) {
      const allowed = roles[role].includes(`${resource}:${action}`)
      test(`${role} ${allowed ? 'can' : 'cannot'} ${resource}:${action}`, async ({ request }) => {
        // usa a rota representativa de cada permissão (mapa em tests/api/permission-routes.ts)
      })
    }
  }
}
```

## Sem `Set-Cookie` nas respostas públicas

```ts
for (const url of publicUrls) {
  test(`no Set-Cookie on ${url}`, async ({ request }) => {
    const res = await request.get(url)
    expect(res.headers()['set-cookie']).toBeUndefined()
  })
}
```

## Provedor de IA falso

```ts
export class FakeTranslationProvider implements TranslationProvider {
  async estimate(req: TranslateRequest) { return { inputTokens: 100, outputTokens: 120, neurons: 10, costMicroUsd: 0 } }
  async translate(req: TranslateRequest) {
    return { segments: req.segments.map(s => ({ id: s.id, text: `[${req.targetLocale}] ${s.text}` })), usage: { neurons: 10 } }
  }
}
```
