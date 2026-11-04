# F10 — Home cinematográfica e motion

**Objetivo da fase:** a home cinematográfica (scroll storytelling, microinterações, transições de página) e o motion do estudo de caso, com as variantes mobile, de movimento reduzido e sem JS completas, dentro do orçamento de performance.

**Pré-requisitos:** F09 concluída (conteúdo e idiomas estáveis). A F10-T1 (storyboard) pode começar logo depois da F01.

**Leitura obrigatória:** [ADR-0011](../architecture/adr/0011-motion.md), [motion-principles](../design/motion-principles.md), [design-direction](../design/design-direction.md), [performance-budgets](../quality/performance-budgets.md), skill `/motion-engineer`.

**Gate de saída:** storyboard aprovado por você e implementado; Lighthouse da R1 e da R5 dentro da política com o motion ativo; GSAP **não** baixado com movimento reduzido; QA de motion completo (motion-principles §7).

---

### F10-T1 — Storyboard da home e das transições

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída (aprovada em 04/11/2026) | F01 (gate) | RX-02, RX-03, RX-05 | `/motion-engineer`, `/frontend-design` |

**Objetivo.** Preencher o template de storyboard (motion-principles §6) para cada seção da home e para a transição card → estudo de caso, nas variantes desktop, mobile, reduzida e sem JS, e decidir, com justificativa, se haverá efeito 3D/SVG (RX-03).

**Arquivos prováveis.** `docs/design/storyboard-home.md` (novo), protótipos estáticos opcionais na styleguide de dev.

**Fora do escopo.** Implementação.

**Critérios de aceite**
- [x] Cada seção tem intenção, gatilho, timeline com tokens e as quatro variantes.
- [x] A decisão sobre 3D foi tomada (sim ou não), com o ganho narrativo e o custo estimado.
- [x] O orçamento de motion (≤ 60 KB gz adiados) é respeitado no plano.
- [x] **Você aprova** o storyboard (registro de data no documento).

**Resultado (04/11/2026).**
- [storyboard-home.md](../design/storyboard-home.md): abertura, seções de texto (storytelling fixado com scrub), projetos em destaque, últimos artigos, chamada final, microinterações, transições de página e estudo de caso, cada um com as quatro variantes.
- **Decisões do plano:**
  - **3D:** não; a F10-T5 fica descartada.
  - **SVG:** só uma hairline em CSS.
  - **Seções de texto:** pin com scrub a partir de 3 seções e de `md`.
  - **"Reduzir movimento":** botão no rodapé.
- **Orçamento previsto:** ~46 KB gz adiados (meta ≤ 60) e ~2–3 KB no JS estático, medidos na F10-T2.

**Testes**
- Não se aplica (documento). A revisão é feita com a checklist do `/motion-engineer`.

---

### F10-T2 — Infraestrutura de motion

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F10-T1, F03-T4 | RX-05, RNF-01, RNF-03 | `/motion-engineer`, `/architecture-guardian`, `/performance-audit` |

**Objetivo.** Instalar `gsap ~3.15` (com a licença registrada) e criar `useMotion()`:
- `import()` dinâmico depois do LCP ou no idle;
- gate de movimento reduzido (preferência do sistema + toggle do site em `localStorage`);
- `gsap.context` e `gsap.matchMedia`, com `revert` no unmount e refresh depois das fontes.

Criar também o script inline `motion-ok` (com hash na CSP) e o fallback de 3 s, o toggle "reduzir movimento" e as View Transitions do Nuxt.

**Arquivos prováveis.** `app/composables/motion/useMotion.ts`, `app/composables/motion/gsap.client.ts`, `app/components/layout/ReduceMotionToggle.vue`, `server/plugins/csp.ts` (hash), `nuxt.config.ts` (`experimental.viewTransition`), `shared/design/tokens.ts`.

**Fora do escopo.** Animações específicas (T3, T4).

**Critérios de aceite**
- [x] Com `prefers-reduced-motion: reduce` ou o toggle ativo, o GSAP **não** é baixado (Network conferida e teste automatizado).
- [x] Sem JS, o conteúdo fica totalmente visível; se o motion não iniciar, a classe é removida em ≤ 3 s.
- [x] O artigo do blog não importa o motion (checagem do manifest).
- [x] Peso do motion medido e registrado (meta ≤ 60 KB gz, fora do caminho crítico).

**Resultado (04/11/2026).**
- **Dependência:** `gsap 3.15.1` (licença "Standard no charge", ADR-0011), importado só por `import()` em `app/composables/motion/gsap.ts`.
- **Script inline** `MOTION_INIT_SCRIPT` (`shared/design/motion.ts`, com hash na CSP pelo plugin existente): `html.motion-ok` só com JS e movimento permitido, e o fallback de 3 s.
- **Director:** `director.ts` é TypeScript puro, sem Vue, carregado no `onMounted` da página por `useMotion` só quando o movimento é permitido.
  - Depois do `load`, quando o navegador está ocioso, carrega o GSAP e os plugins pedidos.
  - Abre um `gsap.context` e faz `revert` no unmount e quando o visitante desliga o movimento; `ScrollTrigger.refresh()` depois das fontes.
  - A ilha como componente Vue foi descartada: fazia o empacotador dividir o chunk do runtime (+1,14 kB em toda rota).
- **Onde está montado:** home e estudo de caso, ainda sem cenas (decisão 1).
- **Botão "Reduzir movimento"** no rodapé: só reduz; fica pressionado e desabilitado, com explicação, quando o sistema já pede (decisão 2). A escolha fica em `localStorage`.
- **View Transitions:** `experimental.viewTransition` do Nuxt, com crossfade de `--dur-base`; desligadas com movimento reduzido, pelo sistema ou pelo botão (decisão 3).
- **Peso medido:** 48,9 KB gz adiados (GSAP 27,3 + ScrollTrigger 17,4 + SplitText 3,4 + director e loader 0,9), dentro da meta de 60.
  - O JS estático subiu ~1,5 kB em toda rota, e o owner revisou os orçamentos (performance-budgets.md).
  - `check:budgets` ganhou `noMotion` na R3 e na R8.
- **Lighthouse da R1** com o motion ativo (o GSAP baixou na medição): Performance mobile 99 e desktop 100, CLS 0, TBT 3 ms.
- **Testes:**
  - `tests/unit/motion-init.test.ts`;
  - `noMotion` em `tests/unit/check-budgets.test.ts`;
  - `tests/nuxt/motion.test.ts`;
  - `tests/e2e/motion.spec.ts`, com desktop e mobile.

**Testes**
- Nuxt: `useMotion` com `matchMedia` mockado (reduzido → sem import); limpeza no unmount.
- E2E: emulação de movimento reduzido sem requisição de chunk do GSAP; JS desligado com conteúdo visível.

---

### F10-T3 — Hero e scroll storytelling da home

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída (LCP mobile ≤ 1,8 s e VoiceOver pendentes) | F10-T2, F08-T2 | RF-01.1, RX-02, RX-05 | `/motion-engineer`, `/frontend-design`, `/performance-audit` |

**Objetivo.** Implementar o hero (SSR estático: o elemento LCP nunca começa oculto) e as seções narrativas do storyboard: reveals com SplitText (`aria`), imagem com `clip-path`, pin + scrub só no desktop e destaques de projetos e artigos vindos do CMS.

**Arquivos prováveis.** `app/pages/index.vue`, `app/components/home/*.vue`, `app/components/motion/*.client.vue`.

**Fora do escopo.** Transições entre páginas (T4).

**Critérios de aceite**
- [~] O LCP é texto ou imagem do hero, visível sem esperar animação; LCP de laboratório (mobile) ≤ 1,8 s.
- [x] Mobile com as timelines simplificadas do storyboard; a versão reduzida é estática ou com fades curtos.
- [x] Sem long tasks acima de 50 ms na inicialização do motion; CLS 0.
- [~] O texto dividido é lido como frase única (VoiceOver conferido).

**Resultado (04/11/2026).**
- **Cenas:** `app/composables/motion/scenes/home.ts`, carregada pelo director por nome, sob demanda (decisão 1).
  - abertura com hairline em CSS, sobretítulo, realce em linhas do título (SplitText com `aria`, revertido), subtítulo e botão;
  - storytelling das seções, fixado com scrub no desktop a partir de 3 seções; as etapas ficam empilhadas na mesma célula de grid por CSS sob `motion-ok` desde o primeiro paint (decisão 2);
  - reveal das capas dos projetos com `clip-path`; fade dos artigos;
  - chamada final em linhas, com botão magnético só com `pointer: fine`.
- **Mobile:** só fades, sem pin nem split. Movimento reduzido e sem JS: tudo visível e estático, com a hairline desenhada.
- **Fallback:** se o fallback de 3 s já mostrou o conteúdo, o director não recoloca a classe e pula as entradas da abertura.
- **O título (LCP) nunca fica oculto.**
- **Medição (prod-like com a home publicada, 3 seções, projetos e artigos):**
  - JS estático da R1 inalterado (123,00 kB); as cenas são adiadas (~1,5 KB gz; total adiado ~50,4 KB).
  - Lighthouse R1: mobile 98, desktop 100, 100 nas demais categorias, CLS 0.
  - **LCP mobile de laboratório (critério ≤ 1,8 s):** mediana de 10 execuções de 1.993 ms com motion e 1.973,5 ms sem a chamada do motion (o mesmo build com e sem o `useMotion` da home). O motion não pesa no LCP. O critério não é cumprido pela página com conteúdo em si (o CSS bloqueante pesa ~306 ms na simulação; na F08-T2 a mediana já era 1.838 ms). Fica para o passe de performance da F11.
  - **Long tasks com CPU 4× e navegador novo a cada execução:** com motion, 0 a 92 ms; sem motion, 0 a 70 ms, nos mesmos instantes depois do `load`. São da própria página, não da inicialização do motion. CLS 0 em todas.
- **VoiceOver:** a árvore de acessibilidade lê o título dividido como frase única (E2E). A checagem manual com VoiceOver fica com o owner (decisão 4).
- **Testes:** `tests/e2e/home-motion.spec.ts` (as quatro variantes, capturas em `reports/motion/`, axe com motion e reduzido) e `tests/nuxt/motion.test.ts` atualizado. A fixture publica a home com 3 seções `[PLACEHOLDER]`.

**Testes**
- E2E: home nas variantes desktop, mobile, reduzida e sem JS (screenshots no relatório).
- a11y: axe com movimento reduzido.
- `/performance-audit` na R1 (relatório + trace).

---

### F10-T4 — Microinterações e transições de página

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F10-T3 | RX-02, RX-05 | `/motion-engineer`, `/frontend-design` |

**Objetivo.** Implementar:
- hover e foco de links, botões e cards (CSS, 120–200 ms);
- hover magnético só com `pointer: fine`;
- contadores **só para números reais** dos highlights;
- View Transitions com elemento compartilhado (imagem do card → hero do estudo de caso) e motion do estudo de caso conforme o storyboard.

**Arquivos prováveis.** `app/components/ui/*` (estados), `app/components/projects/*`, `app/assets/css/main.css` (`view-transition-name`), `app/composables/motion/*`.

**Fora do escopo.** Efeito 3D (T5).

**Critérios de aceite**
- [x] Sem suporte a View Transitions, a navegação é instantânea, sem erro.
- [x] Com movimento reduzido, as transições são instantâneas e não há hover magnético.
- [x] O foco nunca fica escondido ou deslocado por animação; INP ≤ 200 ms em interações de hover e clique (medido).

**Resultado (04/11/2026).**
- **Elemento compartilhado sem JS** (decisão 1): a capa de cada card de projeto e a imagem do estudo de caso têm `view-transition-name: project-<slug>`, um nome por projeto.
  - O morph dura `--dur-cinematic`; o resto da página faz o crossfade da F10-T2.
  - No mobile o nome sai e fica só o crossfade.
  - Sem suporte, o Nuxt navega direto; com movimento reduzido do sistema, nem chama a API; com o botão do site, o CSS zera as animações.
- **Microinterações em CSS:** links com cor e sublinhado em `--dur-instant`; botões (`.press`) com `scale(0.98)` ao pressionar (decisão 3), desligado com movimento reduzido. O anel de foco nunca anima.
- **Cena do estudo de caso** (`scenes/case-study.ts`, sob demanda):
  - **Galeria:** reveal com `clip-path` no desktop e fade no mobile.
  - **Contadores:** só para valores escritos como número (`parseCount`, decisão 2). Durante a contagem os dígitos ficam `aria-hidden` e o valor final fica disponível numa cópia visualmente oculta; o texto original volta no fim e no `revert`.
- **Hover magnético:** já existia na chamada final (F10-T3), só com `pointer: fine`.
- **INP com CPU 4×** (3 execuções por variante, navegador novo):
  - R1: abaixo de 16 ms (o limiar de registro) em desktop e mobile;
  - R5: 32–40 ms em desktop e mobile;
  - interações: tema, hover, Tab, card → estudo de caso, scroll com contadores, voltar.
- **Lighthouse** (prod-like com conteúdo):
  - R1 mobile 98 e desktop 100; R5 mobile 98 e desktop 100;
  - 100 nas demais categorias;
  - CLS 0, exceto o 0,055 no desktop da R5, que já existia na F07.
- **JS estático:** nenhum novo (R1 122,99 kB, R5 122,61 kB).
- **Testes:**
  - `tests/unit/motion-count.test.ts`;
  - `tests/e2e/transitions.spec.ts`: com e sem suporte, movimento reduzido com o foco visível, nomes únicos por página, mobile sem morph, contadores terminando no texto original.

**Testes**
- E2E: navegação card → estudo de caso com e sem suporte a View Transitions.
- `/performance-audit` (INP com throttling de CPU 4×) na R1 e na R5.

---

### F10-T5 — Efeito SVG/3D opcional (só se aprovado no storyboard)

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| descartada (storyboard F10-T1: sem 3D) | F10-T3 | RX-03 | `/motion-engineer`, `/performance-audit` |

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
