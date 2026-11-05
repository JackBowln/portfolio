# F12 — Qualidade final, operação e lançamento

**Objetivo da fase:** as suítes completas (E2E, acessibilidade, segurança), a operação pronta (backups, restore e rollback ensaiados, observabilidade) e o lançamento **autorizado por você**.

**Pré-requisitos:** F11 concluída. Domínio (Q-01) e decisão sobre analytics (Q-08) para a F12-T5.

**Leitura obrigatória:** [ADR-0014](../architecture/adr/0014-operacao.md), [backup-restore](../operations/backup-restore.md), [environments](../operations/environments.md), [security-model](../architecture/security-model.md), [accessibility](../quality/accessibility.md), skill `/release-check`.

**Gate de saída:** `/release-check` com resultado "go", e o seu pedido explícito de lançamento.

---

### F12-T1 — Suítes E2E completas das jornadas

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F11 (gate) | RNF-04, RF-01, RF-05, RF-11 | `/test-engineer` |

**Objetivo.** Cobrir as jornadas J-01…J-08 do PRD, o teste "sem JS" de todas as rotas públicas (conteúdo presente) e o crawl de i18n. Estabilizar ou corrigir os testes instáveis.

**Arquivos prováveis.** `tests/e2e/journeys/*.spec.ts`, `tests/e2e/no-js.spec.ts`.

**Fora do escopo.** Funcionalidades novas.

**Critérios de aceite**
- [x] As 8 jornadas passam em Chromium desktop e WebKit mobile (a passkey só em Chromium, documentado).
- [x] Zero testes marcados `fixme` sem issue; 3 execuções seguidas sem falha intermitente.

**Resultado (05/11/2026).**
- **Gate da F11** (decisão 5): seguiu com o Lighthouse cumprido. O purge ≤ 60 s fica para o deploy do preview (owner).
- **Jornadas:**
  - J-01–J-07 em `tests/e2e/journeys/`, em Chromium desktop e WebKit mobile;
  - J-08 no `tests/auth-flow/`, só em Chromium (o autenticador WebAuthn virtual é do Chromium);
  - J-04, J-05/J-06 e J-07 foram consolidadas a partir dos specs antigos (decisão 2), com a J-06 editando o original pelo editor;
  - J-02 começa na URL alemã que um buscador abre (decisão 3: o site não tem busca interna);
  - as jornadas do owner passaram a rodar no WebKit (decisão 4) e passaram sem correção.
- **Defeitos que as jornadas acharam:**
  - **Contato pela navegação do site (F08-T3):** a página mantinha a CSP da anterior, sem o Turnstile, e a mensagem não saía. Os links para o contato carregam a página do servidor (`external` no `UiLocalizedLink`); o owner subiu o R4 para 126 KB (+0,02 kB).
  - **Seletor de idioma na 404:** os links saíam sem `href` (não focáveis e sem destino sem JS). Agora levam à home de cada idioma.
- **Sem JS:** `tests/e2e/no-js.spec.ts`, 13 rotas públicas nos dois navegadores. Confere o `h1`, o texto, a navegação (o menu do celular abre sem JS), os `alt`, a ausência de conteúdo escondido por motion e o seletor em links reais.
- **i18n:** `tests/e2e/i18n-crawl.spec.ts` percorre as páginas estáticas e o artigo, o projeto e o tema da massa, nos 5 idiomas. Confere 200, o `lang`, os rótulos da navegação no idioma, nenhuma chave dos arquivos de mensagens no texto e o seletor levando a páginas que respondem 200.
- **Estabilidade** (decisão 1):
  - **Dados:** o `pnpm preview:test` recria `.wrangler/state-e2e` com as migrações a cada execução (`scripts/e2e-state.ts`). Os dados acumulados (215 projetos, artigos com data futura) eram a causa das falhas recorrentes da ordem de projetos e da lista do blog.
  - **Specs com dados próprios:** os que dependiam de dados deixados por outros, como o `transitions.spec`, que precisava de um projeto com capa, criam os seus.
  - **WebKit:** os `goto` em sequência esperam a hidratação. O WebKit conta o `replaceState` do router como navegação e interrompia o próximo `goto`.
- **Achado fora do escopo, para decidir:** a página de erro é renderizada pelo Nuxt numa sub-requisição sem o contexto da Cloudflare. O `/api/public/settings` responde 500 ("Cloudflare bindings unavailable") e a 404 sai com as configurações padrão.

**Testes**
- Saída da suíte completa, com contagem e duração.

---

### F12-T2 — Auditoria de acessibilidade

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída (VoiceOver pendente com o owner) | F12-T1 | RNF-10 | `/frontend-design`, `/test-engineer` |

**Objetivo.** Rodar a matriz axe completa (templates × idiomas × temas × movimento reduzido) e a passada manual com VoiceOver em R1–R8 e no fluxo editorial do admin ([accessibility](../quality/accessibility.md) §2 e §4), e corrigir o que for encontrado.

**Arquivos prováveis.** Correções pontuais; relatório em `docs/quality/a11y-audit-<data>.md`.

**Fora do escopo.** Redesenho sem relação com acessibilidade.

**Critérios de aceite**
- [x] 0 violações axe sérias ou críticas; Lighthouse Accessibility 100 nas rotas-chave.
- [x] A checklist manual foi preenchida, com os achados e as correções.

**Resultado (05/11/2026).** O relatório completo está em [a11y-audit-2026-11-05](../quality/a11y-audit-2026-11-05.md).
- **Matriz axe:** 11 templates × pt-BR/de × claro/escuro × movimento reduzido/normal, mais o preview (92 casos, 0 violações sérias ou críticas). Substitui os specs por página da F01–F08 (decisão 2).
- **Checklist:** medida no navegador, com 13 testes.
- **Correções:**
  - a âncora de seção com 24×24 px (2.5.8);
  - os grids de uma coluna com `minmax(0, 1fr)`, porque uma imagem que não carregava alargava a página no celular (1.4.10);
  - o envio simultâneo do mesmo arquivo responde 409 em vez de 500;
  - o id de linguagem `ts` nos dados de referência.
- **VoiceOver** (decisão 1): o roteiro está no relatório, para o owner executar.
- **Fora daqui** (decisão 3): a 404 renderizada sem os bindings da Cloudflare (achado da F12-T1).

**Testes**
- Suíte `a11y` completa (saída) e relatório manual.

---

### F12-T3 — Auditoria de segurança

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída (headers no preview pendentes com o owner) | F12-T1 | RNF-06, RNF-07, RNF-12 | `/security-audit` |

**Objetivo.** Rodar o `/security-audit` no escopo completo (security-model §2 e §5) e, além dele:
- `pnpm audit`;
- busca de segredos no histórico do git;
- confirmação de que o login de teste não está no build de produção;
- conferência dos headers no preview;
- revisão da matriz de autorização contra o código.

**Arquivos prováveis.** Correções; relatório em `docs/operations/security-audit-<data>.md`.

**Fora do escopo.** Testes de intrusão em infraestrutura da Cloudflare.

**Critérios de aceite**
- [x] Nenhum achado alto ou crítico aberto; os médios têm plano e data.
- [x] O build de produção não contém o endpoint de login de teste (busca no output).
- [x] Nenhum segredo no repositório nem no histórico.

**Resultado (05/11/2026).** O relatório completo está em [security-audit-2026-11-05](../operations/security-audit-2026-11-05.md).
- **Achados:** críticos 0, altos 0, médios 2.
  - A passkey sem verificação do usuário foi corrigida: o servidor exige a flag UV.
  - O aviso do `nuxt` < 4.6.3 foi aceito pelo owner: o desvio não é explorável aqui, e o 4.6.3 estoura o R7.
- **`node-forge`:** forçado para 1.4.2; o `pnpm audit --audit-level high` está limpo e a exceção antiga saiu.
- **Segredos:** o `gitleaks` varreu 301 commits, sem vazamento.
- **`pnpm check:prod-build`:** novo, no CI; nenhum código de teste no build de produção.
- **Headers:** fixados em `tests/api-prod/headers.spec.ts`.
- **Matriz:** as 76 rotas do admin foram conferidas contra ela.

**Testes**
- Os testes de segurança da estratégia passam (API: authz, CSRF, rate limit, headers, uploads).

---

### F12-T4 — Operação: backups, restore e rollback ensaiados, observabilidade

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída (execução dos workflows no GitHub pendente com o owner) | F12-T1 | RNF-08, RNF-13 | `/release-check` |

**Objetivo.** Criar o workflow agendado de export semanal do D1 para o `BACKUPS` e o manifesto de mídia, o workflow de deploy de preview e o de produção (`workflow_dispatch`, sem execução automática). Ensaiar o restore (export → banco de verificação) e o rollback de versão no preview, e revisar os logs e o painel de uso (custos).

**Arquivos prováveis.** `.github/workflows/{backup,deploy-preview,deploy-production}.yml`, `docs/operations/backup-restore.md` (registro de ensaios), `docs/operations/runbook.md` (novo, com incidentes comuns).

**Fora do escopo.** Monitor externo pago.

**Critérios de aceite**
- [x] Criar o bucket `BACKUPS` e os segredos do CI só com sua autorização; o primeiro export roda e é listado. (Bucket `portfolio-backups` criado; primeiro export do preview gravado e conferido por releitura, porque o wrangler não lista objetos. Os segredos do CI ficam com o owner.)
- [x] Restore ensaiado: contagens e amostra conferidas, com o tempo registrado ([backup-restore §6](../operations/backup-restore.md#6-registro-de-ensaios-trimestral)).
- [x] Rollback de versão ensaiado no preview.
- [x] O workflow de produção exige disparo manual e passa por migrações (com bookmark) → upload → deploy → smoke.

**Testes**
- Execuções reais dos workflows no preview (logs no relatório).

---

### F12-T5 — Release check e lançamento

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F12-T2, F12-T3, F12-T4 | RF-12.7, RNF-01, RNF-12 | `/release-check` |

**Objetivo.** Rodar o `/release-check` (go/no-go). Com o "go" **e o seu pedido**, executar o lançamento:
1. Domínio e DNS (ação sua).
2. Criação dos recursos de produção e dos segredos.
3. Bootstrap do owner em produção e registro da passkey.
4. Remoção do `BOOTSTRAP_TOKEN`.
5. Primeiro deploy por `workflow_dispatch`.
6. Smoke test e envio do sitemap ao Search Console (ação sua).

Depois, a checklist de 30 dias.

**Arquivos prováveis.** `docs/operations/launch-<data>.md` (registro), ajustes de configuração de produção.

**Fora do escopo.** Funcionalidades novas; HSTS preload (decisão posterior).

**Critérios de aceite**
- [ ] `/release-check` registrado com "go" e sem bloqueadores.
- [ ] Produção respondendo no domínio, com robots e canonical corretos, admin acessível só pelo owner e `BOOTSTRAP_TOKEN` removido.
- [ ] Lighthouse em produção registrado no `perf-log` (R1, R3, R5).
- [ ] A checklist de 30 dias foi criada: CWV de campo, revisão de uso e custos, backups e dependências.

**Testes**
- Smoke E2E contra a produção (só leitura) e verificação de headers.

---

## Prompt da fase

```text
Fase F12 — Qualidade final, operação e lançamento. Projeto: ~/Desktop/dev/portfolio.

Leia CLAUDE.md, docs/roadmap/F12-qualidade-lancamento.md, o ADR-0014, docs/operations/* e o security-model. Pegue a primeira tarefa "pendente" com dependências concluídas.

Antes de editar: apresente objetivo, arquivos, abordagem, testes e riscos. Aguarde minha aprovação.

Regras desta fase:
- Nenhum recurso de produção, segredo, DNS, migração remota ou deploy sem meu pedido explícito, um passo de cada vez, com confirmação antes de cada comando destrutivo.
- Na F12-T5, rode /release-check primeiro; sem "go", não avance.
- Não imprima valores de segredos; refira-se a eles só pelo nome.

Depois de cada tarefa: cole a saída real das suítes e dos workflows; atualize o status, os runbooks e os registros; entregue o relatório da Definition of Done. Não faça commit sem eu pedir.
```
