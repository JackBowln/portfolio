# Checklist de admissão de dependência

Aplique a **cada** pacote novo e a cada atualização de major. Inclua a tabela preenchida no relatório da tarefa.

## Coleta (comandos)

```bash
npm view <pkg> version license repository.url time.modified engines peerDependencies dependencies dist.unpackedSize
npm view <pkg> dist-tags
pnpm why <pkg>            # depois de instalar: quem traz e quais versões
```

Depois do build: confirme em qual bundle ele caiu (público, admin ou servidor) e o tamanho gzip (manifest e `check:budgets`).

## Critérios

| Critério | Pergunta | Reprovado se… |
|---|---|---|
| Necessidade | Resolve um requisito da tarefa? Já existe algo no projeto, na plataforma (Web APIs, Workers) ou na stack? | Existe alternativa nativa ou já instalada que basta |
| Destino | Público, admin, servidor ou dev? | Cai no bundle público sem necessidade |
| Tamanho | Quanto adiciona (gzip) ao destino? | Estoura o orçamento ([performance-budgets](../../../../docs/quality/performance-budgets.md)) |
| Licença | MIT, Apache-2.0, BSD-2/3, ISC, 0BSD (código) ou OFL (fontes)? | Copyleft forte (GPL/AGPL) ou licença desconhecida. Exceções precisam de ADR (ex.: GSAP "no-charge") |
| Manutenção | Release nos últimos 12 meses? Issues críticas abertas? | Abandonado ou com vulnerabilidade sem correção |
| Compatibilidade | Roda no workerd (sem `fs`, `child_process` nem addons nativos; ok com `nodejs_compat`)? Peer deps batem com as versões fixadas? | Depende de Node-only no runtime ou exige versões fora da stack |
| Segurança | `pnpm audit` limpo? Precisa de script de instalação (`onlyBuiltDependencies`)? | Vulnerabilidade alta ou script de instalação injustificado |
| Custo | É serviço externo ou SDK de um serviço pago? | Sim e sem ADR + aprovação |
| Reversibilidade | Fica isolado atrás de um módulo nosso (fácil de trocar)? | Espalhado pelo código sem adaptador |

## Tabela para o relatório

| Pacote | Versão | Destino | gzip | Licença | Último release | Workers ok | Alternativa avaliada | ADR |
|---|---|---|---|---|---|---|---|---|
| … | … | admin | 12 KB | MIT | 2026-09 | sim | nativo X (insuficiente porque…) | não exigido / ADR-00NN |

## Pré-aprovados pelos ADRs (ainda conferir versão e peer deps)

`nuxt`, `vue`, `@nuxtjs/i18n`, `tailwindcss` + `@tailwindcss/vite`, `@nuxt/fonts`, `drizzle-orm`, `drizzle-kit`, `better-auth`, `@better-auth/passkey`, `zod`, `@tiptap/*` (só MIT), `shiki` (admin), `gsap`, `three` (condicional), `wrangler`, `vitest`, `@nuxt/test-utils`, `@cloudflare/vitest-pool-workers`, `@playwright/test`, `@axe-core/playwright`, `eslint`, `@nuxt/eslint`.

Candidatos que ainda dependem de avaliação na tarefa: `@jsquash/*`, `thumbhash` (F04-T2), `@nuxtjs/sitemap` (F02-T3) e a ferramenta de Lighthouse (F00-T7).
