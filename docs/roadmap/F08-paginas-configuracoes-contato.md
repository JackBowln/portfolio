# F08 — Páginas institucionais, configurações globais e contato

**Objetivo da fase:** as configurações globais editáveis por idioma, as páginas institucionais (home, sobre, contato, privacidade e os índices) editáveis por blocos, e o formulário de contato seguro com notificação.

**Pré-requisitos:** F06 concluída. Pode rodar em paralelo com a F07. E-mail de contato verificado no Email Routing (Q-05) para a F08-T3.

**Leitura obrigatória:** [data-model §4.6 e §6](../architecture/data-model.md), [ADR-0012](../architecture/adr/0012-seguranca.md), [security-model §6](../architecture/security-model.md#6-privacidade), [i18n-seo §3](../architecture/i18n-seo.md#3-política-de-conteúdo-não-traduzido).

**Gate de saída:** configurações refletidas no layout com purge, as páginas institucionais publicadas em pt-BR com a regra de fallback nos outros idiomas, e o contato entregando a notificação com rate limit e Turnstile comprovados.

---

### F08-T1 — Configurações globais por idioma

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F06 (gate) | RF-08.1, RF-08.2, RF-08.3, RF-08.4, RF-08.5, RF-08.6 | `/cms-engineer`, `/security-audit` |

**Objetivo.** Criar:
- um schema zod por chave de `site_settings` (identity, social, contact, seo_defaults, navigation, footer, ai_translation, features), com as partes localizadas;
- os formulários no admin, com versão e auditoria;
- o purge da tag `settings`;
- o uso no layout (identidade, redes, navegação, rodapé) e no `usePageSeo` (modelo de título, OG padrão).

Mudar `ai_translation` exige sessão fresca.

**Arquivos prováveis.** `shared/settings/*.ts`, `server/api/admin/settings/**`, `server/services/settings/*.ts`, `app/pages/admin/configuracoes/*.vue`, `app/composables/useSiteSettings.ts`.

**Fora do escopo.** A lógica de tradução que consome `ai_translation` (F09).

**Critérios de aceite**
- [ ] Salvar configurações purga `settings` e a página pública reflete a mudança em ≤ 60 s (no preview, quando houver).
- [ ] `settings:update` só para `owner` e `admin`; alterar `ai_translation` exige sessão fresca (testado).
- [ ] Os padrões de `ai_translation` são seguros: `dailyNeuronCap` 8000, `monthlyBudgetMicroUsd` 0 e `provider` fixo em `workers-ai`.

**Testes**
- Unit: schemas por chave.
- API: permissões, sessão fresca e validação.
- E2E: mudar o rodapé → o público atualiza.

---

### F08-T2 — Páginas institucionais editáveis por blocos

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F08-T1 | RF-01.1, RF-01.2, RF-01.7, RF-10.4 | `/cms-engineer`, `/frontend-design`, `/i18n-manager` |

**Objetivo.** Criar os schemas de blocos por `PageKey` (data-model §4.6), os editores de blocos no admin e a publicação pelos serviços compartilhados. As páginas públicas (home sem motion por enquanto, sobre, contato, privacidade e os índices) passam a consumir esse conteúdo, com a regra de fallback para páginas institucionais não traduzidas: original + aviso + `noindex` + fora do sitemap e do hreflang.

**Arquivos prováveis.** `shared/pages/*.ts`, `server/api/admin/pages/**`, `app/pages/admin/paginas/*.vue`, `app/pages/{index,sobre,contato,privacidade}.vue`, `app/components/pages/**`.

**Fora do escopo.** Motion da home (F10); o texto jurídico da privacidade (escrito por você; o Claude Code propõe só a estrutura).

**Critérios de aceite**
- [ ] Cada página renderiza só conteúdo publicado; sem conteúdo publicado → estado vazio elegante (sem lorem ipsum).
- [ ] Fallback institucional: em `/de/ueber-mich` sem tradução aprovada → conteúdo pt-BR com aviso localizado, `noindex`, sem hreflang `de` e fora do sitemap `de`.
- [ ] A página de privacidade lista os dados tratados conforme o security-model §6.

**Testes**
- E2E: editar o hero da home → publicar → o público atualiza; fallback em `de`.
- API: `noindex` no fallback.

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
