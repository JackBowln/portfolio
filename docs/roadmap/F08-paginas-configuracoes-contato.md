# F08 — Páginas institucionais, configurações globais e contato

**Objetivo da fase:** as configurações globais editáveis por idioma, as páginas institucionais (home, sobre, contato, privacidade e os índices) editáveis por blocos, e o formulário de contato seguro com notificação.

**Pré-requisitos:** F06 concluída. Pode rodar em paralelo com a F07. E-mail de contato verificado no Email Routing (Q-05) para a F08-T3.

**Leitura obrigatória:** [data-model §4.6 e §6](../architecture/data-model.md), [ADR-0012](../architecture/adr/0012-seguranca.md), [security-model §6](../architecture/security-model.md#6-privacidade), [i18n-seo §3](../architecture/i18n-seo.md#3-política-de-conteúdo-não-traduzido).

**Gate de saída:** configurações refletidas no layout com purge, as páginas institucionais publicadas em pt-BR com a regra de fallback nos outros idiomas, e o contato entregando a notificação com rate limit e Turnstile comprovados.

---

### F08-T1 — Configurações globais por idioma

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F06 (gate) | RF-08.1, RF-08.2, RF-08.3, RF-08.4, RF-08.5, RF-08.6 | `/cms-engineer`, `/security-audit` |

**Objetivo.** Criar:
- um schema zod por chave de `site_settings` (identity, social, contact, seo_defaults, navigation, footer, ai_translation, features), com as partes localizadas;
- os formulários no admin, com versão e auditoria;
- o purge da tag `settings`;
- o uso no layout (identidade, redes, navegação, rodapé) e no `usePageSeo` (modelo de título, OG padrão).

Mudar `ai_translation` exige sessão fresca.

**Arquivos prováveis.** `shared/settings/*.ts`, `server/api/admin/settings/**`, `server/services/settings/*.ts`, `app/pages/admin/configuracoes/*.vue`, `app/composables/useSiteSettings.ts`.

**Fora do escopo.** A lógica de tradução que consome `ai_translation` (F09).

**Critérios de aceite**
- [x] Salvar configurações purga `settings` e a página pública reflete a mudança em ≤ 60 s (local: na próxima requisição; no preview, a medir no primeiro deploy).
- [x] `settings:update` só para `owner` e `admin`; alterar `ai_translation` exige sessão fresca (testado).
- [x] Os padrões de `ai_translation` são seguros: `dailyNeuronCap` 8000, `monthlyBudgetMicroUsd` 0 e `provider` fixo em `workers-ai`.

**Testes**
- Unit: schemas por chave.
- API: permissões, sessão fresca e validação.
- E2E: mudar o rodapé → o público atualiza.

**Resultado (30/10/2026).**
- **Schemas:** `shared/settings/schemas.ts` (parte global, parte por idioma, padrões e se a chave é pública, para as 8 chaves), `shared/settings/input.ts` (corpo estrito do salvamento) e `shared/settings/public.ts` (o que o site lê, e os padrões sem zod para o JS público).
- **Servidor:** `server/services/settings/settings.{repo,service}.ts`; `GET /api/admin/settings` (`settings:read`), `PUT /api/admin/settings/[key]` (`settings:update`, versão lida com 409, `requireFreshSession` em `ai_translation`, auditoria `settings.updated` só com chave, versão e idiomas, purge `settings`) e `GET /api/public/settings` (chaves públicas resolvidas: idioma, depois pt-BR, depois o padrão; nunca `ai_translation`).
- **Site:** o `SiteShell` carrega as configurações do idioma no SSR (e de novo ao trocar de idioma no navegador); cabeçalho, navegação (ordem e páginas visíveis), rodapé (texto, redes, e-mail público), `usePageSeo` (modelo de título, `og:site_name`, imagem OG padrão já resolvida no servidor), home e RSS (`features.rss`) as leem. As páginas somam a tag `settings` às suas; respostas privadas não levam tags. As chaves `seo.*` da i18n saíram.
- **Admin:** `/admin/configuracoes`, uma seção por chave com versão própria e, nas partes traduzíveis, um seletor de idioma (sem texto próprio, o idioma usa o pt-BR).
- **Orçamento:** as configurações no layout somam ~1,37 kB a toda rota; mesmo com a F11-T6 adiantada (−0,79 kB), R3/R8 ficaram em 120,88, e o owner subiu o limite deles para 121 KB (performance-budgets §4).
- **Testes:** `tests/unit/settings.test.ts`, `tests/workers/settings-service.test.ts`, `tests/api/settings.spec.ts`, `tests/e2e/settings.spec.ts` e a tela nova em `tests/a11y/admin.spec.ts`.

---

### F08-T2 — Páginas institucionais editáveis por blocos

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F08-T1 | RF-01.1, RF-01.2, RF-01.7, RF-10.4 | `/cms-engineer`, `/frontend-design`, `/i18n-manager` |

**Objetivo.** Criar os schemas de blocos por `PageKey` (data-model §4.6), os editores de blocos no admin e a publicação pelos serviços compartilhados. As páginas públicas (home sem motion por enquanto, sobre, contato, privacidade e os índices) passam a consumir esse conteúdo, com a regra de fallback para páginas institucionais não traduzidas: original + aviso + `noindex` + fora do sitemap e do hreflang.

**Arquivos prováveis.** `shared/pages/*.ts`, `server/api/admin/pages/**`, `app/pages/admin/paginas/*.vue`, `app/pages/{index,sobre,contato,privacidade}.vue`, `app/components/pages/**`.

**Fora do escopo.** Motion da home (F10); o texto jurídico da privacidade (escrito por você; o Claude Code propõe só a estrutura).

**Critérios de aceite**
- [x] Cada página renderiza só conteúdo publicado; sem conteúdo publicado → estado vazio elegante (sem lorem ipsum).
- [x] Fallback institucional: em `/de/ueber-mich` sem tradução aprovada → conteúdo pt-BR com aviso localizado, `noindex`, sem hreflang `de` e fora do sitemap `de`.
- [x] A página de privacidade lista os dados tratados conforme o security-model §6.

**Testes**
- E2E: editar o hero da home → publicar → o público atualiza; fallback em `de`.
- API: `noindex` no fallback.

**Resultado (31/10/2026).**
- **Blocos:** `shared/pages/blocks.ts`, um schema estrito por `PageKey` (home: abertura, seções, títulos dos destaques, chamada final; sobre: introdução em documento, trajetória, competências, links `https:`; contato: introdução e mensagem de sucesso; privacidade: texto em documento e data; índices do blog e de projetos: título e introdução). Os botões da home levam a uma página do site, nunca a uma URL livre (decisão 5).
- **Servidor:** `server/services/content/pages.{repo,service}.ts`. A página e a cópia pt-BR são criadas na primeira necessidade; salvar com versão (revisão autosave), versões nomeadas, restaurar, publicar e despublicar em batches protegidos e auditados (`page.*`). Rotas em `server/api/admin/pages/**` e `GET /api/public/pages/[key]`, que devolve o publicado no idioma, senão o pt-BR (`fallback`), senão o estado vazio. Publicar o pt-BR purga a página em todos os idiomas, além do sitemap, que lista cada página só onde está publicada.
- **Site:** home (com os projetos em destaque e os 3 últimos artigos, decisão 2, num componente `hydrate-never`), sobre, contato e privacidade; os índices do blog e de projetos leem título e introdução das páginas. Fallback com aviso localizado, `lang="pt-BR"` no conteúdo, `noindex` e sem hreflang do idioma; estado vazio com o nome da página (decisão 4). A privacidade lista sempre os dados tratados (security-model §6, decisão 1), traduzidos nos 5 idiomas.
- **Admin:** `/admin/paginas` e `/admin/paginas/[key]`, um formulário por página, com autosave, conflito, versões, histórico comparado por bloco (decisão 3) e publicação.
- **Também corrigido:** a lista de projetos do admin passava todos os ids numa só consulta e quebrava com mais de 100 projetos (limite de parâmetros do D1); o helper de lotes foi para `server/db/in-limit.ts`.
- **Testes:** `tests/workers/pages.test.ts`, `tests/api/pages.spec.ts`, `tests/e2e/pages.spec.ts`, `tests/a11y/pages.spec.ts`, as telas novas em `tests/a11y/admin.spec.ts` e `tests/nuxt/app.test.ts`; a fixture de teste publica a home e o sobre só em pt-BR, e as specs que tratavam essas páginas como esqueleto foram atualizadas.

---

### F08-T3 — Contato: formulário, Turnstile, rate limit, armazenamento e notificação

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F08-T2, F03-T4 | RF-01.6, RNF-07, RNF-12 | `/security-audit`, `/frontend-design` |

**Objetivo.** Criar:
- o formulário acessível (nome, e-mail, mensagem, consentimento informativo) com Turnstile só nesta página, `RL_PUBLIC`, zod, honeypot e limites;
- a gravação em `contact_messages` com hash de IP;
- a notificação pelo binding `send_email` para o endereço verificado;
- a caixa de entrada no admin (ler, arquivar, marcar spam, excluir);
- a retenção de 12 meses (cron).

**Arquivos prováveis.** `app/pages/contato.vue`, `app/components/contact/*.vue`, `server/api/public/contact.post.ts`, `server/services/contact/*.ts`, `server/tasks/contact/retention.ts`, `app/pages/admin/mensagens/*.vue`, `server/plugins/csp.ts` (Turnstile só nesta rota).

**Fora do escopo.** Resposta automática por e-mail ao visitante (exigiria envio para destinatários arbitrários, que só existe no Paid).

**Critérios de aceite**
- [ ] Sem Turnstile válido → 400; acima do limite → 429; cross-origin → 403; campos inválidos → 422 com erros acessíveis.
- [ ] O script do Turnstile só carrega na página de contato (CSP e Network conferidas); a página continua utilizável por teclado e leitor de tela.
- [ ] A mensagem é gravada com hash de IP, nunca em claro; a notificação chega ao endereço verificado (teste manual no preview, com sua autorização).
- [ ] A retenção apaga mensagens com mais de 12 meses (relógio falso).

**Testes**
- API: os cenários de erro acima (chaves de teste do Turnstile).
- Workers: retenção.
- E2E e a11y: envio com sucesso e erros anunciados.

---

## Prompt da fase

```text
Fase F08 — Páginas institucionais, configurações e contato. Projeto: ~/Desktop/dev/portfolio.

Leia CLAUDE.md, docs/roadmap/F08-paginas-configuracoes-contato.md, o data-model §4.6 e §6, o security-model §6 e o i18n-seo §3. Pegue a primeira tarefa "pendente" com dependências concluídas.

Antes de editar: apresente objetivo, arquivos, abordagem, dependências novas, testes e riscos. Aguarde minha aprovação.

Regras desta fase:
- Nenhum texto biográfico ou jurídico inventado: use conteúdo meu ou [PLACEHOLDER]; para a privacidade, proponha só a estrutura.
- Turnstile e qualquer script de terceiros só na página de contato.
- Teste de envio real de e-mail apenas no preview e com minha autorização.
- Use /security-audit nas F08-T1 e F08-T3.

Depois de implementar: rode typecheck, lint, test, test:api, e2e e a11y; cole a saída real; atualize o status e os docs; entregue o relatório da Definition of Done. Não faça commit sem eu pedir.
```
