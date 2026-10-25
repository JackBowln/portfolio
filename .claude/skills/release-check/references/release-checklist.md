# Checklist de release

## 1. Código e CI
- [ ] CI verde no commit candidato: typecheck, lint, test, build, api, e2e, a11y e `pnpm audit`.
- [ ] Suíte completa recente (e2e + a11y + visual) verde, sem testes `fixme` sem issue.
- [ ] Versões fixadas respeitadas (TS ~6.0, Vitest ~4.1, Nuxt ~4.6…); nenhuma major sem ADR.
- [ ] Nenhuma tarefa "em andamento" com código parcial no candidato.

## 2. Dados e migrações
- [ ] Migrações novas listadas, com revisão de expand/contract (o código antigo funciona com o schema novo).
- [ ] Aplicadas e testadas no preview antes de ir para a produção.
- [ ] Plano inclui registrar o bookmark do Time Travel antes de migrar a produção.
- [ ] Tamanho do D1 < 300 MB (alerta do data-model §11).

## 3. Configuração do ambiente
- [ ] Bindings do `wrangler.jsonc` corretos para o ambiente (DB, MEDIA, BACKUPS, AI, RL_*, CONTACT_EMAIL, cache, observability, crons).
- [ ] Segredos presentes **por nome** (`wrangler secret list`): BETTER_AUTH_SECRET, GITHUB_CLIENT_ID/SECRET, OWNER_GITHUB_ID, PREVIEW_TOKEN_SECRET, IP_HASH_SALT, TURNSTILE_SECRET_KEY.
- [ ] `BOOTSTRAP_TOKEN` **ausente** se o owner já existe no ambiente.
- [ ] `ENVIRONMENT`, `SITE_URL` e `MEDIA_BASE_URL` corretos; OAuth App do GitHub com o callback do ambiente.
- [ ] O build não contém o login de teste (`TEST_AUTH`).

## 4. SEO e indexação
- [ ] Produção: `robots.txt` correto e sitemap acessível; preview: `noindex` em tudo.
- [ ] Crawl de SEO verde (canonical, hreflang recíproco, 200 em todas as URLs do sitemap).
- [ ] Redirects de slugs alterados funcionando.

## 5. Qualidade medida
- [ ] Lighthouse das rotas R1–R8 (mobile e desktop) dentro da política, com relatórios anexados e `perf-log.md` atualizado.
- [ ] axe sem violações sérias ou críticas; passada manual com VoiceOver registrada (lançamento).
- [ ] `/security-audit` recente sem achados altos ou críticos abertos.

## 6. Conteúdo
- [ ] Nenhum `[PLACEHOLDER]`, lorem ipsum ou dado de seed no conteúdo publicado.
- [ ] Nenhuma métrica, cliente ou depoimento sem fonte verificável.
- [ ] Traduções publicadas todas `approved`; páginas institucionais sem tradução em fallback com `noindex`.
- [ ] Página de privacidade revisada pelo owner.

## 7. Operação
- [ ] Último export semanal do D1 presente no `BACKUPS` e restore ensaiado nos últimos 90 dias.
- [ ] Rollback de versão ensaiado no preview.
- [ ] Workers Logs habilitado; `/api/health` responde.
- [ ] Uso do mês (requisições, CPU, D1, R2, neurons) bem abaixo dos limites do Free.
- [ ] Plano de deploy passo a passo pronto para o owner executar ou autorizar.

## 8. Somente para produção
- [ ] Domínio na Cloudflare, com DNS e TLS ativos (ação do owner).
- [ ] Domínio de mídia ligado ao bucket, com Cache Rules.
- [ ] Owner criado em produção, passkey registrada e `BOOTSTRAP_TOKEN` removido.
- [ ] Search Console: envio do sitemap planejado (ação do owner).
- [ ] Checklist de 30 dias criado (CWV de campo, custos, backups, dependências).
