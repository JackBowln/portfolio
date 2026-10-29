# Portfólio + blog

Portfólio profissional e blog pessoal full-stack, com CMS próprio, em **Nuxt 4** na **Cloudflare** (Workers, D1, R2 e Workers AI). O conteúdo original é escrito em pt-BR e traduzido para en, es, de e fr com assistência de IA e revisão humana.

> **Estado:** a fase **F00** do [roadmap](docs/roadmap/README.md) está concluída, com toolchain, lint, testes, CI, Cloudflare e os spikes de CPU/cache e Lighthouse. A F01-T1 também, com a direção visual escolhida, a F01-T2, com os tokens do Tailwind 4 e os temas claro e escuro, a F01-T3, com as fontes self-hosted, a F01-T4, com os componentes base, e a F01-T5, com o layout público e as páginas de erro (a F01 está completa), e a F02 avança com o banco D1 (F02-T1), a infra do servidor (F02-T4), as rotas nos 5 idiomas (F02-T2) e o SEO base (F02-T3), ainda com páginas-esqueleto. A F03 já tem o Better Auth (F03-T1), o RBAC no servidor (F03-T3) o login por passkey e GitHub com bootstrap do owner (F03-T2) o hardening: CSP por hash, checagem de origem, rate limit e hash de IP na auditoria (F03-T4), e o shell do admin, com painel, sessões e auditoria (F03-T5). A F04 começou com o schema e a API de upload de mídia (F04-T1), o pipeline de imagem no navegador do admin (F04-T2) , a entrega com `<ResponsiveImage>` e `<MediaVideo>` (F04-T3) e a biblioteca de mídia no admin (F04-T4): a F04 está completa. A F05 começou com o schema de conteúdo (artigos, projetos, páginas e temas) e os repositórios de localização e revisão (F05-T1), com o schema do documento, a allowlist do HAST e os dados derivados (F05-T2), e com o editor Tiptap no admin, com Shiki no navegador (F05-T3).

## Destaques

- Home cinematográfica (GSAP sob demanda) com leitura do blog simples, rápida e acessível.
- SSR com cache de borda (Workers Cache) e invalidação por tag na publicação.
- CMS: editor Tiptap, rascunhos, revisões, restauração, preview, agendamento e mídia com variantes AVIF/WebP.
- Login sem senha (passkey + GitHub restrito) e RBAC no servidor.
- SEO multilíngue: rotas e slugs traduzidos, hreflang, sitemap, Open Graph e JSON-LD.
- Metas: Lighthouse 100 nas 4 categorias, WCAG 2.2 AA e custo de ~US$ 0 no plano Free.

## Documentação

- [Índice da documentação](docs/README.md): PRD, arquitetura, ADRs, modelo de dados, segurança, i18n/SEO, qualidade e operação.
- [Roadmap e prompts por fase](docs/roadmap/README.md).
- [CLAUDE.md](CLAUDE.md): instruções permanentes para o Claude Code.
- [Skills do projeto](.claude/skills/): `/architecture-guardian`, `/frontend-design`, `/motion-engineer`, `/cms-engineer`, `/i18n-manager`, `/security-audit`, `/performance-audit`, `/test-engineer` e `/release-check`.

## Como trabalhar com o Claude Code

1. Abra o Claude Code na raiz deste repositório.
2. Cole o prompt da fase atual (final de cada `docs/roadmap/Fxx-*.md`), ou use o prompt genérico do [roadmap](docs/roadmap/README.md#4-prompt-genérico-executar-uma-tarefa).
3. Aprove o plano de cada tarefa antes da implementação e revise o relatório no fim.

Commits, deploys e qualquer ação em serviços externos só acontecem com o seu pedido explícito.
