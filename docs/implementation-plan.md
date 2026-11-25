# Plano de implementação — combinando o Website A (função) e o Website B (movimento)

**Status:** aprovado pelo owner em 2026-11-25 (decisões D-01 a D-08, §8). A fase F13 está em andamento; ver §8.3 para o estado de cada tarefa.
**Entradas:** [website-a-functional-analysis.md](research/website-a-functional-analysis.md), [website-b-motion-analysis.md](research/website-b-motion-analysis.md), [animation-mapping.md](animation-mapping.md).
**Idioma:** pt-BR, conforme CLAUDE.md (decisão D-06). Este documento foi escrito em inglês na primeira versão e traduzido depois da aprovação.

---

## 0. Avaliação do repositório

### 0.1 Alvo

| Item | Achado | Verificado |
|---|---|---|
| Localização | `/Users/viniciusvioladias/Desktop/dev/portfolio` (a pasta pai `dev/` não é um repositório e tem projetos não relacionados) | [V] |
| Aplicação existente | Sim: portfólio e blog em **Nuxt 4 + Cloudflare**, com CMS administrativo. Preservada; sem migração de framework | [V] |
| Git | Branch original `chore/F12-T5-launch`, HEAD `cec4015` | [V] |
| Alterações não commitadas | `nuxt.config.ts`: um **diff só de formatação** (estilo de aspas, ponto e vírgula, quebra de linha), que não foi feito nesta etapa. Pastas não rastreadas `.agents/` e `.vscode/`. **Deixadas intactas**; os commits das tarefas incluem só os arquivos de cada uma | [V] |
| Roadmap | F00–F11 concluídas no código; F12-T5 é a próxima tarefa do roadmap original | [V] |

### 0.2 Stack (como instalada)

| Camada | Versão / detalhe | Verificado |
|---|---|---|
| Runtime | Node 24.22.1 (engine `^24.15.0`), pnpm 10.34.8 | [V] |
| Framework | Nuxt `~4.6`, Vue `~3.5`, vue-router `~5.4`, TypeScript `~6.0` | [V] (package.json) |
| Estilo | Tailwind `~4.3` via `@tailwindcss/vite` | [V] |
| Movimento | GSAP `~3.15`, carregado sob demanda (`app/composables/motion/**`); View Transitions CSS ativas | [V] |
| Dados / auth | D1 + Drizzle (`~0.45`), Better Auth `~1.7` com passkey e GitHub | [V] |
| Conteúdo | Tiptap `~3.32` (só admin), Shiki `~4.5` (só admin) | [V] |
| Hospedagem | Cloudflare Workers com Static Assets, R2 para mídia, Workers AI para tradução | [V] |
| Testes | Vitest `~5.0`, Playwright `~1.64`, axe `~4.14`, Lighthouse `13` | [V] (package.json) |

### 0.3 Funcionalidades existentes a preservar

| Área | Existente (rotas e funcionalidades) | Verificado |
|---|---|---|
| Páginas públicas | Início (`/`), sobre (`/sobre`), contato (`/contato`), privacidade (`/privacidade`), blog (`/blog`, `/blog/[slug]`, `/blog/temas/[slug]`), projetos (`/projetos`, `/projetos/[slug]`), prévia (`/preview/[token]`), páginas de erro | [V] (`app/pages`) |
| Admin | Login, configuração inicial, painel, artigos, projetos, mídia, páginas, configurações, traduções, mensagens, log de auditoria, passkeys, sessões | [V] (`app/pages/admin`) |
| Contato | Formulário real com Turnstile e limite de requisições, caixa de entrada no admin, retenção de 12 meses | [V] (docs, CLAUDE.md) |
| i18n | pt-BR (padrão), en, es, de, fr, com rotas traduzidas e hreflang | [V] |
| Movimento | `director.ts` (GSAP carregado ociosamente), `scenes/home.ts` (abertura, narrativa fixada, revelações de projeto, CTA magnético de fechamento), `scenes/case-study.ts`, `scenes/count.ts`, preferência de movimento reduzido, `shared/design/motion.ts` | [V] |
| Docs | PRD, 16 ADRs (mais o 0017 proposto), visão geral da arquitetura, modelo de dados, modelo de segurança, i18n/SEO, qualidade, operação, roadmap F00–F12, storyboard, princípios de movimento | [V] |
| Skills | `architecture-guardian`, `cms-engineer`, `frontend-design`, `i18n-manager`, `motion-engineer`, `performance-audit`, `release-check`, `security-audit`, `test-engineer` | [V] |

### 0.4 Análise de lacunas: funcionalidades do Website A × portfólio

Esta tabela foi corrigida depois de ler o código existente (ver §8.4).

| Funcionalidade do A | Portfólio hoje | Lacuna | Verificado |
|---|---|---|---|
| Hero com CTAs | Blocos do hero da home (sobretítulo, título, subtítulo, CTA) | Equivalente; o conjunto de CTAs pode diferir | [V] |
| Faixa de números (4 valores) | Destaques de projeto (cena `count`). **F13-T1 criou o modelo** (`home.stats`); F13-T2 mostra a faixa | Resolvida na home | [V] (`shared/pages/blocks.ts`) |
| Experiência (6 funções) | `about.timeline` (período, título, texto) com editor no admin, exibido em `/sobre`. **F13-T3 mostra na home** | Resolvida na home | [V] (`shared/pages/blocks.ts`, `app/pages/sobre.vue`) |
| Projetos no estilo GitHub | Projetos com estudo de caso, filtro, ordenação e publicação | **Coberto**, e mais rico | [V] |
| Habilidades e formação | `about.skills` (grupo, itens), exibido em `/sobre`. **F13-T4 mostra na home** | Resolvida na home (sem marquee, que é opcional) | [V] (`shared/pages/blocks.ts`, `app/pages/sobre.vue`) |
| Gerador de mensagem de contato | Nenhum | **Ausente**; F13-T7, aguardando aprovação do texto | [V] (grep: 0 ocorrências) |
| Blog e artigos | Completo: listagem, artigo, temas, RSS | **Coberto** | [V] |
| Contato | Formulário real, Turnstile, caixa de entrada | **Coberto**, mais forte que o A (que não tem formulário) | [V] |
| Download do CV | **F13-T5**: PDF autohospedado (ADR-0017), link no cabeçalho e no hero | Resolvida; falta a verificação no navegador | [V] |
| 404 | `app/error.vue` | **Coberto** | [V] |
| Beacon de analytics | Não é necessário | Não exigido | — |

### 0.5 Ferramentas usadas e seus limites

| Ferramenta | Usada para | Limite | Verificado |
|---|---|---|---|
| Playwright (`@playwright/test` 1.64, Chromium instalado localmente) | Capturas, DOM, rede, verificações de movimento reduzido, fluxos | Headless com **WebGL por software**: taxas de quadro e tempo de GPU não são confiáveis | [V] |
| Busca de fontes (curl) | Grep do bundle e tamanhos de arquivo | Tamanhos descompactados; sem tamanhos de transferência | [V] |
| REA | Disponível, **não necessário**: nenhuma questão de runtime nativo ou ofuscado | — | — |
| Chrome DevTools MCP | **Não está na lista de ferramentas desta sessão** | Rastros e Lighthouse não foram executados por ele | [V] |
| Figma MCP | Não usado: não há fonte no Figma para estas referências | — | — |
| Lighthouse nas referências | **Não executado** nesta etapa | Adiado para a validação (F13-T8) | — |
| Source maps | Nenhum existe (o site devolve HTML para `.map`) | Nomes minificados são só evidência | [V] |

**Verificações rodadas nesta fase:** ver §8.4.

---

## 1. Princípios da combinação

1. **O Website A é a fonte da verdade para a função**, mas o portfólio já implementa a maior parte das funcionalidades pelo CMS. Só as que faltam são construídas.
2. **O Website B informa a sensação, não o código.** Nenhum código, asset, áudio ou 3D é copiado.
3. **O movimento nunca bloqueia o conteúdo.** O LCP e o texto legível ficam visíveis antes de qualquer cena começar (storyboard §1).
4. **Movimento reduzido é um requisito rígido**, e o Website B falha nisso. O portfólio ganha um teste explícito (AC-M3).
5. **Uma tarefa por branch e por PR** (CLAUDE.md). As tarefas abaixo têm esse tamanho.
6. **Usar o sistema de movimento existente.** Cenas novas vão em `scenes/`; primitivas novas só onde houver padrão reutilizado.

---

## 2. Tarefas propostas

Propostas como a fase **F13 — Alinhamento com as referências**. A ordem segue o pedido original (arquitetura funcional → sistema de movimento → seções → microinterações → validação).

| Tarefa | Escopo | Mapeia para | Depende de | Prioridade | Situação |
|---|---|---|---|---|---|
| **F13-T1** | Modelo de conteúdo: `home.stats`. Sem migração SQL (blocos são JSON). Experiência e habilidades reutilizam `about`, sem tipo novo | A-R1 | — | P1 | **Feita** (`bad2d68`) |
| **F13-T2** | Faixa de números na home (F3) com contagem (M-06); valores finais no HTML; movimento reduzido mostra o valor final | A-R1 | F13-T1, D-03 | P1 | **Feita** (`bbe9c5c`) |
| **F13-T3** | Experiência na home (F4): dados de `about.timeline`, como bloco de narrativa fixada (M-03); no mobile, empilhada | A-R3 | D-01 | P1 | **Feita** (`144a7b0`) |
| **F13-T4** | Habilidades na home (F6): dados de `about.skills` como listas agrupadas (M-05). Marquee (M-07) opcional, não incluído | A-R5 | D-01 | P2 | **Feita** (`cb7cec1`) |
| **F13-T5** | CV autohospedado: link no cabeçalho e no hero; PDF pela mídia com as regras do ADR-0017 | A-R2, A-R8 | D-08, ADR-0017 | P0 | **Implementada** (`9d52de8`); ADR ainda **Proposto**; falta verificar no navegador |
| **F13-T6** | Helper de mola (M-02) aplicado ao CTA magnético (ponteiro fino) | Movimento | — | P2 | **Feita** (`3deacba`) |
| **F13-T7** | Gerador de mensagem de contato (F7) como **template no cliente**, com feedback (M-13); sem chamada de rede | A-R6 | D-02, aprovação do texto | P2 | **Pendente**: o texto do template nos cinco idiomas precisa da aprovação do owner |
| **F13-T8** | Validação: Lighthouse na home e em uma página de projeto, axe, teste de movimento reduzido ponta a ponta, comparação de capturas, relatório de desempenho | §5 | T1–T7 | P0 | **Pendente**: precisa de conteúdo em um banco local e de sessão de admin |

**Escopo total novo:** uma faixa de números na home, a experiência e as habilidades exibidas na home (os dados já existem em `about`), o CV autohospedado, uma ferramenta só no cliente e um helper de movimento.

### 2.1 Plano técnico por tarefa

**F13-T1 — modelo de conteúdo (feito, `bad2d68`)**
- Alterado: `shared/pages/blocks.ts` (`home.stats`, opcional com padrão `[]`), o editor admin em `app/pages/admin/paginas/[key].vue`, chaves admin em pt-BR, `tests/unit/home-stats.test.ts`.
- Sem migração SQL: blocos são JSON. Páginas salvas antes do campo ainda são válidas.

**F13-T2 — faixa de números (feita, `bbe9c5c`)**
- Alterado: `HomeContent.vue` (lista de descrição entre o hero e a história), `scenes/home.ts` (contagem com `gsap.to` e restauração ao final e ao reverter), `scenes/count.ts` (`countableStat`: recusa intervalos e palavras).
- Testes: unitários de `countableStat`; teste de componente Nuxt (valores no HTML, filtragem, ausência de faixa sem números).

**F13-T3 — experiência (feita, `144a7b0`)**
- `publicPage` da home lê o `about` na mesma língua (com pt-BR como padrão) e une as tags de cache do `about` às da home, para que publicar o `about` atualize a home.
- Narrativa fixada: `homeScene` passou a ter uma função `narrative(storyName, stepName)`; o CSS aceita `data-motion="experience"`. O título fica fora do bloco fixado (senão a grade o colocaria em outra linha).
- Testes: componente (ordem, títulos vazios, `data-pin` a partir de três funções, sem seção sem funções) e workers (a home recebe a linha do tempo e as tags do `about`).

**F13-T4 — habilidades (feita, `cb7cec1`)**
- Mesma fonte de dados (`about.skills`), grupos com título do próprio `pages.about.skills`, revelação única por grupo.
- Testes: componente (ordem, grupos e itens vazios filtrados, sem seção) e a extensão do teste de workers.

**F13-T5 — CV autohospedado (implementada, `9d52de8`)**
- Tipo de mídia `file` só para PDF (`shared/media/schemas.ts`): manifesto estrito, até 5 MB, sem largura nem altura.
- Chave `media/{xx}/{sha256}/file.pdf` (a única de PDF que `PUBLIC_MEDIA_KEY` aceita). Detecção por `%PDF-` em `server/utils/magic-bytes.ts`.
- Entrega: `server/utils/media-delivery.ts` define os cabeçalhos; PDF é `attachment` com `Content-Security-Policy: default-src 'none'; sandbox`; outros tipos continuam como antes.
- Configurações: `identity.global.cvMediaId` (nulo por padrão), validado como arquivo pronto. O site recebe só o link (`identity.cv.url`), no cabeçalho e no hero.
- **Correção de segurança junto:** as configurações agora gravam `media_usages` (CV e imagem OG) no mesmo lote do salvamento. Antes, a imagem OG podia ser apagada sem nenhum aviso.
- Admin: `CvField.vue` (envio do PDF sem pipeline de imagem; SHA-256 calculado no navegador).
- Testes: unitários (manifesto, chave, padrão público, sniff, cabeçalhos); workers (serviço de configurações contra o D1 real: vínculo, recusa de não-PDF, uso registrado e liberado).
- **Não verificado:** o envio pelo admin e o download no navegador. Ambos pedem sessão e banco local.

**F13-T6 — mola no CTA (feita, `3deacba`)**
- `app/composables/motion/spring.ts`: funções puras (`stepSpring`, `isAtRest`), amortecimento quase crítico, passo máximo de 1/30 s.
- O CTA magnético usa o ticker do GSAP só enquanto a mola se move, e o remove quando ela assenta ou a cena reverte.

**F13-T7 — gerador de mensagem (pendente)**
- Arquivos previstos: componente com `<form>`, campos nativos com rótulo, tom como grupo de rádio (setas do teclado), saída em `<textarea readonly>` com botão de copiar.
- Testes previstos: nenhum `fetch` ao enviar (log de requisições do Playwright); cópia com `navigator.clipboard` e alternativa; i18n nos cinco idiomas.
- Privacidade: o que o usuário digita não sai do navegador; nada é guardado.
- **Bloqueio:** o texto do template (a voz do owner) precisa de aprovação antes de ser escrito nos cinco idiomas.

**F13-T8 — validação (pendente)**
- Rodar `pnpm lighthouse`, `pnpm check:budgets`, `pnpm test:a11y`, `pnpm test:e2e`.
- Capturas em 1440, 820 e 390 contra as referências; resultados em `docs/quality/`.
- Precisa de conteúdo real (números e experiência) em um banco local e de sessão de admin para o envio de CV e a edição.

---

## 3. Critérios de aceitação

### 3.1 Paridade funcional (do Website A)

| ID | Critério | Como verificar |
|---|---|---|
| AC-F1 | Cada funcionalidade do A em §0.4 está coberta pelo portfólio ou adiada explicitamente com motivo | Checklist no relatório da F13-T8 |
| AC-F2 | Números, experiência, habilidades e CV são editáveis no admin, nos 5 idiomas | Teste do admin + `pnpm check:i18n` |
| AC-F3 | Gerador de mensagem (se aprovado) gera saída sem nenhuma requisição de rede | Log de requisições do Playwright |
| AC-F4 | Sem rolagem horizontal em 390 px | Verificação `scrollWidth` no Playwright |

### 3.2 Qualidade do movimento (inspirada no Website B, não copiada)

| ID | Critério | Como verificar |
|---|---|---|
| AC-M1 | Nenhum movimento atrasa o LCP nem o texto legível; conteúdo visível antes da cena começar | Rastro; teste do fallback `html.motion-ok` (3 s) |
| AC-M2 | O movimento usa só `transform`, `opacity` e, com moderação, `clip-path` | Revisão de código; eventos de pintura no rastro |
| AC-M3 | **Com `prefers-reduced-motion: reduce`: nenhuma requisição de GSAP, nenhuma animação de CSS em execução** (o teste que a Website B falha) | Playwright: log de requisições + `document.getAnimations()` |
| AC-M4 | Nenhuma informação só com hover ou só com ponteiro | Teste de teclado; axe |
| AC-M5 | Conteúdo em movimento automático (marquee) pode ser pausado e para com movimento reduzido | Playwright |
| AC-M6 | Nenhum flash acima de 3 por segundo | Revisão |

### 3.3 Desempenho e qualidade

| ID | Critério | Orçamento / fonte |
|---|---|---|
| AC-P1 | Lighthouse 100 nas 4 categorias na home e em uma página de projeto, quando for realisticamente possível; registrar qualquer lacuna | Meta do CLAUDE.md; `pnpm lighthouse` |
| AC-P2 | CLS = 0 na home | Lighthouse / rastro |
| AC-P3 | Nenhuma tarefa acima de 50 ms na inicialização do movimento | Rastro |
| AC-P4 | Orçamentos de JS em [performance-budgets](quality/performance-budgets.md) atendidos (artigo ≤ 100 KB gz) | `pnpm check:budgets` |
| AC-P5 | JS de movimento (GSAP + plugins + código próprio) na home dentro da meta de 60 KB gz do storyboard | Relatório de build |
| AC-Q1 | `pnpm typecheck`, `pnpm lint`, `pnpm test` passam; saída colada no relatório da tarefa | CLAUDE.md, passo 4 |
| AC-Q2 | 0 violações graves ou críticas do axe em cada rota alterada | `pnpm test:a11y` |
| AC-Q3 | Sem `v-html`; novas entradas validadas com zod `strict` | Revisão + testes |

---

## 4. Riscos e trade-offs

| Risco | Impacto | Mitigação |
|---|---|---|
| Novos tipos de bloco exigem mudança de schema e de editor | Médio: o CMS é o caminho principal de dados | Migração só expansiva (ou nenhuma, com JSON); tarefa F13-T1 antes de qualquer UI |
| Pin da experiência no mobile | Saltos de layout, acessibilidade | No mobile a seção é empilhada (já é regra do storyboard) |
| Custo de GSAP na home cresce com mais cenas | Orçamento de desempenho | Reaproveitar as cenas existentes; medir na F13-T8 |
| A "sensação" da Website B tenta para uma introdução bloqueante | Regressão de LCP | Rejeitada (M-11); só um contador ou marquee que não bloqueia |
| Números fornecidos pelo owner não são verificáveis pelo portfólio | Credibilidade | D-03: os números vêm do currículo e foram confirmados; nada inventado |
| O gerador de mensagem pode parecer uma afirmação de IA | Confiança | Só no cliente e rotulado como template (D-02) |
| WebGL por software no headless não mede a taxa de quadros | Desempenho do movimento não verificado | Marcar como não medido; testar em dispositivo real antes do lançamento |
| CV autohospedado é um PDF com conteúdo ativo | Superfície de ataque | ADR-0017: `attachment`, sandbox, nosniff, limite de 5 MB, sniff de cabeçalho; ADR ainda proposto |

---

## 5. Plano de validação (F13-T8)

| Verificação | Ferramenta | Rotas |
|---|---|---|
| Paridade funcional | Playwright (E2E) | `/`, `/projetos`, `/blog`, `/contato`, `/sobre` |
| Movimento reduzido | Playwright (`reducedMotion: 'reduce'`) | Home, página de projeto |
| Acessibilidade | axe via `pnpm test:a11y`; passagem manual de teclado | Rotas alteradas |
| Desempenho | `pnpm lighthouse`, rastro | Home, página de projeto, artigo |
| Paridade visual | Capturas em 1440 / 820 / 390, comparadas com [screenshots/](research/screenshots/) | Home |
| Multi-navegador | Playwright Chromium e WebKit (ambos instalados) | Home |

---

## 6. Decisões do owner

| ID | Pergunta | Recomendação | Resposta |
|---|---|---|---|
| **D-01** | Montar a seção de experiência como bloco de narrativa fixada (reaproveita o padrão aprovado)? | Sim | **Sim** |
| **D-02** | Gerador de mensagem de contato: template no cliente, com Workers AI (exige ADR e revisão de custo) ou não fazer? | Template no cliente | **Template no cliente** (texto pendente de aprovação) |
| **D-03** | Confirmar os quatro números da faixa e a redação (6+ anos; 5M+ usuários; 90%+ de cobertura; 70–80% de carregamento mais rápido), já que o portfólio não tem como verificá-los | Confirmar cada um | **Confirmados pelo currículo e pelo GitHub** (§8.2) |
| **D-04** | Migrar o conteúdo de experiência e habilidades do Website A para o CMS do portfólio? | Conferir o `/sobre` existente com o Website A e preencher lacunas | Pendente de conferência; a estrutura já existe |
| **D-05** | Manter o 3D fora do escopo (sem Three.js, sem hero WebGL)? | Sim | **Sim** |
| **D-06** | Idioma destes docs: inglês (como foi escrito) ou pt-BR (convenção do CLAUDE.md)? | pt-BR | **pt-BR** (esta tradução) |
| **D-07** | Aprovar as tarefas F13-T1 a F13-T8 e a ordem em relação à F12-T5 pendente? | Aprovar; fazer a F13 depois da F12-T5 | **Aprovado**, com a F13 depois da F12-T5 |
| **D-08** | Download do CV: (a) link externo https para o CV que o owner já hospeda, sem código; ou (b) PDF na biblioteca de mídia, com um novo tipo `file`, revisão de segurança e ADR | (a) agora; (b) só se o owner quiser autohospedar | **Autohospedado** (opção b), com o ADR-0017 |

---

## 7. Estado das entregas

| Entrega (do pedido) | Situação | Local |
|---|---|---|
| Avaliação do repositório | Feita | §0 deste documento |
| Análise funcional do Website A | Feita (com limitações) | [research/website-a-functional-analysis.md](research/website-a-functional-analysis.md) |
| Análise de movimento do Website B | Feita (headless, GL por software; taxas de quadro não medidas) | [research/website-b-motion-analysis.md](research/website-b-motion-analysis.md) |
| Mapeamento de animação | Feito | [animation-mapping.md](animation-mapping.md) |
| Plano de implementação | Feito e aprovado | este documento |
| Docs do sistema de movimento | Existe | [design/motion-principles.md](design/motion-principles.md), [ADR-0011](architecture/adr/0011-motion.md) |
| Doc de arquitetura | Existe com outro nome | [architecture/overview.md](architecture/overview.md). Um `ARCHITECTURE.md` na raiz duplicaria o conteúdo, então não é proposto |
| README | Existe | [../README.md](../README.md) |
| Testes automatizados | Existem (Vitest, Playwright); novos testes por tarefa | F13-T1 a T8 |
| Relatório de desempenho | Escrever na F13-T8 | `docs/quality/` |
| Alterações de código | Feitas para F13-T1 a T6 e T5 (ver §8) | branches `feat/F13-*` |

---

## 8. Estado (2026-11-25)

### 8.1 Decisões do owner

Ver a tabela de respostas em §6. Resumo: D-01 sim (experiência fixada na home); D-02 template no cliente; D-03 números do currículo; D-05 sem 3D; D-06 docs em pt-BR; D-07 aprovado, F13 depois da F12-T5; D-08 CV autohospedado com ADR-0017.

### 8.2 Números para o D-03, conforme o currículo

| Número (`value`) | Legenda (`label`) | Fonte no currículo |
|---|---|---|
| `6+` | Anos de experiência em frontend | Resumo: "6+ years of experience" |
| `~5M` | Usuários da plataforma em que liderei o frontend | EnBW: "a platform serving around 5 million users" |
| `70–80%` | Carregamento de página mais rápido após a migração para Nuxt | Bee Engineering, Link Consulting: "reducing page load times by 70-80%" |
| `90%+` | Cobertura de componentes críticos | TLScontact: "over 90% coverage on critical components" |

Duas mudanças de redação em relação ao primeiro rascunho: "5M+" virou "~5M" (o currículo diz "around"), e as legendas agora dizem só o que a fonte sustenta. O owner informa esses números no editor da página inicial, na seção "Números". Nada é semeado no banco.

### 8.3 Commits e o que resta

| Tarefa | Situação | Commit |
|---|---|---|
| F13-T1 modelo de números da home | Feita | `bad2d68` |
| F13-T2 faixa de números com contagem | Feita | `bbe9c5c` |
| F13-T3 experiência fixada na home | Feita | `144a7b0` |
| F13-T4 grupos de habilidades na home (marquee não incluído) | Feita | `cb7cec1` |
| F13-T5 CV autohospedado | Implementada; ADR-0017 ainda **Proposto**; falta verificação no navegador | `9d52de8` (ADR em `ff16193`) |
| F13-T6 CTA magnético com mola | Feita | `3deacba` |
| F13-T7 gerador de mensagem, só no cliente | **Pendente**: texto do template nos cinco idiomas precisa de aprovação | — |
| F13-T8 validação | **Parcial**: Lighthouse e a verificação de movimento reduzido feitos no build de produção (ver §8.4). Falta: axe, E2E, capturas e a conferência com os números e a experiência reais em um banco com conteúdo | — |
| Tradução destes docs para pt-BR (D-06) | Feita nesta etapa | branch `docs/F13-pt-br` |

### 8.4 Verificado até agora

- `test:unit` 498/498; `test:workers` 139/139; `test:nuxt` 162/162; `typecheck` código de saída 0; `check:i18n` OK; `check:budgets` OK; `build` OK (medido antes da F13-T5).
- Orçamento de JS da rota home: 122,92 kB de um limite de 125 kB, medido depois de T1–T4 e T6 (2 kB de folga). CSS 7,61 kB de 30 kB. A rota `/blog` está em 126,23 de 127 kB, o que não é causado por estas tarefas. Remedir na F13-T8.
- `lint` falha só em `nuxt.config.ts` (a alteração de formatação que já estava sem commit). Todos os arquivos novos passam no lint.
- **Lighthouse 13.5 na home (`pnpm lighthouse`, build de produção em `pnpm preview:prod`, banco local migrado e sem conteúdo do owner):** desktop 100 / 100 / 100 / 100 (desempenho, acessibilidade, boas práticas, SEO); mobile 98 / 100 / 100 / 100. CLS 0,000 nos dois; LCP no H1 (não escondido). Medido com uma execução cada; é a casca da página, não a página com os números.
- **AC-M3 (movimento reduzido), no build de produção:** com `prefers-reduced-motion: reduce`, nenhum dos 8 scripts de movimento (que contêm GSAP e ScrollTrigger) é baixado, o diretor de movimento não inicia e não há animação de CSS em execução. Sem a preferência, os 8 carregam e o diretor inicia.
- **Não verificado no navegador:** a faixa de números, o pin, a contagem, o CV (envio pelo admin e download). Os testes de componente cobrem a marcação; os testes de workers cobrem o caminho de dados; os testes unitários cobrem as regras de mídia e de cabeçalho.

### 8.5 Correções feitas durante a execução

- A primeira versão do plano dizia que a experiência e as habilidades não existiam. Existiam em `about`, com editor e página. Corrigido nos commits `ca52136` e nesta tradução.
- O CV não podia ser só upload de imagem: o pipeline só aceitava imagem e vídeo. Resolvido com o tipo `file` do ADR-0017.
- As configurações não registravam usos de mídia; a imagem OG podia ser apagada. Corrigido junto com o CV (F13-T5).
- O `HomeContent` lia `blocks.stats` sem fallback e quebrava com blocos não parseados (visto no teste de app). Corrigido com `?? []`.
