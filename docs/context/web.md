# Dashboard

Dashboard público em React 19 + Vite 6, em TSX. Vive em `apps/web/src/` (pacote `@orleans-em-dados/web`); o Vite faz proxy de `/api` para `localhost:3000`.

## Estrutura

- `apps/web/src/App.tsx` — abas (`ABAS`) navegadas pelo hash da URL, filtros de ano e entidade, "Atualizado em" do exercício (de `/api/anos`).
- `apps/web/src/paginas/` — cada página recebe `PropsDaPagina` (`props.ts`): `VisaoGeral`, `Receitas`, `Despesas`, `Conferencia`, `Metodologia`.
- `apps/web/src/components.tsx` — componentes compartilhados.
- `apps/web/src/selos.ts` — a regra dos selos, sem DOM. `apps/web/src/selo.tsx` — `Selo`, `AvisoDeAtraso`.
- `apps/web/src/conferido.tsx` — o que as páginas dizem sobre a conferência: `ContaDaReceita`, `ContaDaDespesa`, `AvisoDaReceitaAguardando`, `SemConferencia`, `ateOMes`, `LINK_DISCREPANCIAS`.
- `apps/web/src/styles.css` — visual de "caderno de jornal" com tokens em `:root` (papel, tinta, vermelho, três famílias de fonte), tema claro/escuro por `data-theme`. Referência visual: `docs/screens/`.

## Funções e utilitários

- `getJSON(caminho, schema)`, `useApi(caminho, schema)` (`api.ts`) — busca JSON e valida pelo schema de `packages/contracts`: resposta fora do contrato vira erro na tela, não número errado. Erro do servidor vira a mensagem `erro` do corpo; `useApi(null, …)` não busca. Ao trocar de caminho, mantém os dados anteriores enquanto carrega e descarta resposta antiga.
- `format.ts` — `moeda` (travessão para nulo, sinal preservado), `moedaCompacta`, `numero`, `decimal`, `percentual` (sem casas forçadas), `pct` (casas fixas, padrão 1), `milhoes`/`emMilhoes`/`porExtenso`, `data`/`dataHora`/`dataCurta`/`diaEMes`, `MESES`, `MESES_LONGOS`, `nomeProprio` (caixa alta da Betha → nome próprio, mantendo siglas).
- `referencias.ts` — `populacao(ano)` (IBGE, ano anterior mais próximo), `ORIGEM_CIDADAO`, `ORIGENS_DE_FORA`, `GLOSSARIO`, `sujeito(entidade)`.
- `seloConferidoComTce(ateMes?)`, `seloConferidoComBetha(dataCorte)`, `seloDaDespesa(conferencia)`, `SELO_FONTE_UNICA`, `SELO_EXEMPLO`, `seloAguardando(motivo?)`, `seloDeAtraso` (`selos.ts`) — o nível da conferência; nenhum usa "validado". Só o estado `confere` leva o link "Ver discrepâncias", e `semLink` o tira quando a conta já está ao lado.

## Componentes/Módulos

- `Estado`, `Numero`, `Numeros`, `Mi`, `ListaPontos`, `BarrasMensais`, `LinhaAcumulada`, `BarraDividida`, `SeletorTema`, `Alternador`, `Filtros`, `Fonte` (`components.tsx`); `escala(maximo, linhas)` calcula a régua dos gráficos.

## Regras de negócio

- Visão Geral, Receitas e Despesas têm três estados, pelo que a API devolve: conferido; `meta.exemplo` (os números fictícios, com `SELO_EXEMPLO`, sem conta nem selo de conferido); `conferencia.disponivel: false` em coleta real (`SemConferencia`, sem número nenhum, com os filtros).
- O número principal é sempre o conferido. Ao lado, a conta com os valores de `conferencia`: receita, conferido + em discrepância + aguardando = total da Betha, com o que só o TCE-SC registra à parte e a explicação quando o conferido fica abaixo das duas fontes; despesa encerrada, empenhado + em discrepância = total da 57170. A despesa em curso não tem conta: o que aguarda é valor original da Betha, e o conferido é líquido do TCE-SC.
- Ano parcial: a receita diz "até setembro de 2026" no título do indicador, a despesa diz a data do corte, e o aviso de aguardando é pendência, em tom neutro.
- Percentual de realização e "por morador" usam o conferido. O orçamento tem o selo de fonte única e é do ano inteiro: no ano parcial, o texto diz "faltam", e não "faltaram".
- Tabela de rubricas: `nivel` 8 e 14 convivem, e a linha de 8 dígitos diz que está agrupada porque há mês em discrepância.
- Despesas: entidade não conferida fica na tabela "Por entidade" sem número, fora da soma, com aviso e link. A Câmara tem selo de fonte única, fica à parte e não soma com as entidades. A nota separa os empenhos que aguardam o TCE-SC dos que estão em discrepância.
- Situação do empenho na lista: a mesma regra do filtro da API (`sem` é "Sem liquidação"); saldo nulo sai com travessão, sem virar zero.
- `#discrepancias` é alias da aba Conferência até a Fase 11; `#conferencia` continua funcionando.
- A aba Conferência destaca só o que está em `semExplicacao`. O que tem causa provável ou é recorrente fica em cinza, em "Já conhecidas", e os totais por entidade e mês ficam neutros.
- Texto proibido nas páginas de dados: "validado", "irregular", "fraude", "erro", "fantasma". Os specs buscam no container.

## Testes

- Specs em `apps/web/test/` espelhando `src/`; ambiente `jsdom`, Testing Library e `user-event`, com `test/setup.ts`. `test/support/fetch-fake.ts` — `FetchFake` (segura e libera respostas). `test/support/respostas.ts` — as respostas gravadas da paridade como fixture de tela, o mesmo JSON que a API confere. `test/support/conferidos.ts` — respostas com valores à mão para os estados das páginas (`receitas`, `despesas`, `resumoDeEmpenhos`, `api`), `contaNaTela` e `TEXTO_PROIBIDO`.

## Armadilhas

- `Intl` do `pt-BR` separa `R$` do número com espaço não separável (`U+00A0`): esperado de teste usa o caractere certo.
- `nomeProprio` transforma 'S.A.' em 'S.a.': a lista de siglas tem o ponto, e a comparação o tira antes. Registrado com `it.fails` em `format.spec.ts`; corrigir muda a tela.
- A resposta gravada da paridade é parcial (o TCE-SC vai até fevereiro): quem usa essa fixture vê "até fevereiro de 2025", e não o ano inteiro.
- `useApi` recebe o schema uma vez: ele é constante do módulo de contratos e não entra nas dependências do efeito.
