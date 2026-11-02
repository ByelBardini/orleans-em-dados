# Conferência Betha × TCE-SC: manter as duas fontes ou trocar?

> Data: 01/11/2026 · Exercícios: 2024 (encerrado), 2025 (encerrado) e 2026 (em curso).
> Reproduzir: `pnpm importar betha --ano AAAA && pnpm importar tcesc --ano AAAA && pnpm conferir --ano AAAA --json`
> (resultado completo em `data/conferencias/AAAA.json`).

## Resposta curta

**Manter as duas, com papéis diferentes. A conferência compensa: com custo baixo, ela localiza
diferenças entre o que as fontes publicam, que uma fonte sozinha não mostra.**

- As fontes são **a mesma contabilidade**: em 2025, 9.738 empenhos casam um a um, e a
  despesa por entidade bate **ao centavo** nas três etapas.
- Mas **não são cópias perfeitas**. Em todos os anos testados apareceram diferenças
  concentradas e localizadas (mesmo valor em duas rubricas, natureza ausente, outro número de empenho no SAMAE).
  Elas só aparecem quando há uma segunda fonte.
- **Trocar tudo pelo TCE perderia** o orçamento atualizado por rubrica e o órgão/secretaria dos empenhos.
- **Ficar só com a Betha perderia** a Câmara Municipal e a única forma de notar quando o
  portal publica algo diferente do que o município envia ao Tribunal.

O painel passou a exibir como número principal só a parte conferida. O que difere fica na seção
Discrepâncias (`#discrepancias`). A regra está em [METODOLOGIA.md](METODOLOGIA.md).

O custo de manter as duas é menor do que o relatório de investigação previa: o coletor TCE não
precisa de autenticação, exportação CSV nem cookies. Ele monta hipercubos próprios na API do Qlik
e roda em segundos.

## O que foi feito

1. **Coletor TCE-SC** (`packages/importadores/tcesc/`): sessão anônima na Qlik Engine API, seleção
   conferida de município e exercício, hipercubos próprios e conciliação da soma das linhas com
   o total do motor. Duas consultas:
   - receitas por unidade × natureza × mês;
   - **empenho a empenho** (9.877 em 2025, inclusive a Câmara).
2. **Betha `57170`** (despesa orçamentária atualizada) integrada. Filtro confirmado: `{"ano": [...]}`.
3. **Correção no coletor Betha:** a paginação sem ordenação devolvia IDs repetidos no ano
   corrente. A 57140 de 2026 era rejeitada sempre, e 2025 só funcionou por acaso.
4. **`pnpm conferir`**: compara as coletas publicadas por entidade, mês, natureza e empenho.
5. Coleta e conferência de 2024, 2025 e 2026 nas duas fontes. Todas as 15 coletas foram
   conciliadas internamente com o totalizador da própria fonte.

## Resultados

### Despesa por entidade (Betha 57170 × TCE por unidade gestora)

| Exercício      | Prefeitura | FMS   | SAMAE                    | Fundação Ambiental | Câmara (só TCE) |
| -------------- | ---------- | ----- | ------------------------ | ------------------ | --------------: |
| 2024           | igual      | igual | **Betha +R$ 123.887,32** | igual              | R$ 2.718.927,41 |
| 2025           | igual      | igual | igual                    | igual              | R$ 2.981.800,76 |
| 2026 até 30/09 | —          | —     | —                        | —                  | R$ 2.560.486,37 |

"Igual" significa empenhado, liquidado e pago idênticos ao centavo. Em 2025, o UG 1864 do TCE
(Câmara) confirma **diretamente** o valor que antes era só inferido por diferença. Betha (4
entidades) + Câmara = total TCE, sem dupla contagem.

### Receita arrecadada

| Exercício       |       Betha 57153 |               TCE |        Diferença | Naturezas iguais (8 díg. × entidade) |
| --------------- | ----------------: | ----------------: | ---------------: | -----------------------------------: |
| 2024            | R$ 150.576.666,82 | R$ 149.487.031,78 | +R$ 1.089.635,04 |                             73 de 76 |
| 2025            | R$ 171.092.955,92 | R$ 170.915.184,25 |   +R$ 177.771,67 |                             73 de 81 |
| 2026, jan.–set. |                 — | R$ 140.848.635,73 |                — |                             78 de 85 |

A série mensal confirma que o sufixo `_N` do ID Betha é o mês. Em 2024, 9 dos 12 meses são
idênticos.

### Empenhos individuais (Betha 57140 × TCE)

Casamento 1:1 por entidade + número + data + valor original:

| Exercício      |          Casados |               Só na Betha |   Só no TCE (fora Câmara) |
| -------------- | ---------------: | ------------------------: | ------------------------: |
| 2024           |            9.069 | 41 (SAMAE, R$ 495.222,16) | 37 (SAMAE, R$ 147.994,62) |
| 2025           |            9.738 |  19 (SAMAE, R$ 36.742,61) |                         0 |
| 2026 até 30/09 | **8.376 (100%)** |                         0 |                         0 |

Prefeitura, FMS e Fundação Ambiental casam 100% em todos os anos.

## O que só a conferência localizou

Nenhuma das hipóteses abaixo está comprovada contabilmente. São diferenças **localizadas**, com a
pista mais provável. O que foi olhado no portal está na seção seguinte.

1. **Registros antigos do SAMAE na 57140.** Em 2025, 19 registros com IDs antigos
   (`211:2473:2349xxxx`–`2357xxxx`) não têm os campos de execução e repetem empenhos atuais com a
   mesma identificação e o mesmo valor: 8 aparecem com outro número (o antigo nº 334 é o atual nº 335),
   10 ficam em dobro com o mesmo número, e o nº 340 (R$ 20.000, 01/04/2025) não tem par em lugar
   nenhum. Entre registros repetidos, o casamento escolhe o que tem execução e ID mais recente. A
   soma da 57140 do SAMAE fica **R$ 36.742,61 acima** da lista casada. A Betha 57170 e o TCE
   concordam entre si e não têm esses registros. Em 2024 o padrão se repete em escala maior, e ali
   até a 57170 do SAMAE difere do TCE.
2. **Mesmo valor em duas rubricas de 2024 (Betha 57153).** R$ 1.135.545,25 aparece em julho como
   "Cotas Extraordinárias" (`17115121`) e como "1% Cota entregue no mês de julho" (`17115131`). O TCE
   registra uma vez só. Em 2025 e 2026 só existe a primeira rubrica.
3. **IRRF do SAMAE só no TCE.** Nos três anos, o TCE tem valores na natureza `11130311` do SAMAE que
   a Betha não mostra como receita, inteiros ou em parte: a diferença é de R$ 46.848,59 (2024),
   R$ 428.717,37 (2025) e R$ 414.748,48 (2026, até setembro).
4. **Linhas mensais que o próprio acumulado da Betha desconsidera (2025).** Em 10 linhas da
   57153, o "arrecadado no mês" não é a variação do "arrecadado até o mês" da mesma rubrica. Isso
   acompanha o convênio da saúde (R$ 250.000), R$ 306.503,90 dos R$ 320.136,80 do SUS Atenção
   Primária, a alienação do SAMAE (R$ 32.900, repetida em agosto), os R$ 3.284,56 da Prefeitura e os
   R$ 15.312,12 que aparecem com os dois sinais em duas rubricas. Pelo acumulado, a Prefeitura de 2025 bate com o TCE e o FMS
   fica em R$ 13.632,90. Em 2024 e 2026 não há nenhuma.
5. **Rubricas provisórias de 2026 (Betha 57153).** As rubricas 13210300 e 13110200 ("NÃO USAR")
   têm valores de janeiro iguais, linha a linha, aos de 13210111 e 13110212, que batem com o TCE. O
   convênio de R$ 895.500 de maio aparece em 24149901 e em 24195101. Parte da diferença de 13210300 e
   13110200 fica sem padrão: R$ 86.576,63 e R$ 34.522,25 em 13210300, e R$ 10.063,46 em 13110200.

## Conferido à mão em 01/11/2026

O que foi olhado no portal, caso a caso. O registro versionado é
`packages/db/src/conferencia/conferencias-manuais.ts`, e a seção Discrepâncias mostra a situação de cada um.

| Ano  | Entidade   | Caso                              |           Valor | O que o portal mostra                                             | Situação                                  |
| ---- | ---------- | --------------------------------- | --------------: | ----------------------------------------------------------------- | ----------------------------------------- |
| 2024 | Prefeitura | `17115131`, mesmo valor           | R$ 1.135.545,25 | O mesmo valor em duas rubricas de julho                           | Confirmado                                |
| 2024 | SAMAE      | Consórcio, modalidade 71          |   R$ 123.887,32 | Empenhos 831, 787, 1043 e 44 em duas linhas da 57170              | Confirmado                                |
| 2024 | SAMAE      | 36 empenhos só no TCE-SC          |   R$ 143.934,18 | Os números não aparecem na lista da Betha                         | Confirmado                                |
| 2025 | FMS        | `17135011`, fora do acumulado     |   R$ 306.503,90 | Lançamento que o acumulado da rubrica desconsidera                | Confirmado; R$ 13.632,90 seguem sem causa |
| 2025 | FMS        | `24145001`, fora do acumulado     |   R$ 250.000,00 | Lançamento que o acumulado da rubrica desconsidera                | Confirmado                                |
| 2025 | SAMAE      | `22130101`, fora do acumulado     |    R$ 32.900,00 | Lançamento que o acumulado da rubrica desconsidera                | Confirmado                                |
| 2025 | SAMAE      | Empenho nº 340 (01/04)            |    R$ 20.000,00 | Registro sem execução, sem correspondente no TCE-SC               | Confirmado                                |
| 2025 | SAMAE      | Empenho nº 342, registro repetido |        R$ 48,72 | Dois registros do mesmo empenho                                   | Confirmado                                |
| 2025 | SAMAE      | `11130311`, só no TCE-SC          |   R$ 428.717,37 | A natureza não aparece nas receitas do portal                     | Confirmado                                |
| 2026 | Prefeitura | `24149901`, mesmo valor           |   R$ 895.500,00 | O mesmo valor em duas rubricas de maio                            | Confirmado                                |
| 2026 | Prefeitura | `13210300`, mesmo valor           |    só o exemplo | Um exemplo de R$ 66.113,49 em duas rubricas; o restante é cálculo | Confirmado em parte                       |
| 2026 | SAMAE      | `11130311`, só no TCE-SC          |   R$ 414.748,48 | A natureza não aparece nas receitas do portal                     | Confirmado                                |

### Correções ao que este relatório dizia

- **"19 sem liquidação" não descreve os empenhos.** Os 19 são registros da 57140 sem os campos de execução,
  mas não são 19 empenhos sem execução. Em 10 deles, o empenho tem liquidação: o portal mostra o mesmo
  número em outro registro, de ID mais recente, com liquidado e pago, e a linha sem liquidação é só a cópia
  antiga. Dos outros 9, 8 têm o par sob outro número, e só o nº 340 não tem par.
- **A lacuna dos 36 empenhos não é uma faixa inteira.** São números soltos entre 756 e 800, mais o 876:
  756 a 768, 771, 773, 774, 776, 779 a 781, 783 a 786, 788 a 795, 797, 798, 800 e 876. Os números que
  faltam nessa lista, como 769, 770 e 787, não entram nela.
- **O consórcio do SAMAE em 2024 foi localizado empenho a empenho.** Os empenhos 831, 787, 1043 e 44 aparecem em duas
  linhas da 57170, e as linhas de modalidade 71 somam a diferença nas três etapas (empenhado
  R$ 123.887,32; liquidado e pago R$ 88.945,87). Não foi provado por que o portal mostra as duas linhas.

### O IRRF do SAMAE: o que a soma mostra e o que não prova

Em dezembro de 2025, o TCE-SC tem R$ 96.242,40 na natureza `11130311` do SAMAE. O portal mostra retenções nas
liquidações de três empenhos do SAMAE que somam exatamente esse valor:

| Empenho |     Retenção |
| ------- | -----------: |
| 1175    | R$ 43.948,94 |
| 1144    | R$ 51.566,05 |
| 1107    |    R$ 727,41 |
| Soma    | R$ 96.242,40 |

O portal não mostra esse valor como receita, nem na 57153 nem em Receitas Diárias.

**O que não foi provado:** a soma, feita para dezembro de 2025, identifica o valor pela coincidência. O rótulo da
retenção no portal não confirma que ela é IRRF, e o Balanço Orçamentário não foi usado para confirmar o tratamento.

## Atualização

Em 01/11/2026, o TCE tinha empenhos de 2026 **até 30/09** (Câmara até 29/10) e receitas até
setembro. A Betha tinha até 29/10. O app do TCE foi recarregado em 30–31/10, ou seja, os dados
chegam pela remessa do e-Sfinge, não diariamente.

Consequência: no ano corrente, o painel vai até onde o TCE já chegou, e o restante fica como
"aguardando TCE". É o custo aceito ao exibir só dados conferidos: se a coleta do TCE parar, o painel para de avançar.

## O que cada fonte tem que a outra não tem

| Só na Betha                                                 | Só no TCE                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| Dados do mês corrente                                       | Câmara Municipal                                                    |
| Orçamento atualizado por rubrica (57153) e por ação (57170) | Liquidação e pagamento reais por empenho, com estornos              |
| Órgão/secretaria do empenho                                 | Função, subfunção, elemento, fonte de recurso, projeto/atividade    |
| Consultas de pessoal, programas etc. (não integradas)       | Nº de licitação/contrato/convênio, situação cadastral do credor     |
|                                                             | Todos os municípios de SC, com o mesmo modelo (permite comparações) |

## O que o painel exibe por indicador

A tabela completa está no §7.1 da [especificação](ESPECIFICACAO_TECNICA.md).

| Indicador                                  | Fonte exibida                                  | Conferida contra                    |
| ------------------------------------------ | ---------------------------------------------- | ----------------------------------- |
| Receita arrecadada                         | Betha 57153, só a parte comum                  | TCE-SC por entidade, natureza e mês |
| Despesa, exercício encerrado               | Betha 57170                                    | TCE-SC por unidade gestora          |
| Despesa, ano em curso                      | TCE-SC até o corte                             | Betha 57140, empenho a empenho      |
| Lista de empenhos                          | Betha 57140 (identificação); TCE-SC (execução) | Casamento 1:1                       |
| Despesa da Câmara                          | TCE-SC, à parte                                | Fonte única                         |
| Orçamento atualizado e órgão               | Betha                                          | Fonte única                         |
| Classificação funcional e fonte de recurso | TCE-SC (expansão futura)                       | —                                   |

## Como a conferência funciona

1. **Coleta:** cada fonte concilia com o próprio totalizador (já existe nas duas).
2. **Receita:** cada cruzamento de entidade, natureza e mês vira parte conferida + diferença com tipo.
3. **Despesa:** por entidade, em exercício encerrado; o valor sai da soma se não fecha nas três etapas.
4. **Ano em curso:** só os meses que o TCE já tem, com o limite derivado da maior `data_empenho` do TCE, não do calendário.
5. **Empenhos:** casamento 1:1. Sem par, vai para a seção, com o tipo.
6. **Conferência à mão:** o registro diz se o caso é só cálculo ou foi confirmado. Valor que muda depois fica "Rever".
7. Nunca corrigir silenciosamente um número com o outro. Mostrar as duas fontes e a diferença.

## Próximos passos sugeridos

1. Persistir cada conferência (tabela `comparacoes_fontes`) para ter histórico das diferenças.
2. Agendar: Betha diária ou semanal; TCE semanal, após a recarga do app.
3. Se o portal mudar, recoletar a 57153 de 2025 e 2026 e reconferir.

## Limites

- Os painéis do TCE usam Qlik sem contrato de API. Os IDs dos apps e os nomes de campo podem
  mudar. O coletor falha de forma explícita nesse caso.
- Três exercícios, um município. O padrão "igual ao centavo" não foi demonstrado para outros anos.
- Igualdade entre as fontes não é auditoria nem homologação contábil. Diferença entre fontes pode decorrer
  de critério, abrangência ou atualização, e não indica, por si só, erro nem irregularidade.
