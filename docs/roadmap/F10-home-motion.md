# F10 — Home cinematográfica e motion

**Objetivo da fase:** a home cinematográfica (scroll storytelling, microinterações, transições de página) e o motion do estudo de caso, com as variantes mobile, de movimento reduzido e sem JS completas, dentro do orçamento de performance.

**Pré-requisitos:** F09 concluída (conteúdo e idiomas estáveis). A F10-T1 (storyboard) pode começar logo depois da F01.

**Leitura obrigatória:** [ADR-0011](../architecture/adr/0011-motion.md), [motion-principles](../design/motion-principles.md), [design-direction](../design/design-direction.md), [performance-budgets](../quality/performance-budgets.md), skill `/motion-engineer`.

**Gate de saída:** storyboard aprovado por você e implementado; Lighthouse da R1 e da R5 dentro da política com o motion ativo; GSAP **não** baixado com movimento reduzido; QA de motion completo (motion-principles §7).

---

### F10-T1 — Storyboard da home e das transições

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F01 (gate) | RX-02, RX-03, RX-05 | `/motion-engineer`, `/frontend-design` |

**Objetivo.** Preencher o template de storyboard (motion-principles §6) para cada seção da home e para a transição card → estudo de caso, nas variantes desktop, mobile, reduzida e sem JS, e decidir, com justificativa, se haverá efeito 3D/SVG (RX-03).

**Arquivos prováveis.** `docs/design/storyboard-home.md` (novo), protótipos estáticos opcionais na styleguide de dev.

**Fora do escopo.** Implementação.

**Critérios de aceite**
- [ ] Cada seção tem intenção, gatilho, timeline com tokens e as quatro variantes.
- [ ] A decisão sobre 3D foi tomada (sim ou não), com o ganho narrativo e o custo estimado.
- [ ] O orçamento de motion (≤ 60 KB gz adiados) é respeitado no plano.
- [ ] **Você aprova** o storyboard (registro de data no documento).

**Testes**
- Não se aplica (documento). A revisão é feita com a checklist do `/motion-engineer`.

---

### F10-T2 — Infraestrutura de motion

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F10-T1, F03-T4 | RX-05, RNF-01, RNF-03 | `/motion-engineer`, `/architecture-guardian`, `/performance-audit` |

**Objetivo.** Instalar `gsap ~3.15` (com a licença registrada) e criar `useMotion()`:
- `import()` dinâmico depois do LCP ou no idle;
- gate de movimento reduzido (preferência do sistema + toggle do site em `localStorage`);
- `gsap.context` e `gsap.matchMedia`, com `revert` no unmount e refresh depois das fontes.

Criar também o script inline `motion-ok` (com hash na CSP) e o fallback de 3 s, o toggle "reduzir movimento" e as View Transitions do Nuxt.

**Arquivos prováveis.** `app/composables/motion/useMotion.ts`, `app/composables/motion/gsap.client.ts`, `app/components/layout/ReduceMotionToggle.vue`, `server/plugins/csp.ts` (hash), `nuxt.config.ts` (`experimental.viewTransition`), `shared/design/tokens.ts`.

**Fora do escopo.** Animações específicas (T3, T4).

**Critérios de aceite**
- [ ] Com `prefers-reduced-motion: reduce` ou o toggle ativo, o GSAP **não** é baixado (Network conferida e teste automatizado).
- [ ] Sem JS, o conteúdo fica totalmente visível; se o motion não iniciar, a classe é removida em ≤ 3 s.
- [ ] O artigo do blog não importa o motion (checagem do manifest).
- [ ] Peso do motion medido e registrado (meta ≤ 60 KB gz, fora do caminho crítico).

**Testes**
- Nuxt: `useMotion` com `matchMedia` mockado (reduzido → sem import); limpeza no unmount.
- E2E: emulação de movimento reduzido sem requisição de chunk do GSAP; JS desligado com conteúdo visível.

---

### F10-T3 — Hero e scroll storytelling da home

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F10-T2, F08-T2 | RF-01.1, RX-02, RX-05 | `/motion-engineer`, `/frontend-design`, `/performance-audit` |

**Objetivo.** Implementar o hero (SSR estático: o elemento LCP nunca começa oculto) e as seções narrativas do storyboard: reveals com SplitText (`aria`), imagem com `clip-path`, pin + scrub só no desktop e destaques de projetos e artigos vindos do CMS.

**Arquivos prováveis.** `app/pages/index.vue`, `app/components/home/*.vue`, `app/components/motion/*.client.vue`.

**Fora do escopo.** Transições entre páginas (T4).

**Critérios de aceite**
- [ ] O LCP é texto ou imagem do hero, visível sem esperar animação; LCP de laboratório (mobile) ≤ 1,8 s.
- [ ] Mobile com as timelines simplificadas do storyboard; a versão reduzida é estática ou com fades curtos.
- [ ] Sem long tasks acima de 50 ms na inicialização do motion; CLS 0.
- [ ] O texto dividido é lido como frase única (VoiceOver conferido).

**Testes**
- E2E: home nas variantes desktop, mobile, reduzida e sem JS (screenshots no relatório).
- a11y: axe com movimento reduzido.
- `/performance-audit` na R1 (relatório + trace).

---

### F10-T4 — Microinterações e transições de página

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F10-T3 | RX-02, RX-05 | `/motion-engineer`, `/frontend-design` |

**Objetivo.** Implementar:
- hover e foco de links, botões e cards (CSS, 120–200 ms);
- hover magnético só com `pointer: fine`;
- contadores **só para números reais** dos highlights;
- View Transitions com elemento compartilhado (imagem do card → hero do estudo de caso) e motion do estudo de caso conforme o storyboard.

**Arquivos prováveis.** `app/components/ui/*` (estados), `app/components/projects/*`, `app/assets/css/main.css` (`view-transition-name`), `app/composables/motion/*`.

**Fora do escopo.** Efeito 3D (T5).

**Critérios de aceite**
- [ ] Sem suporte a View Transitions, a navegação é instantânea, sem erro.
- [ ] Com movimento reduzido, as transições são instantâneas e não há hover magnético.
- [ ] O foco nunca fica escondido ou deslocado por animação; INP ≤ 200 ms em interações de hover e clique (medido).

**Testes**
- E2E: navegação card → estudo de caso com e sem suporte a View Transitions.
- `/performance-audit` (INP com throttling de CPU 4×) na R1 e na R5.

---

### F10-T5 — Efeito SVG/3D opcional (só se aprovado no storyboard)

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F10-T3 | RX-03 | `/motion-engineer`, `/performance-audit` |

**Objetivo.** Se a F10-T1 aprovou o efeito: implementar um componente client-only com `import('three')` (ou SVG com DrawSVG/MorphSVG), iniciado por IntersectionObserver e pausado fora da tela, com DPR limitado a 1,5–2, `dispose` no unmount e poster estático como fallback (sem WebGL, movimento reduzido, `saveData`, `deviceMemory` < 4). Se não foi aprovado: marcar a tarefa como "não aplicável" com a justificativa.

**Arquivos prováveis.** `app/components/motion/HeroScene.client.vue`, `app/composables/motion/useThree.ts`.

**Fora do escopo.** Qualquer efeito que não esteja no storyboard aprovado.

**Critérios de aceite**
- [ ] O poster é o elemento visível no LCP; o 3D carrega depois, sem afetar o LCP.
- [ ] Peso adicional ≤ 180 KB gz, carregado sob demanda; 60 fps em desktop médio; pausa fora da tela.
- [ ] Os fallbacks foram verificados em todos os gatilhos.

**Testes**
- E2E: fallback com WebGL desabilitado e com movimento reduzido.
- `/performance-audit` na R1 com e sem o efeito (comparação no relatório).

---

## Prompt da fase

```text
Fase F10 — Home cinematográfica e motion. Projeto: ~/Desktop/dev/portfolio.

Leia CLAUDE.md, docs/roadmap/F10-home-motion.md, o ADR-0011, docs/design/motion-principles.md e o storyboard aprovado (depois da F10-T1). Use /motion-engineer em todas as tarefas. Pegue a primeira tarefa "pendente" com dependências concluídas.

Antes de editar: apresente objetivo, arquivos, abordagem, dependências novas (GSAP/Three com licença e peso), testes e riscos. Aguarde minha aprovação.

Regras desta fase:
- Nada fora do storyboard aprovado; na F10-T1, apresente o storyboard e espere minha aprovação.
- O elemento LCP nunca começa oculto; o conteúdo é visível sem JS; GSAP só depois do LCP e nunca no artigo do blog.
- Com movimento reduzido, o GSAP não é baixado. Sem scrolljacking nem smooth scroll.
- Rode /performance-audit e a checklist de QA de motion antes de concluir cada tarefa.

Depois de implementar: rode typecheck, lint, test, e2e, a11y e Lighthouse na R1/R5; cole a saída real; atualize o status e os docs; entregue o relatório da Definition of Done. Não faça commit sem eu pedir.
```
