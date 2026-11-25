# Website A — análise funcional

**Referência:** https://vinicius-viola-workfolio.lovable.app/ (o portfólio atual do owner, feito no Lovable)
**Capturado:** 2026-11-25, Chromium headless (Playwright 1.64), 1440×900 / 820×1180 / 390×844.
**Papel neste projeto:** fonte da verdade sobre **o que** o produto faz (ver [implementation-plan.md](../implementation-plan.md)).

**Legenda:** **[V]** verificado por inspeção no navegador ou pela leitura do bundle publicado · **[A]** premissa ou inferência, não observada diretamente.

---

## 1. Resumo

O Website A é um portfólio de uma página só, com uma página inicial longa e uma listagem de blog com três artigos. Não tem backend próprio: a única chamada de rede do site é um beacon de analytics, e a única ferramenta interativa (o gerador de mensagem de contato) roda inteiramente no navegador. Tem uma página 404.

| Área | Situação |
|---|---|
| Rotas | `/`, `/blog`, `/blog/<slug>` (×3), um 404 para qualquer outro caminho |
| API de servidor | Nenhuma. A única requisição que não é GET é o beacon de analytics (`/__l5e/trackevents`) **[V]** |
| Formulários | Um formulário interativo (o gerador de mensagem de contato). A seção "Contato" são links, não um formulário **[V]** |
| Fonte do conteúdo | Escrito no próprio bundle (sem CMS, sem busca de conteúdo) **[V]** (nenhuma requisição de conteúdo aparece no log de rede) |
| Erros no console ao carregar | Nenhum no desktop **[V]** |
| Rolagem horizontal em 390 px | Nenhuma **[V]** |

---

## 2. Rotas e arquitetura de informação

| Rota | Observado | Evidência |
|---|---|---|
| `/` | Página única com seções âncora: `#top`, `#experience`, `#projects`, `#skills`, `#outreach`, `#contact` | `href` da navegação e títulos `h2` **[V]** |
| `/blog` | Título H1 "Blog" e três links de artigos | Teste de rotas **[V]** |
| `/blog/migrating-vue-2-to-vue-3-at-scale`, `/blog/design-systems-in-code-banking`, `/blog/ai-assisted-frontend-workflows-claude-code` | Páginas de artigo: H1, parágrafo de abertura, parágrafos do corpo. Nenhum link "voltar" foi encontrado | Teste de rotas **[V]** |
| `/does-not-exist` | "404 · Page not found" | Teste de rotas **[V]** |
| `/__l5e/assets-v1/…/Vinicius_Dias_CV.pdf` | O CV, linkado no cabeçalho e no hero | `href` dos links **[V]** |

**Navegação:** um cabeçalho fixo com marca, seis âncoras (Experience, Projects, Skills, AI Outreach, Blog, Contact) e um botão CV. Os links de âncora são internos da página; "Blog" é uma troca de rota **[V]**.

---

## 3. Inventário de funcionalidades

| # | Funcionalidade | Seção | Detalhe | Verificado |
|---|---|---|---|---|
| F1 | Hero | `#top` | Sobretítulo "Lisbon, Portugal · Senior Frontend & Product Engineer"; H1 "Building scalable interfaces & design systems."; parágrafo de apresentação; CTAs: **Draft outreach** (→ `#outreach`), **Download CV**, **Blog**, **GitHub**; link secundário **LinkedIn** | [V] |
| F2 | Cartão "System blueprint" | Hero, coluna direita | Cartão decorativo com três áreas de foco (Design Systems, Architecture, AI Workflows) e um rodapé "60 FPS · GPU Composed" e "v2026.1". As afirmações são decorativas: nada na página mede FPS | [V] (conteúdo), [A] (finalidade) |
| F3 | Faixa de números | Abaixo do hero | Quatro números: **6+** anos de experiência; **5M+** usuários atendidos (EnBW); **90%+** de cobertura de testes críticos; **70–80%** de carregamento mais rápido. São afirmações fornecidas pelo owner e não podem ser verificadas pelo site | [V] (presença) |
| F4 | Experiência selecionada | `#experience` | Seis funções como H3: Emotion Mobility, EnBW, TLScontact, Bee Engineering, ISH Technology (SafeLabs), TOTVS · Wepipe · Liberfly (agrupadas). Cada função tem sua descrição (não capturada por completo) | [V] (títulos) |
| F5 | Projetos do GitHub | `#projects` | Seis cards de projeto com links para repositórios do GitHub e um link de demonstração ao vivo (Star Wars Explorer, na Vercel): Roses Cortinas & Persianas (landing page), Collection Manager, TV Series Manager, Kanban Dashboard, Star Wars Explorer, PokéApp | [V] |
| F6 | Habilidades e formação | `#skills` | Listas agrupadas: Core Frontend; UI & Design Systems; AI-Assisted Engineering; Architecture & Testing; DevOps & Ecosystem; além de Education, Languages, Certifications | [V] (títulos) |
| F7 | Gerador de mensagem de contato (AI Outreach) | `#outreach` | Título "Draft a tailored message in seconds." Campos: *Your name* (opcional), *Company / team* (opcional), *Opportunity or collaboration* (área de texto). Chips de tom: **Professional**, **Concise**, **Warm**. Envio: **Draft outreach**. Painel de saída com **Copy email** | [V] |
| F8 | Listagem do blog | `/blog` | Três artigos, cada um linkado | [V] |
| F9 | Páginas de artigo | `/blog/:slug` | H1, abertura, parágrafos do corpo | [V] |
| F10 | Contato | `#contact` | Título "Let's build something together." Links: e-mail (`mailto:`), telefone (`tel:`), LinkedIn, GitHub. **Sem formulário** | [V] |
| F11 | Download do CV | Cabeçalho, hero | Link para PDF | [V] |
| F12 | Página 404 | Qualquer caminho desconhecido | "404 · Page not found" | [V] |

### 3.1 Gerador de mensagem de contato (F7): comportamento

- O texto digitado vira uma mensagem no navegador. Ao enviar, foram gerados parágrafos que combinam a biografia do owner ("6+ years building scalable web applications with TypeScript, React, and Vue…") com o texto digitado pelo usuário **[V]**.
- O envio não causou **nenhuma requisição de rede que não fosse GET** **[V]**. O gerador é do lado do cliente e não chama nenhuma API de IA.
- Os chips de tom mudam a saída. **Não** foi verificado para cada tom **[A]**.
- "Copy email" copia a saída para a área de transferência. Não verificado **[A]**.

---

## 4. Jornadas do usuário (observadas)

1. **Recrutador, desktop, primeira visita:** chega ao hero → lê os números → rola até Experience → Projects → Skills → **Draft outreach** → copia uma mensagem → **Download CV**.
2. **Leitor:** no cabeçalho, **Blog** → lista de artigos → página do artigo. Não foram encontrados relacionados, tags, datas nem link de voltar **[V]**.
3. **URL errada:** página 404. Não foi verificado se há link de volta para a home **[A]**.

---

## 5. Layout e comportamento responsivo

| Viewport | Observação | Verificado |
|---|---|---|
| 1440 px | Hero em duas colunas (texto à esquerda, cartão blueprint à direita). Números em uma linha de quatro colunas. Divisórias de seção em largura total | [V] (captura `screenshots/a-desktop-fold.png`) |
| 820 px | Capturado (`screenshots/a-tablet-fold.png`). O layout de colunas não foi comparado em detalhe | [V] (captura), [A] (layout) |
| 390 px | Coluna única. Sem rolagem horizontal (`scrollWidth ≤ innerWidth`) | [V] (`screenshots/a-mobile-fold.png`) |

A altura do documento em 1440 px é de cerca de 5.600 px.

---

## 6. Estrutura de conteúdo

- O conteúdo é texto estático dentro do bundle JavaScript; não há CMS nem requisição de conteúdo **[V]**.
- Os artigos do blog são roteados pelo slug (`/blog/<slug>`) **[V]**.
- Os cards de projeto linkam para repositórios do GitHub e para um site ao vivo **[V]**.
- O conteúdo real do owner (nomes, empresas, métricas) aparece no site. O projeto do portfólio deve tratá-lo como **conteúdo fornecido pelo owner** e não inventar nada além dele (ver [CLAUDE.md](../../CLAUDE.md), "Conteúdo real").

---

## 7. Acessibilidade (observada)

| Item | Observação | Verificado |
|---|---|---|
| Estrutura de títulos | Um H1, um H2 por seção e um H3 por item. Ordem correta | [V] |
| Landmarks | Cabeçalho e navegação presentes; `main` não verificado | [A] |
| Foco do teclado | Não testado | [A] |
| Contraste de cor | Não medido com ferramenta | [A] |
| Imagens | Contagem de `<img>` na home é 0; os visuais de projeto e do hero são SVG/CSS | [V] |
| Link de pular conteúdo | Não verificado | [A] |
| Movimento reduzido | Nenhuma animação roda no carregamento em nenhum dos modos (`getAnimations()` = 0 com e sem `prefers-reduced-motion: reduce`). Movimento disparado pela rolagem sob reduce não foi medido | [V] (carregamento), [A] (rolagem) |

---

## 8. Achados de renderização e técnicos

| Tópico | Achado | Verificado |
|---|---|---|
| Entrega | Build estático estilo Vite: `/assets/index-*.js`, `routes-*.js`, `styles-*.css`. SPA com fallback para rotas desconhecidas | [V] |
| Framework | Não confirmado pelo nome. A prop `whileInView` (API do Framer Motion / `motion`) está no chunk de rotas; o selo "Edit with Lovable" indica um projeto gerado pelo Lovable | [V] (nome da API), [A] (React + Tailwind + Radix) |
| Biblioteca de movimento | Uso de `whileInView` no estilo Framer Motion. **Nenhum GSAP, nenhum ScrollTrigger, nenhum Lenis** em nenhum bundle (0 ocorrências) | [V] |
| View Transitions | `startViewTransition` aparece no bundle de entrada (4 ocorrências). Seu uso em trocas de rota não foi exercitado | [V] (presença), [A] (uso) |
| Keyframes | `accordion-up/down`, `caret-blink`, `enter`, `exit`, `pulse`, `spin` — o conjunto usual de animações do Tailwind/shadcn (enter/exit sugerem diálogos ou toasts) | [V] |
| Fontes | CSS do Google Fonts: Fraunces, DM Sans, IBM Plex Mono. 147 KB de arquivos de fonte buscados de `fonts.gstatic.com` ao carregar | [V] |
| Peso de JS (descompactado) | `index-*.js` 337 KB + `routes-*.js` 184 KB + analytics 29 KB ≈ **557 KB** de script, sem compressão | [V] |
| Peso de CSS (descompactado) | 80–89 KB | [V] |
| Requisições ao carregar | 13 | [V] |
| Source maps | `…js.map` retorna 404 | [V] |
| Console | Nenhum erro ou aviso na execução desktop | [V] |
| Analytics | Beacon `/__l5e/…`. Analytics de terceiros não identificado | [V] |
| Medição de desempenho | Nenhum Lighthouse ou Web Vitals nesta etapa (adiado para a validação) | — |

---

## 9. Requisitos de implementação derivados do Website A

Estes são os requisitos **funcionais** que o projeto Nuxt precisa atender. Cada um está mapeado para o que o portfólio já faz, em [implementation-plan.md](../implementation-plan.md).

| ID | Requisito | Observações |
|---|---|---|
| A-R1 | Home com hero, faixa de números, experiência, projetos, habilidades e contato | Experiência e habilidades já existem no portfólio, na página Sobre (ver plano, §0.4) |
| A-R2 | CTAs do hero: outreach, CV, blog, GitHub, LinkedIn | O CTA de outreach depende de A-R6 |
| A-R3 | Lista de experiência com funções e descrições | Já existe como linha do tempo na página Sobre; a home a exibe (F13-T3) |
| A-R4 | Lista de projetos (cards estilo GitHub) com links | Os projetos do portfólio já cobrem isto, com um modelo mais rico |
| A-R5 | Habilidades agrupadas por categoria | Já existem na página Sobre; a home as exibe (F13-T4) |
| A-R6 | Gerador de mensagem de contato (campos, tom, cópia) | Pode ser feito no cliente sem custo; depende de aprovação do owner (ver plano, §5) |
| A-R7 | Listagem do blog e páginas de artigo | Já implementado (F06) |
| A-R8 | Download do CV | Implementado com o PDF autohospedado (F13-T5, ADR-0017) |
| A-R9 | Página 404 | Já implementado (`app/error.vue`) |
| A-R10 | Sem rolagem horizontal em 390 px | O orçamento de CI existente deve cobrir isto |

**Intencionalmente não exigidos:** o selo do Lovable, o texto decorativo "60 FPS", o beacon de analytics e as fontes do Google Fonts de terceiros (o portfólio hospeda as próprias fontes; ver [CLAUDE.md](../../CLAUDE.md)).

---

## 10. Limitações desta análise

- Só foram exercitados a home, a listagem do blog, um artigo, a página 404 e o gerador de mensagem. Estados de hover, ordem de foco e todos os chips de tom não foram percorridos.
- O layout em 820 px foi capturado, mas não comparado elemento a elemento.
- Lighthouse, Core Web Vitals e varreduras com axe **não** foram executados no Website A nesta etapa.
- Só o Playwright foi usado. REA e o Chrome DevTools MCP não foram necessários para estes achados (nenhum comportamento nativo ou ofuscado exigiu).

---

## Capturas de tela

| Arquivo | Viewport | Observações |
|---|---|---|
| [screenshots/a-desktop-fold.png](screenshots/a-desktop-fold.png) | 1440 × 900 | Hero, cartão blueprint, números |
| [screenshots/a-tablet-fold.png](screenshots/a-tablet-fold.png) | 820 × 1180 | Hero em largura de tablet |
| [screenshots/a-mobile-fold.png](screenshots/a-mobile-fold.png) | 390 × 844 | Coluna única |
