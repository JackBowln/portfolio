# Portfólio + blog

Portfólio profissional e blog pessoal full-stack, com CMS próprio, em **Nuxt 4** na **Cloudflare** (Workers, D1, R2 e Workers AI). O conteúdo original é escrito em pt-BR e traduzido para en, es, de e fr com assistência de IA e revisão humana.

> **Estado:** fase **F00** do [roadmap](docs/roadmap/README.md) em andamento. O esqueleto Nuxt 4.6 já existe (F00-T1), mas ainda não há funcionalidades.

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
