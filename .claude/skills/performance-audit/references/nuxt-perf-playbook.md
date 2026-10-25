# Playbook de performance — Nuxt 4 em Workers

| Sintoma | Causas prováveis | Correções |
|---|---|---|
| TTFB alto | Cache-miss (Workers Cache frio), muitas queries, `Set-Cookie` impedindo o cache | Conferir `Cf-Cache-Status`; ≤ 4 queries com `db.batch`; remover cookies da resposta pública; aquecer depois do deploy |
| Atraso de carregamento do LCP alto | Imagem LCP descoberta tarde (CSS ou JS), sem preload | `<ResponsiveImage priority>` (`fetchpriority="high"`, `loading="eager"`); nunca lazy no LCP |
| Duração do carregamento do LCP alta | Imagem grande demais, `sizes` errado, sem AVIF | Conferir as variantes e o `sizes`; LCP ≤ 120 KB no mobile |
| Atraso de renderização do LCP alto | Fonte bloqueando, CSS grande, LCP escondido por animação | `font-display: swap` + fallback métrico; preload de no máximo 2 fontes; **nunca** ocultar o LCP (motion depois do LCP) |
| CLS > 0 | Imagens ou embeds sem dimensão, troca de fonte, banner injetado, skeleton com altura diferente | `width`/`height` sempre; facade com `aspect-ratio`; fallback métrico; reservar espaço |
| TBT/INP altos | Hidratação excessiva, GSAP no caminho crítico, handlers pesados, terceiros | Componentes estáticos sem hidratação (`hydrate-never`/lazy hydration); ilhas mínimas; motion por `import()` no idle; dividir tarefas longas; nenhum terceiro no caminho inicial |
| JS acima do orçamento | Dependência no bundle errado, import estático de lib pesada, payload grande | Manifest/`nuxi analyze`; mover para o admin ou para `import()`; payload só com os dados das ilhas (não o documento inteiro) |
| CSS grande | Utilitários não usados (raro no Tailwind 4), CSS de admin no público | Separar o CSS do admin; conferir os `@source` do Tailwind |
| Best Practices < 100 | Erro no console, imagem com aspecto errado, terceiros com cookies, deprecations | Zerar erros do console; `width`/`height` corretos; embeds com facade e `nocookie` |
| SEO < 100 | Falta `meta description`, hreflang inválido, link sem texto, `robots` bloqueando | `usePageSeo` em toda rota; crawl de SEO; links descritivos |
| A11y < 100 | Contraste, rótulos, ordem de headings, `lang` | `/frontend-design` + axe; `check:contrast` |

## Ferramentas

- `pnpm check:budgets`: orçamento por rota.
- `npx nuxi analyze`: visualização do bundle (só local).
- Chrome DevTools Performance com CPU 4× e rede Fast 4G: long tasks, layout shifts, LCP.
- Aba Coverage: JS e CSS não usados no carregamento.

## Específico deste projeto

- **Artigo (R3):** sem motion, sem Tiptap e sem Shiki; código pré-destacado (HAST) e botão copiar como ilha mínima.
- **Home (R1):** motion só depois do LCP; com movimento reduzido, o GSAP não é baixado; 3D só com poster como LCP.
- **Contato (R7):** Turnstile é o único terceiro e carrega só nesta rota, de preferência quando o formulário fica visível.
