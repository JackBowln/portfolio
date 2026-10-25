# Gate para 3D (Three.js) e efeitos SVG pesados

## 1. Critérios para entrar (todos obrigatórios)

- [ ] O storyboard aprovado descreve o efeito e o **ganho narrativo** que SVG ou CSS não alcançam.
- [ ] Existe um **poster estático** (imagem otimizada) que comunica a mesma ideia: ele é o LCP.
- [ ] O orçamento cabe: ≤ 180 KB gz adicionais, carregados depois do LCP e só quando a seção entra na viewport.
- [ ] O owner aprovou o custo, registrado no storyboard.

Sem isso, a F10-T5 é encerrada como "não aplicável".

## 2. Implementação

- Componente `*.client.vue` em `app/components/motion/`; `import('three')` só dentro de um IntersectionObserver (`rootMargin` de ~200 px).
- Renderer:
  - `powerPreference: 'low-power'` (ou `default`), `antialias` só se necessário;
  - `setPixelRatio(Math.min(devicePixelRatio, 1.5))`, até 2 só no desktop.
- Loop:
  - `renderer.setAnimationLoop` só enquanto visível;
  - pausar com o IntersectionObserver e com `document.visibilityState === 'hidden'`.
- Recursos: geometrias e texturas pequenas e comprimidas (KTX2/Basis só com justificativa, porque exigem um decoder extra).
- Limpeza no unmount: `renderer.setAnimationLoop(null)`, `dispose()` em geometrias, materiais, texturas e renderer, e `forceContextLoss()`.

## 3. Fallback (mostrar o poster e não iniciar o 3D)

- `prefers-reduced-motion: reduce` ou o toggle do site.
- Sem WebGL (`canvas.getContext('webgl2') ?? canvas.getContext('webgl')` nulo).
- `navigator.connection?.saveData === true`.
- `navigator.deviceMemory` < 4 (quando disponível).
- Erro de inicialização (`try/catch`): fica o poster, sem quebrar a página.

## 4. Medição

- Lighthouse da R1 com e sem o efeito (o relatório compara os dois).
- FPS: ≥ 60 no desktop médio; sem quedas sustentadas abaixo de 50 com CPU 4×.
- Memória: sem crescimento entre navegações (DevTools → Memory, 3 idas e voltas).

## 5. SVG animado

Prefira SVG inline + GSAP (DrawSVG/MorphSVG, gratuitos na licença no-charge) ou CSS. Mantenha os caminhos simplificados (SVGO na exportação), use `aria-hidden="true"` se for decorativo e `<title>` e `<desc>` se for informativo.
