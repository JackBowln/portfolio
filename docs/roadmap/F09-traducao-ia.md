# F09 — Tradução assistida por IA com revisão humana

**Objetivo da fase:** o fluxo completo de tradução (pt-BR → en, es, de, fr) com Workers AI, segmentação que preserva a estrutura, controle de custo com teto rígido, detecção de desatualização por segmento e revisão humana obrigatória.

**Pré-requisitos:** F07 e F08 concluídas (todas as entidades traduzíveis existem).

**Leitura obrigatória:** [ADR-0009](../architecture/adr/0009-traducao-assistida-por-ia.md), [data-model §7 e §8](../architecture/data-model.md), [i18n-seo §3](../architecture/i18n-seo.md#3-política-de-conteúdo-não-traduzido), skill `/i18n-manager` (referência `translation-workflow.md`).

**Gate de saída:** as jornadas J-05 (traduzir → revisar → aprovar → publicar) e J-06 (editar o original → `outdated` → retraduzir só os segmentos alterados) passando em E2E, e o teto de custo comprovado por teste (job acima do saldo bloqueado **antes** da chamada).

---

### F09-T1 — Estados de tradução e detecção de desatualização

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F07 (gate), F08 (gate) | RF-10.4, RF-11.2, RF-11.4 | `/cms-engineer`, `/i18n-manager` |

**Objetivo.** Criar o serviço de estados de tradução (data-model §8) e o cálculo de `segments_meta` (hash por segmento do original). A localização vira `outdated` quando a origem muda. As guardas de publicação (só `approved`) passam a valer para artigos, projetos, páginas, temas e textos de mídia, e o dashboard ganha contadores por estado.

**Arquivos prováveis.** `server/services/translation/state.service.ts`, `shared/content/segment-hash.ts`, `app/pages/admin/index.vue` (contadores), `app/components/admin/translation/StatusBadge.vue`.

**Fora do escopo.** Chamar a IA (T3).

**Critérios de aceite**
- [ ] Editar um segmento do original marca como `outdated` **só** esse segmento nas traduções `approved`, e a localização passa a `outdated`.
- [ ] A publicação de uma localização `outdated`, `machine` ou `in_review` é bloqueada com uma mensagem clara.
- [ ] O dashboard mostra pendências por idioma e por tipo de entidade.

**Testes**
- Unit: as transições de estado e o cálculo dos hashes.
- Workers: o `outdated` por segmento depois de editar o original.

---

### F09-T2 — Segmentador, placeholders inline e glossário

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F09-T1 | RF-11.6, RF-11.7 | `/i18n-manager`, `/test-engineer` |

**Objetivo.** Criar o `shared/content/segmenter.ts`:
- **extrai** segmentos (blocos textuais por `id`, título, resumo, campos SEO, slug sugerido) com as marcas inline como tags-placeholder;
- **reinsere** a tradução, validando a contagem e a ordem das tags;
- **protege** código, URLs e termos `doNotTranslate`.

Incluir também o CRUD do glossário no admin.

**Arquivos prováveis.** `shared/content/segmenter.ts`, `shared/content/inline-tags.ts`, `server/db/schema/translation.ts` (`glossary_terms`, `translation_jobs`), migração, `server/api/admin/glossary/**`, `app/pages/admin/glossario.vue`.

**Fora do escopo.** O provedor de IA (T3).

**Critérios de aceite**
- [ ] Ida e volta (extrair → reinserir sem alterar) = identidade para todos os tipos de nó do schema.
- [ ] Placeholder faltando, sobrando ou trocado de ordem → segmento marcado como falho, sem corromper o documento.
- [ ] Termos `doNotTranslate` e blocos de código nunca aparecem no payload enviado (verificado).

**Testes**
- Unit: teste de propriedade (documentos aleatórios válidos pelo schema); casos de tags inválidas.
- Cobertura ≥ 90% de branches no segmentador.

---

### F09-T3 — Adaptador de provedores, Workers AI e guarda de custo

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F09-T2 | RF-11.1, RF-11.3, RNF-08 | `/i18n-manager`, `/security-audit`, `/architecture-guardian` |

**Objetivo.** Implementar:
- a interface `TranslationProvider` (`estimate`, `translate`), com `WorkersAiProvider` (saída JSON estruturada) e `FakeTranslationProvider` para os testes;
- o guarda de custo: teto diário de neurons, teto mensal em US$, teto por job e chave `enabled`;
- o ledger em `translation_jobs`;
- lotes de no máximo ~3 mil tokens, no máximo 20 chamadas por request, com retomada.

Fazer a **avaliação de modelos** (3 artigos × 4 idiomas: qualidade de 1 a 5, preservação das tags, neurons) e registrar no ADR-0009.

**Arquivos prováveis.** `server/services/translation/providers/{types,workers-ai,fake}.ts`, `server/services/translation/cost-guard.ts`, `server/services/translation/run.service.ts`, `server/api/admin/translations/**`.

**Fora do escopo.** Provedor Claude (exige ADR e aprovação; fica no backlog).

**Critérios de aceite**
- [ ] Executar exige uma estimativa recente e confirmação explícita; job acima do saldo → bloqueado **antes** de qualquer chamada (testado com o fake).
- [ ] O ledger registra os valores estimados e os reais (ou o estimado, com a flag `usage_estimated`); as somas por dia UTC e por mês aparecem no dashboard.
- [ ] Erro do provedor → job `failed` com mensagem sanitizada; os lotes já concluídos são preservados e a execução é retomável.
- [ ] A avaliação de modelos está registrada; o modelo padrão fica configurado em `ai_translation.model`.
- [ ] Nenhum dado de contato ou de usuário entra no payload.

**Testes**
- Unit: o guarda de custo (limites, virada do dia UTC e do mês) e o chunking.
- Workers: o ledger e a retomada com o provedor fake.
- Teste manual registrado da chamada real ao Workers AI no preview, com sua autorização.

---

### F09-T4 — Interface de revisão lado a lado e publicação por idioma

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F09-T3 | RF-11.1, RF-11.2, RF-11.5 | `/cms-engineer`, `/frontend-design`, `/i18n-manager` |

**Objetivo.** Criar a tela de revisão:
- segmentos lado a lado (original e tradução editável), com destaque dos falhos e dos `outdated`;
- diff contra a tradução anterior;
- ações: "retraduzir selecionados", "retraduzir desatualizados" e "aprovar";
- sugestão de slug e SEO traduzidos, editáveis;
- publicação por idioma.

Incluir uma tela de tradução em lote para temas, textos de mídia e configurações.

**Arquivos prováveis.** `app/pages/admin/traducoes/{index,[entity]/[id]/[locale]}.vue`, `app/components/admin/translation/*.vue`.

**Fora do escopo.** Tradução das strings de interface do repositório.

**Critérios de aceite**
- [ ] Aprovar exige `translation:approve`; publicar o idioma exige também `*:publish` e respeita as guardas.
- [ ] O slug traduzido é único por idioma, com transliteração.
- [ ] A interface é operável por teclado; a ordem de leitura do lado a lado faz sentido no leitor de tela.

**Testes**
- E2E (J-05): traduzir com o fake → revisar → aprovar → publicar `en` → a página `/en/blog/<slug-en>` existe, com hreflang recíproco.
- E2E (J-06): editar o original → só os segmentos alterados ficam `outdated` → retraduzir → aprovar.

---

## Prompt da fase

```text
Fase F09 — Tradução assistida por IA. Projeto: ~/Desktop/dev/portfolio.

Leia CLAUDE.md, docs/roadmap/F09-traducao-ia.md, o ADR-0009, o data-model §7–§8 e o i18n-seo §3. Use /i18n-manager. Pegue a primeira tarefa "pendente" com dependências concluídas.

Antes de editar: apresente objetivo, arquivos, abordagem, dependências novas, testes e riscos. Aguarde minha aprovação.

Regras desta fase:
- Provedor: somente Workers AI. Claude (ou qualquer serviço pago) só com ADR e minha aprovação.
- O teto de custo é verificado antes de cada chamada; padrões seguros (8.000 neurons/dia, US$ 0/mês).
- Nenhuma tradução é publicada sem revisão humana (estado approved).
- Testes usam o FakeTranslationProvider; chamadas reais só no preview e com minha autorização.

Depois de implementar: rode typecheck, lint, test, test:api e os e2e J-05/J-06; cole a saída real; registre a avaliação de modelos no ADR-0009 (F09-T3); atualize o status e os docs; entregue o relatório da Definition of Done. Não faça commit sem eu pedir.
```
