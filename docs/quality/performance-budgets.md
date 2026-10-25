# Orçamentos de performance e protocolo Lighthouse

Metas: **Lighthouse 100 em Performance, Accessibility, Best Practices e SEO** nas rotas-chave, em mobile e desktop, e **Core Web Vitals no p75**: LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1. A nota sintética e os CWV de campo são acompanhados separadamente. A skill `/performance-audit` aplica este documento.

## 1. Rotas-chave

| ID | Rota | Por quê |
|---|---|---|
| R1 | `/` | Home cinematográfica (motion) |
| R2 | `/blog` | Lista |
| R3 | `/blog/{artigo-referência}` | Leitura com código e imagens |
| R4 | `/projetos` | Lista com imagens |
| R5 | `/projetos/{estudo-referência}` | Estudo de caso com galeria |
| R6 | `/sobre` | Perfil |
| R7 | `/contato` | Formulário + Turnstile |
| R8 | `/de/blog/{artigo-referência}` | Variante de idioma |

O artigo e o estudo de referência são definidos na F06/F07 (conteúdo real ou placeholder representativo).

## 2. Protocolo de medição

1. **Build de produção** (`pnpm build`), servido por `wrangler dev` (local) ou pelo deploy de preview (preferível para medir o TTFB real da borda).
2. **Lighthouse 13.x** com versão fixada; Chrome stable, com a versão registrada.
3. **Presets:** mobile padrão do Lighthouse (emulação + throttling simulado) e desktop.
4. **3 execuções por rota e dispositivo**, com a **mediana** registrada; sem extensões, perfil limpo.
5. **Cache:** primeira carga fria (sem cache do navegador); Workers Cache aquecido (1 request antes), salvo quando o objetivo for medir o miss.
6. **Registro** em `docs/quality/perf-log.md` (criado na F00-T7): data, commit, ferramenta e versão, Chrome, rota, dispositivo, as 4 notas, LCP, FCP, TBT, CLS, SI, elemento LCP e observações.
7. **Nunca** declarar nota sem relatório gerado na sessão (HTML ou JSON salvo como artefato).

## 3. Política de tolerância (variação de medição)

| Categoria | Alvo | Bloqueia o merge se a mediana for |
|---|---|---|
| Accessibility | 100 | < 100 |
| Best Practices | 100 | < 100 |
| SEO | 100 | < 100 |
| Performance (desktop) | 100 | < 98 |
| Performance (mobile) | 100 | < 95 |

- Performance abaixo de 100 sem bloquear abre um item de investigação, com o detalhamento do LCP (TTFB, atraso de carregamento, duração do carregamento, atraso de renderização) e a causa.
- **Para o lançamento (F11/F12):** mediana 100 nas quatro categorias em R1, R3 e R5 no desktop, e em todas as rotas, menos Performance mobile. No mobile, toda nota abaixo de 100 precisa de causa documentada e plano.
- A tolerância nunca justifica remover conteúdo, semântica ou controles acessíveis.

## 4. Orçamentos (valores iniciais; revisar com a baseline do F00-T7)

| Recurso | R3 (artigo) | R1 (home) | Demais públicas |
|---|---|---|---|
| JS inicial (gzip, carregado até o `load`) | ≤ 100 KB | ≤ 110 KB | ≤ 110 KB |
| JS adiado de motion (após o LCP) | 0 | ≤ 60 KB | ≤ 60 KB (estudo de caso) |
| CSS (gzip) | ≤ 25 KB | ≤ 30 KB | ≤ 30 KB |
| Fontes na primeira tela | ≤ 2 arquivos, ≤ 120 KB | idem | idem |
| Imagem LCP | ≤ 120 KB mobile / ≤ 200 KB desktop | idem | idem |
| HTML (gzip) | ≤ 60 KB | ≤ 40 KB | ≤ 40 KB |
| Requisições na primeira carga | ≤ 20 | ≤ 25 | ≤ 20 |
| Terceiros | 0 | 0 | Só Turnstile em R7 |

**Métricas de laboratório (mediana, mobile):**
- LCP ≤ 1,8 s;
- TBT ≤ 100 ms;
- CLS ≤ 0,02;
- TTFB: ≤ 200 ms com cache hit e ≤ 600 ms em miss (preview).

`pnpm check:budgets` (F00-T7) lê o manifest do build e falha quando o JS de uma rota ultrapassa a tabela.

## 5. Técnicas obrigatórias

- SSR completo; componentes estáticos sem hidratação; ilhas só onde há interação.
- Fontes self-hosted com fallback métrico e preload só do necessário.
- Imagens via `<ResponsiveImage>` (AVIF/WebP, `srcset`, `sizes`, `width`/`height`); `fetchpriority="high"` só no LCP.
- Motion carregado depois do LCP e nunca no artigo; nenhum script de terceiro no caminho crítico.
- Payload do Nuxt enxuto: nada de enviar o documento inteiro para o cliente quando ele já está renderizado (dados só para as ilhas).
- Sem layout shift: espaço reservado para imagens, embeds (facade com proporção fixa) e fontes.

## 6. Campo (após o lançamento)

- Opção gratuita e sem cookies: Cloudflare Web Analytics (decisão Q-08).
- Revisão mensal dos CWV no p75 por rota; uma regressão vira tarefa.
