# F07 — Projetos e estudos de caso

**Objetivo da fase:** projetos com estudo de caso completo (papel, período, contexto, desafio, solução, resultados verificáveis, tecnologias, galeria, links), reaproveitando revisões e publicação, mais as páginas públicas editoriais.

**Pré-requisitos:** F06 concluída. Conteúdo real de pelo menos 1 projeto (Q-04), ou um `[PLACEHOLDER]` marcado.

**Leitura obrigatória:** [data-model §4.5](../architecture/data-model.md), [ADR-0006](../architecture/adr/0006-conteudo-e-editor.md), [design-direction](../design/design-direction.md), skill `/cms-engineer`.

**Gate de saída:** um estudo de caso criado, revisado, publicado e exibido de ponta a ponta, com Lighthouse dentro da política na R4 e na R5.

---

### F07-T1 — Admin de projetos (reaproveitando revisões e publicação)

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F06 (gate) | RF-09.1, RF-09.2, RF-05.4 | `/cms-engineer`, `/architecture-guardian` |

**Objetivo.** Criar a API e as telas de projetos com os campos do data-model:
- `summary`, `role`, período, `repo_url`, `demo_url`, capa, galeria, tecnologias (tags `technology` com CRUD), `highlights` verificáveis, ordenação e destaque;
- o template do corpo, com as seções Contexto, Desafio, Solução e Resultados.

Os serviços de revisão e publicação da F06 são reaproveitados de forma genérica.

**Arquivos prováveis.** `server/api/admin/projects/**`, `server/services/content/projects.service.ts`, `app/pages/admin/projetos/{index,[id]}.vue`, `app/components/admin/projects/*.vue`.

**Fora do escopo.** Filtros públicos (T2).

**Critérios de aceite**
- [ ] A generalização dos serviços da F06 não muda o comportamento dos artigos (todos os testes da F06 continuam verdes).
- [ ] `repo_url` e `demo_url` só com `https:`; `highlights` exige rótulo e valor, e a interface avisa: "use apenas resultados verificáveis".
- [ ] A ordenação manual persiste; o destaque na home é configurável.
- [ ] Permissões e auditoria aplicadas.

**Testes**
- Workers e API: CRUD, publicação e restauração de projeto.
- Toda a suíte da F06 é reexecutada (regressão).

---

### F07-T2 — Páginas públicas de projetos

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F07-T1 | RF-01.3, RF-09.3, RF-09.4, RX-01 | `/frontend-design`, `/i18n-manager`, `/performance-audit` |

**Objetivo.** Criar:
- `/projetos`: grade editorial e filtro por tecnologia (SSR via query, com ilha mínima, se necessário);
- `/projetos/[slug]`: estudo de caso com cabeçalho, metadados (papel, período, stack), highlights, narrativa, galeria e links para GitHub e demo, mais projetos relacionados por tecnologia (_could_).

**Arquivos prováveis.** `app/pages/projetos/{index,[slug]}.vue`, `app/components/projects/*.vue`, `server/api/public/projects/**`.

**Fora do escopo.** Transições cinematográficas (F10-T4) e JSON-LD completo (F11-T1).

**Critérios de aceite**
- [ ] Layout editorial aprovado por você (prints em 390, 1280 e 1920 px no relatório).
- [ ] Filtro por tecnologia acessível (estado anunciado; funciona sem JS via query).
- [ ] Alternates, cache tags e ausência de `Set-Cookie` como no blog.
- [ ] Lighthouse dentro da política na R4 e na R5.

**Testes**
- E2E: lista → filtro → estudo de caso → link externo com `rel` correto.
- a11y: axe nas duas páginas.
- `/performance-audit` na R4 e na R5.

---

## Prompt da fase

```text
Fase F07 — Projetos e estudos de caso. Projeto: ~/Desktop/dev/portfolio.

Leia CLAUDE.md, docs/roadmap/F07-projetos.md, o data-model §4.5 e o ADR-0006. Use /cms-engineer e /frontend-design. Pegue a primeira tarefa "pendente" com dependências concluídas.

Antes de editar: apresente objetivo, arquivos, abordagem (incluindo como generalizar os serviços da F06 sem mudar o comportamento dos artigos), testes e riscos. Aguarde minha aprovação.

Regras desta fase:
- Highlights e resultados apenas verificáveis: nunca invente métricas, clientes ou depoimentos.
- Reexecute a suíte da F06 depois de generalizar os serviços (regressão).

Depois de implementar: rode typecheck, lint, test, test:api, e2e e a11y; cole a saída real; atualize o status e os docs; entregue o relatório da Definition of Done. Não faça commit sem eu pedir.
```
