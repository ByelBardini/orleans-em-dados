# Dashboard — Armadilhas

- `Intl` do `pt-BR` separa `R$` do número com espaço não separável (`U+00A0`): esperado de teste usa o caractere certo.
- `nomeProprio` transforma 'S.A.' em 'S.a.': a lista de siglas tem o ponto, e a comparação o tira antes. Registrado com `it.fails` em `format.spec.ts`; corrigir muda a tela.
- A resposta gravada da paridade é parcial (o TCE-SC vai até fevereiro): quem usa essa fixture vê "até fevereiro de 2025", e não o ano inteiro.
- `useApi` recebe o schema uma vez: ele é constante do módulo de contratos e não entra nas dependências do efeito.
