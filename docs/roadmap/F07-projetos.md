# F07 — Projetos e estudos de caso

**Objetivo da fase:** projetos com estudo de caso completo (papel, período, contexto, desafio, solução, resultados verificáveis, tecnologias, galeria, links), reaproveitando revisões e publicação, mais as páginas públicas editoriais.

**Pré-requisitos:** F06 concluída. Conteúdo real de pelo menos 1 projeto (Q-04), ou um `[PLACEHOLDER]` marcado.

**Leitura obrigatória:** [data-model §4.5](../architecture/data-model.md), [ADR-0006](../architecture/adr/0006-conteudo-e-editor.md), [design-direction](../design/design-direction.md), skill `/cms-engineer`.

**Gate de saída:** um estudo de caso criado, revisado, publicado e exibido de ponta a ponta, com Lighthouse dentro da política na R4 e na R5.

---

### F07-T1 — Admin de projetos (reaproveitando revisões e publicação)

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F06 (gate) | RF-09.1, RF-09.2, RF-05.4 | `/cms-engineer`, `/architecture-guardian` |

**Objetivo.** Criar a API e as telas de projetos com os campos do data-model:
- `summary`, `role`, período, `repo_url`, `demo_url`, capa, galeria, tecnologias (tags `technology` com CRUD), `highlights` verificáveis, ordenação e destaque;
- o template do corpo, com as seções Contexto, Desafio, Solução e Resultados.

Os serviços de revisão e publicação da F06 são reaproveitados de forma genérica.

**Arquivos prováveis.** `server/api/admin/projects/**`, `server/services/content/projects.service.ts`, `app/pages/admin/projetos/{index,[id]}.vue`, `app/components/admin/projects/*.vue`.

**Fora do escopo.** Filtros públicos (T2).

**Critérios de aceite**
- [x] A generalização dos serviços da F06 não muda o comportamento dos artigos (todos os testes da F06 continuam verdes).
- [x] `repo_url` e `demo_url` só com `https:`; `highlights` exige rótulo e valor, e a interface avisa: "use apenas resultados verificáveis".
- [x] A ordenação manual persiste; o destaque na home é configurável.
- [x] Permissões e auditoria aplicadas.

**Testes**
- Workers e API: CRUD, publicação e restauração de projeto.
- Toda a suíte da F06 é reexecutada (regressão).

**Resultado (30/10/2026).**
- **Generalização (etapa 1, sem mudar os artigos):** `server/services/content/working-copy.{ts,repo.ts}` (salvar com versão, versões nomeadas, restaurar, slug livre, checagem de mídia) e um `PublishModel` por tipo em `publishing.service.ts` (entidade do snapshot, imagens que exigem alt, colunas `published_*`, relações publicadas, caminho público, purge, auditoria); `articles.service.ts` virou um invólucro fino. A suíte da F06 rodou verde antes de qualquer código de projeto e de novo no fim.
- **Projetos:** `server/services/content/projects.{service,repo}.ts`, rotas em `server/api/admin/projects/**` (CRUD, revisões, restauração, publicar, despublicar e `PUT /order`), `shared/content/project-input.ts` (limites, `https:` só, highlights com rótulo e valor, período `YYYY-MM` com fim ≥ início, modelo do corpo com Contexto, Desafio, Solução e Resultados). Publicar refaz `project_technologies` na ordem escolhida e exige alt também na galeria; um slug publicado que muda deixa 301 do caminho traduzido (`/projetos`, `/en/projects`…).
- **Tecnologias:** o CRUD de tags passou a aceitar `kind` (`topic` por padrão, `technology`); o uso de uma tag conta artigos e projetos; temas e tecnologias compartilham os endereços.
- **Admin:** `/admin/projetos` (ordem manual com "Subir"/"Descer" e destaque), `/admin/projetos/[id]` (o editor dos artigos com os campos do estudo de caso e o aviso "use apenas resultados verificáveis") e `/admin/tecnologias`; `PublishPanel`, `HistoryPanel`, `ConflictDialog` e `RevisionDiff` receberam o tipo.
- **Decisões:** generalização por descritor (1); sem agendamento nem link de preview para projetos, que chegam com a F07-T2 se preciso (2); ordem por botões, salva para a lista inteira num `db.batch` e exigindo `project:publish` (3); destaque por flag, quantos aparecem na home fica para a F08 (4); até 6 highlights, rótulo ≤ 60, valor ≤ 40, nota ≤ 200 (5).
- **Orçamento:** os registros de rota das telas do admin vão no JS de toda rota pública (14 rotas = 0,68 kB gz) e levaram o R3 a 120,07 kB; o owner subiu o limite do R3/R8 para 121 KB, e a F11-T6 tira essas rotas do JS público.
- **Testes:** `tests/workers/projects.test.ts`, `tests/api/projects.spec.ts`, `tests/e2e/projects.spec.ts`, as telas novas em `tests/a11y/admin.spec.ts`; `tests/api/articles.spec.ts` passou a esperar o `kind` válido.

---

### F07-T2 — Páginas públicas de projetos

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F07-T1 | RF-01.3, RF-09.3, RF-09.4, RX-01 | `/frontend-design`, `/i18n-manager`, `/performance-audit` |

**Objetivo.** Criar:
- `/projetos`: grade editorial e filtro por tecnologia (SSR via query, com ilha mínima, se necessário);
- `/projetos/[slug]`: estudo de caso com cabeçalho, metadados (papel, período, stack), highlights, narrativa, galeria e links para GitHub e demo, mais projetos relacionados por tecnologia (_could_).

**Arquivos prováveis.** `app/pages/projetos/{index,[slug]}.vue`, `app/components/projects/*.vue`, `server/api/public/projects/**`.

**Fora do escopo.** Transições cinematográficas (F10-T4) e JSON-LD completo (F11-T1).

**Critérios de aceite**
- [x] Layout editorial aprovado por você (prints em 390, 1280 e 1920 px; aprovado em 30/10/2026) (prints em 390, 1280 e 1920 px no relatório).
- [x] Filtro por tecnologia acessível (estado anunciado; funciona sem JS via query).
- [x] Alternates, cache tags e ausência de `Set-Cookie` como no blog.
- [x] Lighthouse dentro da política na R4 e na R5.

**Testes**
- E2E: lista → filtro → estudo de caso → link externo com `rel` correto.
- a11y: axe nas duas páginas.
- `/performance-audit` na R4 e na R5.

**Resultado (30/10/2026).**
- **Leitura pública:** `server/services/content/projects-public.{repo,service}.ts` leem só `published_snapshot`, as colunas `published_*` e `project_technologies`; rotas `server/api/public/projects/{index,[slug]}.get.ts` com cache de borda e as tags do ADR-0003; lista na ordem manual, filtro `?tech=<slug>` (desconhecido ou vazio → 404), relacionados por tecnologia em comum (até 3). O sitemap lista o índice de projetos e os projetos publicados.
- **Páginas:** `/projetos` (o primeiro projeto em destaque na largura do container, depois 2 colunas; a lista filtrada é `noindex` e o canonical aponta para a lista inteira) e `/projetos/[slug]` (título e resumo em 8 colunas, a ficha com papel, período via `Intl.formatRange`, tecnologias e links em 4; resultados em números grandes; narrativa e galeria na medida de leitura; relacionados). O estudo de caso é `CaseStudy` com `hydrate-never`, e a página traz o `content.css`.
- **Decisões:** nomes de tecnologia em pt-BR em todos os idiomas, por serem nomes próprios (1); `?tech=` igual nos idiomas (2); galeria do renderer, com o diálogo de ampliação (3); links externos na mesma aba com `rel="noopener noreferrer"` e "(site externo)" para leitores de tela (4); relacionados incluídos (5); layout como acima (6).
- **CLS:** o filtro usa colunas de largura fixa, porque botões em linha quebravam em outro ponto quando a fonte web chegava e empurravam a lista inteira (R4 mobile: CLS 0,135 → 0,024, nota 92 → 97).
- **Testes:** `tests/workers/projects-public.test.ts`, `tests/api/projects-public.spec.ts`, `tests/e2e/projects-public.spec.ts`, `tests/a11y/projects.spec.ts`; a fixture de teste ganhou o projeto `x` nos 5 idiomas, e as specs que tratavam projetos como esqueleto foram atualizadas.
- **Gate da F07:** estudo de caso criado, revisado, publicado e exibido de ponta a ponta (E2E), Lighthouse dentro da política na R4 e na R5, e layout aprovado pelo owner em 30/10/2026.

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
