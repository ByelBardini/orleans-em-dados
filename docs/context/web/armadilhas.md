# Dashboard — Armadilhas

- `Intl` do `pt-BR` separa `R$` do número com espaço não separável (`U+00A0`): esperado de teste usa o caractere certo.
- `nomeProprio` transforma 'S.A.' em 'S.a.': a lista de siglas tem o ponto, e a comparação o tira antes. Registrado com `it.fails` em `format.spec.ts`; corrigir muda a tela.
- A resposta gravada da paridade é parcial (o TCE-SC vai até fevereiro): quem usa essa fixture vê "até fevereiro de 2025", e não o ano inteiro.
- `useApi` recebe o schema uma vez: ele é constante do módulo de contratos e não entra nas dependências do efeito.
- O nome acessível do selo em símbolo é `título. motivo` (`aria-label` de `SeloEmSimbolo`): com motivo, regex que termina no título (`/… em 2024$/`) não casa. O teste usa o nome inteiro ou não ancora o fim.
- No jsdom, o conteúdo de um `<details>` fechado segue acessível ao `getByRole`: teste de "recolhido" confere o atributo `open`, nunca a ausência do conteúdo.
- O Testing Library não tem `asyncUtilTimeout` próprio (`test/setup.ts`): `findBy*` espera 1 s e pode estourar na suíte inteira, em paralelo, e passar sozinho (`paginas.spec.tsx`, "dado atrasado"). Antes de chamar de regressão, rode o spec isolado.
