# Checklist por componente

## API
- [ ] Props tipadas (TS), com valores padrão sensatos; eventos com nomes claros; slots para o conteúdo variável.
- [ ] Nenhum texto fixo: tudo vem por prop, slot ou chave de i18n do chamador.
- [ ] Variantes limitadas e nomeadas (`variant: 'primary' | 'ghost'`), sem flags booleanas que se combinam.

## Estilo
- [ ] Só tokens; nada de cor, espaço ou tamanho literal.
- [ ] Estados `hover`, `focus-visible`, `active`, `disabled` e `aria-current`/`aria-pressed` quando aplicável.
- [ ] Temas claro e escuro conferidos.
- [ ] Container queries se o componente aparece em larguras diferentes.

## Acessibilidade
- [ ] Elemento nativo correto (`button`, `a`, `input`, `nav`, `dialog`…).
- [ ] Nome acessível (texto visível, `aria-label` ou `aria-labelledby`); ícone decorativo com `aria-hidden="true"`.
- [ ] Teclado: Tab, Shift+Tab, Enter/Espaço, Esc quando abre algo; ordem lógica.
- [ ] Foco visível e não obscurecido; alvo ≥ 24×24 px.
- [ ] Componentes compostos seguem o WAI-ARIA APG (menu = disclosure ou dialog; tabs; combobox no admin).
- [ ] Movimento só via tokens e respeitando `prefers-reduced-motion`.

## Performance
- [ ] Sem hidratação se for estático; ilha mínima se interativo.
- [ ] Sem dependência nova (ou checklist do `/architecture-guardian`).
- [ ] Imagens com dimensões; nada que cause CLS.

## Testes
- [ ] Teste de componente (Nuxt) cobrindo render, ARIA e interação por teclado.
- [ ] Presente na styleguide de dev, com as variantes.
- [ ] axe sem violações no template que o usa.
