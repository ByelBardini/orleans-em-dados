# Dashboard

Dashboard público em React 19 + Vite 6, em TSX. Vive em `apps/web/src/` (pacote `@orleans-em-dados/web`); o Vite faz proxy de `/api` para `localhost:3000`.

## Estrutura

- `apps/web/src/App.tsx` — abas (`ABAS`) navegadas pelo hash da URL, filtros de ano e entidade, "Atualizado em" do exercício (de `/api/anos`).
- `apps/web/src/paginas/` — cada página recebe `PropsDaPagina` (`props.ts`): `VisaoGeral`, `Receitas`, `Despesas`, `Conferencia`, `Metodologia`.
- `apps/web/src/components.tsx` — componentes compartilhados.
- `apps/web/src/selos.ts` — a regra dos selos, sem DOM. `apps/web/src/selo.tsx` — `Selo`, `useConferencia`, `AvisoDeAtraso`.
- `apps/web/src/styles.css` — visual de "caderno de jornal" com tokens em `:root` (papel, tinta, vermelho, três famílias de fonte), tema claro/escuro por `data-theme`. Referência visual: `docs/screens/`.

## Funções e utilitários

- `getJSON(caminho, schema)`, `useApi(caminho, schema)` (`api.ts`) — busca JSON e valida pelo schema de `packages/contracts`: resposta fora do contrato vira erro na tela, não número errado. Erro do servidor vira a mensagem `erro` do corpo; `useApi(null, …)` não busca. Ao trocar de caminho, mantém os dados anteriores enquanto carrega e descarta resposta antiga.
- `format.ts` — `moeda` (travessão para nulo, sinal preservado), `moedaCompacta`, `numero`, `decimal`, `percentual` (sem casas forçadas), `pct` (casas fixas, padrão 1), `milhoes`/`emMilhoes`/`porExtenso`, `data`/`dataHora`/`dataCurta`, `MESES`, `MESES_LONGOS`, `nomeProprio` (caixa alta da Betha → nome próprio, mantendo siglas).
- `referencias.ts` — `populacao(ano)` (IBGE, ano anterior mais próximo), `ORIGEM_CIDADAO`, `ORIGENS_DE_FORA`, `GLOSSARIO`, `sujeito(entidade)`.
- `seloConferidoComTce(ateMes?)`, `seloConferidoComBetha(dataCorte)`, `SELO_FONTE_UNICA`, `seloAguardando(motivo?)` (`selos.ts`) — o selo do nível da conferência; nenhum usa "validado". Fonte única e aguardando saem sem link.
- `seloReceita`, `seloEmpenhos`, `seloDespesa`, `seloRubrica`, `seloEmpenho`, `seloDeAtraso` (`selos.ts`) — selo `confere` | `diverge` | `pendente` com título e motivo; nulo quando não se aplica.

## Componentes/Módulos

- `Estado`, `Numero`, `Numeros`, `Mi`, `ListaPontos`, `BarrasMensais`, `LinhaAcumulada`, `BarraDividida`, `SeletorTema`, `Alternador`, `Filtros`, `Fonte` (`components.tsx`); `escala(maximo, linhas)` calcula a régua dos gráficos.

## Regras de negócio

- Todo número exibido diz fonte e conferência (`Fonte`, `Selo`); a Câmara aparece à parte, com a abrangência explícita.
- A aba Conferência destaca só o que está em `semExplicacao`. O que tem causa provável ou é recorrente fica em cinza, em "Já conhecidas", e os totais por entidade e mês ficam neutros. O selo tem o estado `explicada` (ícone `i`) para diferença com causa provável.
- No ano em curso, o atraso do TCE-SC é pendência, não divergência; a linguagem dos selos é "provável"/"possível" quando a causa não foi comprovada.

## Testes

- Specs em `apps/web/test/` espelhando `src/`; ambiente `jsdom`, Testing Library e `user-event`, com `test/setup.ts`. `test/support/fetch-fake.ts` — `FetchFake` (segura e libera respostas). `test/support/respostas.ts` — as respostas gravadas da paridade como fixture de tela, o mesmo JSON que a API confere.

## Armadilhas

- `Intl` do `pt-BR` separa `R$` do número com espaço não separável (`U+00A0`): esperado de teste usa o caractere certo.
- `nomeProprio` transforma 'S.A.' em 'S.a.': a lista de siglas tem o ponto, e a comparação o tira antes. Registrado com `it.fails` em `format.spec.ts`; corrigir muda a tela.
- `useApi` recebe o schema uma vez: ele é constante do módulo de contratos e não entra nas dependências do efeito.
