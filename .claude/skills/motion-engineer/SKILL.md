---
name: motion-engineer
description: Cria animações GSAP (ScrollTrigger, SplitText) impactantes e com controle de performance neste portfólio Nuxt 4 — storyboard primeiro, carregamento sob demanda após o LCP, variantes desktop/mobile/movimento reduzido/sem JS, View Transitions entre páginas e efeitos SVG ou Three.js só quando justificados. Use ao implementar ou revisar hero, scroll storytelling, microinterações, transições de página, efeitos SVG/3D ou qualquer código que importe gsap ou three.
when_to_use: "Gatilhos: 'animação', 'animar', 'GSAP', 'ScrollTrigger', 'SplitText', 'parallax', 'scroll storytelling', 'transição de página', 'microinteração', 'hover', 'efeito', 'Three.js', '3D', 'WebGL', 'SVG animado', 'cinematográfico'."
argument-hint: "[seção | componente | rota]"
---

# Motion Engineer

Movimento existe para **narrativa, hierarquia, continuidade ou feedback**: se não serve a nenhum desses, não entra. Decisão técnica no `docs/architecture/adr/0011-motion.md`; princípios, tokens e catálogo em `docs/design/motion-principles.md`.

## Pré-condições (pare se alguma falhar)

1. Existe um **storyboard aprovado** (`docs/design/storyboard-home.md`, F10-T1) cobrindo o que será animado. Fora dele → proponha uma alteração no storyboard e peça aprovação.
2. A rota permite motion: home e estudo de caso sim; **artigo do blog nunca** (RX-04).
3. O GSAP só é usado via `useMotion()` em `app/composables/motion/**` (import dinâmico).

## Implementação

Siga os padrões de [references/gsap-nuxt-patterns.md](references/gsap-nuxt-patterns.md):

- **Carregamento:** `import()` depois do `onMounted`, no idle e após o LCP; com movimento reduzido (preferência do sistema ou toggle do site), **não baixar** o GSAP.
- **Escopo e limpeza:** `gsap.context(fn, root)` e `ctx.revert()` no `onBeforeUnmount`; `gsap.matchMedia()` para breakpoints e preferências; `ScrollTrigger.refresh()` depois de `document.fonts.ready` e das imagens relevantes.
- **Progressive enhancement:** conteúdo visível sem JS; estados iniciais ocultos só sob `html.motion-ok`; **o elemento LCP nunca começa oculto**.
- **Propriedades:** só `transform` e `opacity` (e `clip-path` com moderação); `will-change` só durante a animação; nada de animar layout (`width`, `top`, `height`).
- **SplitText:** com `aria` habilitado (o texto continua legível como frase única) e `autoSplit` + `onSplit` para redimensionamento; reverter depois quando possível.
- **Scroll:** pin + scrub só a partir de `md`; mobile com timelines simplificadas; **sem scrolljacking** nem smooth scroll artificial.
- **Transições de página:** View Transitions (`experimental.viewTransition`); sem suporte → navegação instantânea.
- **Contadores e números:** só valores reais vindos do CMS.
- **3D/SVG:** só se o storyboard justificar; siga [references/threejs-gate.md](references/threejs-gate.md).

Matriz de variantes e testes: [references/reduced-motion.md](references/reduced-motion.md).

## Verificação (obrigatória antes de concluir)

1. **Network:** com `reducedMotion: 'reduce'` emulado, nenhum chunk do GSAP é baixado.
2. **Sem JS:** todo o conteúdo visível e legível.
3. **Performance:** trace no Chrome com CPU 4× — nenhuma long task acima de 50 ms na inicialização, CLS 0, INP ≤ 200 ms. Depois, `/performance-audit` na rota (R1/R5).
4. **Acessibilidade:** foco nunca escondido; leitor de tela lê o texto dividido como frase; axe com movimento reduzido.
5. **QA:** checklist do `motion-principles.md` §7, com prints ou gravação curta das variantes.

## Relatório

Inclua:
- animações implementadas × storyboard (o que mudou e por quê);
- peso do motion (KB gz, fora do caminho crítico);
- métricas antes/depois (LCP, TBT/INP, CLS);
- evidência das variantes reduzida e sem JS;
- limitações observadas no mobile.
