# Dashboard

Dashboard público em React 19 + Vite 6, em TSX. Vive em `apps/web/src/` (pacote `@orleans-em-dados/web`); o Vite faz proxy de `/api` para `localhost:3000`.

## Estrutura

- `apps/web/src/App.tsx` — abas (`ABAS`) navegadas pelo hash da URL, filtros de ano e entidade, "Atualizado em" do exercício (de `/api/anos`).
- `apps/web/src/paginas/` — cada página recebe `PropsDaPagina` (`props.ts`): `VisaoGeral`, `Receitas`, `Despesas`, `Discrepancias`, `Metodologia`.
- `apps/web/src/components.tsx` — componentes compartilhados.
- `apps/web/src/selos.ts` — a regra dos selos, sem DOM. `apps/web/src/selo.tsx` — `Selo`, `AvisoDeAtraso`.
- `apps/web/src/conferido.tsx` — o que as páginas dizem sobre a conferência: `ContaDaReceita`, `ContaDaDespesa`, `ContaDosEmpenhos`, `AvisoDaReceitaAguardando`, `SemConferencia`, `ateOMes`, `LINK_DISCREPANCIAS`, `FRASE_DA_DIFERENCA`.
- `apps/web/src/styles.css` — visual de "caderno de jornal" com tokens em `:root` (papel, tinta, vermelho, três famílias de fonte), tema claro/escuro por `data-theme`. Referência visual: `docs/screens/`.

## Funções e utilitários

- `getJSON(caminho, schema)`, `useApi(caminho, schema)` (`api.ts`) — busca JSON e valida pelo schema de `packages/contracts`: resposta fora do contrato vira erro na tela, não número errado. Erro do servidor vira a mensagem `erro` do corpo; `useApi(null, …)` não busca. Ao trocar de caminho, mantém os dados anteriores enquanto carrega e descarta resposta antiga.
- `format.ts` — `moeda` (travessão para nulo, sinal preservado), `moedaCompacta`, `numero`, `decimal`, `percentual` (sem casas forçadas), `pct` (casas fixas, padrão 1), `milhoes`/`emMilhoes`/`porExtenso`, `data`/`dataHora`/`dataCurta`/`diaEMes`, `MESES`, `MESES_LONGOS`, `nomeProprio` (caixa alta da Betha → nome próprio, mantendo siglas).
- `referencias.ts` — `populacao(ano)` (IBGE, ano anterior mais próximo), `ORIGEM_CIDADAO`, `ORIGENS_DE_FORA`, `GLOSSARIO`, `sujeito(entidade)`.
- `seloConferidoComTce(ateMes?)`, `seloConferidoComBetha(dataCorte)`, `seloDaDespesa(conferencia)`, `SELO_FONTE_UNICA`, `SELO_EXEMPLO`, `seloAguardando(motivo?)`, `seloDeAtraso`, `seloDaSituacao(situacao, data, protocolo)` (`selos.ts`) — o nível da conferência; nenhum usa "validado". Só o estado `confere` leva o link "Ver discrepâncias", e `semLink` o tira quando a conta já está ao lado.

## Componentes/Módulos

- `Estado`, `Numero`, `Numeros`, `Mi`, `ListaPontos`, `BarrasMensais`, `LinhaAcumulada`, `BarraDividida`, `SeletorTema`, `Alternador`, `Filtros`, `Fonte` (`components.tsx`, com o rótulo "Conferência", nunca "Validação"); `escala(maximo, linhas)` calcula a régua dos gráficos.

## Regras de negócio

- Visão Geral, Receitas e Despesas têm três estados, pelo que a API devolve: conferido; `meta.exemplo` (os números fictícios, com `SELO_EXEMPLO`, sem conta nem selo de conferido); `conferencia.disponivel: false` em coleta real (`SemConferencia`, sem número nenhum, com os filtros).
- O número principal é sempre o conferido. Ao lado, a conta com os valores de `conferencia`: receita, conferido + em discrepância + aguardando = total da Betha, com o que só o TCE-SC registra à parte e a explicação quando o conferido fica abaixo das duas fontes; despesa encerrada, empenhado + em discrepância = total da 57170. A despesa em curso não tem conta: o que aguarda é valor original da Betha, e o conferido é líquido do TCE-SC.
- Ano parcial: a receita diz "até setembro de 2026" no título do indicador, a despesa diz a data do corte, e o aviso de aguardando é pendência, em tom neutro.
- Percentual de realização e "por morador" usam o conferido. O orçamento tem o selo de fonte única e é do ano inteiro: no ano parcial, o texto diz "faltam", e não "faltaram".
- Tabela de rubricas: `nivel` 8 e 14 convivem, e a linha de 8 dígitos diz que está agrupada porque há mês em discrepância.
- Despesas: entidade não conferida fica na tabela "Por entidade" sem número, fora da soma, com aviso e link. A Câmara tem selo de fonte única, fica à parte e não soma com as entidades. A nota separa os empenhos que aguardam o TCE-SC dos que estão em discrepância.
- Sobre os dados (`Metodologia`) define "conferido com o TCE-SC", "conferido com a Betha até DD/MM", "fonte única, sem conferência" e "aguardando TCE", diz que igualdade entre fontes não é auditoria e aponta para `#discrepancias`.
- Situação do empenho na lista: a mesma regra do filtro da API (`sem` é "Sem liquidação"); saldo nulo sai com travessão, sem virar zero.
- A aba é "Discrepâncias", em `#discrepancias`; `#conferencia` continua abrindo (`ALIASES`).
- Discrepâncias lê `/api/discrepancias`: grupos em blocos por área (receita, despesa, empenhos, que não se somam), cada um com rótulo, explicação, o `total` da resposta e os casos. Grupo ou área sem caso não aparece. Até 10 casos abertos; o resto em "Ver todos os N". Em até 720 px, cada caso vira bloco, sem rolagem lateral.
- Cada caso: entidade, natureza ou número, mês ou data, valor por fonte, diferença com o lado que registra mais (nunca sinal), nota, evidência e `seloDaSituacao`. Em `mes_diferente` não há lado: "R$ X em meses diferentes". Natureza dividida diz "parte dos R$ Y da natureza".
- A conta do ano é uma por área, lida de `/api/receitas`, `/api/despesas/resumo` e `/api/despesas/empenhos/resumo`. Empenhos: casados + `fonte: betha` da seção + aguardando = totalizador `valorEmpenho` da 57140. A despesa em curso não tem conta. A conta usa sinal, e o `total` do grupo é em módulo: os grupos somados podem não repetir o "em discrepância" (2025: R$ 15.312,12 entram com os dois sinais), e a página avisa.
- "Aguardando o TCE-SC" vem à parte, abaixo dos grupos, sem selo de situação e sem palavra de problema.
- "Os totais, para conferir" lê `/api/conferencias`, por último e só com a seção disponível: despesa, receita e empenhos por entidade, receita mês a mês, Câmara, como ler e coletas, todos neutros.
- Filtro de entidade do App: a seção mostra o alternador (quem chega com ele ligado precisa soltar). Casos e aguardando filtram por `codigoEntidade`, com o total refeito em centavos; as contas pedem o recorte à API; o total dos empenhos é a soma das partes, porque o totalizador é do município; os totais filtram por sigla, e a Câmara sai.
- Texto proibido nas páginas de dados: "validado", "validação", "irregular", "fraude", "erro", "fantasma". Os specs buscam no container. Única exceção: a frase em negativa de Discrepâncias e de Sobre os dados (`FRASE_DA_DIFERENCA`, §7.3), que o spec tira antes de buscar.

## Testes

- Specs em `apps/web/test/` espelhando `src/`; ambiente `jsdom`, Testing Library e `user-event`, com `test/setup.ts`. `test/support/fetch-fake.ts` — `FetchFake` (segura e libera respostas). `test/support/respostas.ts` — as respostas gravadas da paridade como fixture de tela, o mesmo JSON que a API confere. `test/support/conferidos.ts` — respostas com valores à mão para os estados das páginas (`receitas`, `despesas`, `resumoDeEmpenhos`, `api`), `contaNaTela` e `TEXTO_PROIBIDO`. `test/support/discrepancias.ts` — a resposta de `/api/discrepancias` com valores à mão (`caso`, `casoDeEmpenho`, `grupo`, `discrepancias`, `discrepanciasParciais`, `semConferencia`).

## Armadilhas

- `Intl` do `pt-BR` separa `R$` do número com espaço não separável (`U+00A0`): esperado de teste usa o caractere certo.
- `nomeProprio` transforma 'S.A.' em 'S.a.': a lista de siglas tem o ponto, e a comparação o tira antes. Registrado com `it.fails` em `format.spec.ts`; corrigir muda a tela.
- A resposta gravada da paridade é parcial (o TCE-SC vai até fevereiro): quem usa essa fixture vê "até fevereiro de 2025", e não o ano inteiro.
- `useApi` recebe o schema uma vez: ele é constante do módulo de contratos e não entra nas dependências do efeito.
