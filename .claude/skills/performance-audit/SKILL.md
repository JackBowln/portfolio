---
name: performance-audit
description: Mede e corrige problemas de Lighthouse 13 (Performance, Accessibility, Best Practices, SEO) e Core Web Vitals (LCP, INP, CLS, TBT) nas rotas públicas deste portfólio Nuxt 4 em Cloudflare, seguindo o protocolo do projeto (build de produção, 3 execuções, mediana) e os orçamentos de JS, CSS, fontes e imagens. Use ao medir uma rota, antes de concluir tarefas de UI ou motion, ao investigar regressões ou ao preparar o lançamento.
when_to_use: "Gatilhos: 'Lighthouse', 'performance', 'lento', 'LCP', 'CLS', 'INP', 'TBT', 'Core Web Vitals', 'bundle', 'tamanho do JS', 'orçamento', 'otimizar', 'nota 100', 'PageSpeed'."
argument-hint: "[rota | R1–R8 | todas]"
---

# Performance Audit

Regra de ouro: **nunca afirmar uma nota sem um relatório gerado nesta sessão**. Protocolo, tolerância e orçamentos em `docs/quality/performance-budgets.md`; comandos em [references/measurement-protocol.md](references/measurement-protocol.md); diagnósticos e correções em [references/nuxt-perf-playbook.md](references/nuxt-perf-playbook.md).

## Procedimento

1. **Escopo:** rota(s) de `$ARGUMENTS` (IDs R1–R8 da tabela de rotas-chave) ou as afetadas pela tarefa.
2. **Build de produção** e servidor (`pnpm build` + `pnpm preview`, ou URL de preview autorizada).
3. **Orçamentos:** `pnpm check:budgets` (JS por rota) e conferência de CSS, fontes, imagem LCP e requisições.
4. **Lighthouse 13:** `pnpm lighthouse` nas rotas × mobile/desktop × 3 execuções → mediana por categoria + LCP, FCP, TBT, CLS, SI e elemento LCP.
5. **Diagnóstico**, para cada desvio:
   - LCP: decomposição em TTFB, atraso de carregamento, duração do carregamento e atraso de renderização;
   - CLS: elementos que se movem;
   - TBT/INP: long tasks e de onde vêm;
   - Best Practices, SEO e A11y: auditorias que falharam.
6. **Correção** pelo playbook, só dentro do escopo da tarefa. Problemas fora dele viram itens no relatório.
7. **Remedição** com o mesmo protocolo e registro no `docs/quality/perf-log.md`.

## Proibido

- Remover conteúdo, semântica, controles acessíveis ou funcionalidade para subir a nota.
- Medir em `nuxt dev` e reportar como resultado.
- Comparar execuções com versões diferentes de Lighthouse ou Chrome sem registrar.

## Saída

```markdown
## Performance — <rotas> — <data> — commit <sha>
Ferramenta: <Unlighthouse|script> · Lighthouse 13.x · Chrome <versão> · <local|preview>
| Rota | Disp. | Perf | A11y | BP | SEO | LCP | TBT | CLS | Elemento LCP |
|---|---|---|---|---|---|---|---|---|---|
**Orçamentos:** JS <x> KB/<limite> · CSS … · fontes … · imagem LCP …
**Dentro da política?** sim/não (performance-budgets §3)
**Causas e correções aplicadas:** …
**Pendências (fora do escopo):** …
Relatórios: reports/lighthouse/<arquivos>
```
