# F12 — Qualidade final, operação e lançamento

**Objetivo da fase:** as suítes completas (E2E, acessibilidade, segurança), a operação pronta (backups, restore e rollback ensaiados, observabilidade) e o lançamento **autorizado por você**.

**Pré-requisitos:** F11 concluída. Domínio (Q-01) e decisão sobre analytics (Q-08) para a F12-T5.

**Leitura obrigatória:** [ADR-0014](../architecture/adr/0014-operacao.md), [backup-restore](../operations/backup-restore.md), [environments](../operations/environments.md), [security-model](../architecture/security-model.md), [accessibility](../quality/accessibility.md), skill `/release-check`.

**Gate de saída:** `/release-check` com resultado "go", e o seu pedido explícito de lançamento.

---

### F12-T1 — Suítes E2E completas das jornadas

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F11 (gate) | RNF-04, RF-01, RF-05, RF-11 | `/test-engineer` |

**Objetivo.** Cobrir as jornadas J-01…J-08 do PRD, o teste "sem JS" de todas as rotas públicas (conteúdo presente) e o crawl de i18n. Estabilizar ou corrigir os testes instáveis.

**Arquivos prováveis.** `tests/e2e/journeys/*.spec.ts`, `tests/e2e/no-js.spec.ts`.

**Fora do escopo.** Funcionalidades novas.

**Critérios de aceite**
- [ ] As 8 jornadas passam em Chromium desktop e WebKit mobile (a passkey só em Chromium, documentado).
- [ ] Zero testes marcados `fixme` sem issue; 3 execuções seguidas sem falha intermitente.

**Testes**
- Saída da suíte completa, com contagem e duração.

---

### F12-T2 — Auditoria de acessibilidade

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F12-T1 | RNF-10 | `/frontend-design`, `/test-engineer` |

**Objetivo.** Rodar a matriz axe completa (templates × idiomas × temas × movimento reduzido) e a passada manual com VoiceOver em R1–R8 e no fluxo editorial do admin ([accessibility](../quality/accessibility.md) §2 e §4), e corrigir o que for encontrado.

**Arquivos prováveis.** Correções pontuais; relatório em `docs/quality/a11y-audit-<data>.md`.

**Fora do escopo.** Redesenho sem relação com acessibilidade.

**Critérios de aceite**
- [ ] 0 violações axe sérias ou críticas; Lighthouse Accessibility 100 nas rotas-chave.
- [ ] A checklist manual foi preenchida, com os achados e as correções.

**Testes**
- Suíte `a11y` completa (saída) e relatório manual.

---

### F12-T3 — Auditoria de segurança

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F12-T1 | RNF-06, RNF-07, RNF-12 | `/security-audit` |

**Objetivo.** Rodar o `/security-audit` no escopo completo (security-model §2 e §5) e, além dele:
- `pnpm audit`;
- busca de segredos no histórico do git;
- confirmação de que o login de teste não está no build de produção;
- conferência dos headers no preview;
- revisão da matriz de autorização contra o código.

**Arquivos prováveis.** Correções; relatório em `docs/operations/security-audit-<data>.md`.

**Fora do escopo.** Testes de intrusão em infraestrutura da Cloudflare.

**Critérios de aceite**
- [ ] Nenhum achado alto ou crítico aberto; os médios têm plano e data.
- [ ] O build de produção não contém o endpoint de login de teste (busca no output).
- [ ] Nenhum segredo no repositório nem no histórico.

**Testes**
- Os testes de segurança da estratégia passam (API: authz, CSRF, rate limit, headers, uploads).

---

### F12-T4 — Operação: backups, restore e rollback ensaiados, observabilidade

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F12-T1 | RNF-08, RNF-13 | `/release-check` |

**Objetivo.** Criar o workflow agendado de export semanal do D1 para o `BACKUPS` e o manifesto de mídia, o workflow de deploy de preview e o de produção (`workflow_dispatch`, sem execução automática). Ensaiar o restore (export → banco de verificação) e o rollback de versão no preview, e revisar os logs e o painel de uso (custos).

**Arquivos prováveis.** `.github/workflows/{backup,deploy-preview,deploy-production}.yml`, `docs/operations/backup-restore.md` (registro de ensaios), `docs/operations/runbook.md` (novo, com incidentes comuns).

**Fora do escopo.** Monitor externo pago.

**Critérios de aceite**
- [ ] Criar o bucket `BACKUPS` e os segredos do CI só com sua autorização; o primeiro export roda e é listado.
- [ ] Restore ensaiado: contagens e amostra conferidas, com o tempo registrado.
- [ ] Rollback de versão ensaiado no preview.
- [ ] O workflow de produção exige disparo manual e passa por migrações (com bookmark) → upload → deploy → smoke.

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
