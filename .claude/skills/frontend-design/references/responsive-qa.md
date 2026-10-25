# QA visual e responsivo

## Matriz mínima

| Viewport | Dispositivo de referência | O que olhar |
|---|---|---|
| 320 | reflow (WCAG 1.4.10) | Sem rolagem horizontal; conteúdo completo |
| 360 / 390 | Android médio / iPhone | Hierarquia, alvos de toque, menu mobile, LCP visível |
| 768 | tablet retrato | Transição do grid (4 → 8 colunas) |
| 1024 / 1280 | laptop | Grid de 12 colunas, medida de leitura |
| 1440 / 1920 | desktop grande | Container máximo, respiros, imagens nítidas (srcset) |

Repita nos **temas claro e escuro** e com **movimento reduzido**. Confira também o **zoom de 200%**.

## Screenshots com Playwright (padrão de referência)

```ts
// tests/visual/<template>.spec.ts
import { test, expect } from '@playwright/test'

const viewports = [360, 390, 768, 1024, 1280, 1440, 1920]

for (const width of viewports) {
  test(`home @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
    await page.goto('/')
    await expect(page).toHaveScreenshot(`home-${width}-light.png`, { fullPage: true })
  })
}
```

- Baselines só no CI Linux (as fontes renderizam diferente entre sistemas operacionais).
- Para o relatório local, salve os prints em `reports/visual/` (ignorado pelo git) e cite os caminhos.

## Teclado (roteiro rápido)

1. Tab a partir do topo: o skip link aparece e funciona.
2. Toda a navegação, o seletor de idioma, o menu mobile (abrir, navegar, `Esc`) e os CTAs ficam alcançáveis em ordem lógica.
3. Foco sempre visível, nunca coberto pelo header fixo.
4. Nenhuma armadilha de foco fora de dialogs.

## Erros comuns

- Texto sobre imagem sem contraste garantido (use overlay com token).
- `line-clamp` cortando informação essencial sem acesso ao texto completo.
- Ícone sem rótulo em botão.
- Imagem sem `sizes` (baixa a variante maior no mobile).
- Fonte trocando de métrica no carregamento (CLS): confira o fallback do `@nuxt/fonts`.
