# Documentação do projeto

Portfólio profissional + blog pessoal com CMS próprio (Nuxt 4 · Cloudflare Workers · D1 · R2). Comece pelo [PRD](product/PRD.md); para implementar, siga o [roadmap](roadmap/README.md).

## Índice

| Área | Documento | Para quê |
|---|---|---|
| Produto | [PRD](product/PRD.md) | Visão, requisitos (RF, RX, RNF), rotas, jornadas, insumos pendentes |
| Pesquisa | [Compatibilidade da stack (25/10/2026)](research/2026-10-25-compatibilidade.md) | Versões, limites da Cloudflare, achados e spikes pendentes |
| Arquitetura | [Visão geral](architecture/overview.md) | Diagramas C4, estrutura de pastas, renderização por rota, fluxos, bindings |
| | [Modelo de dados](architecture/data-model.md) | Tabelas, índices, máquinas de estado, invariantes |
| | [Modelo de segurança](architecture/security-model.md) | Ativos, superfícies, ameaças, matriz de autorização |
| | [i18n e SEO](architecture/i18n-seo.md) | Idiomas, rotas traduzidas, head, JSON-LD, sitemap |
| | [ADRs](architecture/adr/README.md) | 14 decisões registradas |
| Design | [Direção visual](design/design-direction.md) | Proposta para aprovação na F01-T1 |
| | [Princípios de motion](design/motion-principles.md) | Tokens, padrões, template de storyboard, QA |
| Qualidade | [Definition of Done](quality/definition-of-done.md) | Critérios por tarefa e modelo de relatório |
| | [Estratégia de testes](quality/test-strategy.md) | Camadas, casos obrigatórios, mocks |
| | [Orçamentos de performance](quality/performance-budgets.md) | Protocolo Lighthouse, tolerância, orçamentos |
| | [Acessibilidade](quality/accessibility.md) | WCAG 2.2 AA: automatizado + manual |
| Operação | [Ambientes](operations/environments.md) | Ambientes, bindings, segredos por nome |
| | [Backup e restore](operations/backup-restore.md) | Backups, restore, rollback, recuperação de acesso |
| Roadmap | [Roadmap e prompts](roadmap/README.md) | 13 fases e 59 tarefas, com o prompt de cada fase |

Instruções permanentes para o Claude Code: [CLAUDE.md](../CLAUDE.md). Skills do projeto: [.claude/skills/](../.claude/skills/).

## Rastreabilidade

Requisito do [PRD](product/PRD.md) → tarefas do [roadmap](roadmap/README.md) que o implementam ou verificam.

| Requisito | Tarefas |
|---|---|
| RF-01 Site público | F01-T5, F06-T5, F07-T2, F08-T2, F08-T3, F10-T3, F11-T3, F12-T1 |
| RF-02 Admin protegido | F03-T1, F03-T5 |
| RF-03 Usuários e permissões | F03-T1, F03-T2, F03-T3, F03-T5 |
| RF-04 Editor visual | F05-T2, F05-T3, F05-T4, F05-T5, F06-T1, F06-T2 |
| RF-05 Rascunho, agendamento, preview, versões | F05-T1, F06-T2, F06-T3, F06-T4, F07-T1, F12-T1 |
| RF-06 Mídia | F04-T1, F04-T2, F04-T3, F04-T4 |
| RF-07 SEO por página | F06-T1, F06-T4, F11-T2 |
| RF-08 Configurações globais | F02-T1, F08-T1 |
| RF-09 Projetos e estudos de caso | F05-T1, F07-T1, F07-T2 |
| RF-10 Idiomas | F02-T2, F05-T1, F08-T2, F09-T1 |
| RF-11 Tradução assistida por IA | F09-T1, F09-T2, F09-T3, F09-T4, F12-T1 |
| RF-12 SEO técnico multilíngue | F02-T2, F02-T3, F06-T5, F11-T1, F11-T2, F11-T3, F12-T5 |
| RX-01 Design editorial premium | F01-T1, F01-T2, F01-T3, F01-T4, F01-T5, F07-T2 |
| RX-02 Home cinematográfica | F10-T1, F10-T3, F10-T4 |
| RX-03 SVG/3D só com valor | F10-T1, F10-T5 |
| RX-04 Leitura do blog | F05-T4, F06-T5 |
| RX-05 Motion responsivo e reduzido | F10-T1, F10-T2, F10-T3, F10-T4 |
| RNF-01 Lighthouse 100 | F00-T6, F00-T7, F01-T3, F04-T3, F10-T2, F11-T5, F12-T5 |
| RNF-02 Core Web Vitals | F11-T5 |
| RNF-03 JS mínimo | F00-T7, F01-T3, F04-T3, F05-T4, F10-T2, F11-T5 |
| RNF-04 HTML renderizado | F02-T3, F12-T1 |
| RNF-05 Cache e invalidação | F00-T6, F02-T4, F06-T4, F11-T4 |
| RNF-06 Segurança server-side | F02-T4, F03-T3, F12-T3 |
| RNF-07 Auth, CSRF/XSS, rate limit, uploads | F03-T1, F03-T4, F04-T1, F05-T2, F05-T5, F08-T3, F12-T3 |
| RNF-08 Custo | F00-T3, F00-T6, F04-T2, F09-T3, F12-T4 |
| RNF-09 Código modular, tipado, testável | F00-T1, F00-T2, F00-T3, F00-T4, F00-T5, F02-T1, F02-T4 |
| RNF-10 Acessibilidade | F00-T4, F01-T1, F01-T2, F01-T4, F01-T5, F12-T2 |
| RNF-11 Mobile | F01-T1, F01-T4, F01-T5, F11-T5 |
| RNF-12 Privacidade | F03-T4, F05-T5, F08-T3, F12-T3, F12-T5 |
| RNF-13 Operação | F00-T5, F12-T4 |

## Convenções de documentação

- Docs e skills em pt-BR; código, identificadores, testes e commits em inglês.
- Decisões novas → ADR ([ADR-0001](architecture/adr/0001-registro-de-decisoes.md)).
- Ao concluir uma tarefa, atualize o status no arquivo da fase e os documentos afetados.
