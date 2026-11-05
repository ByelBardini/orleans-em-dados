# IBGE

Importador do IBGE: população, Censo 2022 e PIB de Orleans, os mesmos dados de Santa Catarina e do Brasil para a comparação, o Censo de educação e as pesquisas de IDEB e rede escolar. Vive em `packages/importadores/ibge/` (pacote `@orleans-em-dados/importador-ibge`), sobre o contrato de [importadores.md](importadores.md), e grava em `ibge_valores` ([db.md](db.md)).

## Estrutura

- `src/config.ts` — `IBGE`, as listas `POPULACAO`, `CENSO`, `PIB`, `COMPARACAO`, `EDUCACAO_CENSO` e `EDUCACAO_COMPARACAO` (tabela, variáveis, classificação, localidades), `VARIAVEIS_DO_PIB`, `LUGARES_DA_COMPARACAO`, `PESQUISAS_DE_EDUCACAO` e `LUGARES_DAS_PESQUISAS`.
- `src/cliente.ts` — `IbgeClienteHttp.agregado(consulta)`, `.arvore(pesquisa)` e `.resultados(pesquisa, local)`; portas `ClienteIbge` e `ClienteDePesquisas`. Repete `429`, `5xx` e erro de rede com espera exponencial, até 4 tentativas.
- `src/normalizar.ts` — `registrosDaResposta(tabela, resposta)` e `registrosDaPesquisa(pesquisa, arvore, resultados)` (resposta vira registros brutos), `normalizarValor(registro)` e `normalizarPesquisa(registro, aceitas)` (registro vira linha), `semRepetidos(registros)`.
- `src/importador.ts` — `criarImportadorIbge({ cliente?, pesquisas? })` e as validações de cada consulta.

## Contrato

- `https://servicodados.ibge.gov.br/api/v3/agregados/{tabela}/periodos/all/variaveis/{v1|v2}?localidades=N6[4211702]&classificacao=...`. Sem autenticação.
- Id do registro: `tabela:variavel:periodo:categoria`; fora de Orleans, com a localidade na frente (`42:6579:9324:2025:`), porque Brasil e Santa Catarina dividem o lote.

| Consulta (`consultas.id`)  | Tabela        | Variáveis                                                                                                                    | Período        |
| -------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `ibge_populacao` (900101)  | 6579          | 9324 população estimada                                                                                                      | sem 2022, 2023 |
|                            | 200           | 93 população (censos)                                                                                                        | 1970 a 2010    |
|                            | 4709          | 93 população                                                                                                                 | 2022           |
| `ibge_censo` (900102)      | 4714          | 93 população, 6318 área (km²), 614 densidade                                                                                 | 2022           |
|                            | 9923          | 93, por situação do domicílio (`1[all]`)                                                                                     | 2022           |
|                            | 9514          | 93, por sexo × idade (`2[all]`, `287[Total e faixas de 5 anos]`, `286[113635]`)                                              | 2022           |
|                            | 10295         | 13431 rendimento domiciliar per capita médio, 13534 mediano                                                                  | 2022           |
| `ibge_pib` (900103)        | 5938          | 37 PIB, 498 valor adicionado, 513 agropecuária, 517 indústria, 6575 serviços, 525 administração, 543 impostos (em mil reais) | 2002 em diante |
| `ibge_comparacao` (900104) | as oito acima | as mesmas                                                                                                                    | as mesmas      |

`ibge_comparacao` pede as mesmas tabelas com `localidades=N1[all]|N3[42]`: `1` é o Brasil, e `42`, Santa Catarina.

## Consultas de educação

| Consulta (`consultas.id`)           | Origem                                                                            | Lugares                  | Linhas (real, 2026) |
| ----------------------------------- | --------------------------------------------------------------------------------- | ------------------------ | ------------------- |
| `ibge_educacao_censo` (900105)      | agregados v3: 10091, 10092, 10056, 10057, 10058, 10059, 10061, 10062, 10324, 1549 | Orleans                  | 106                 |
| `ibge_educacao_comparacao` (900106) | as mesmas, com `localidades=N1[all]\|N3[42]`                                      | Brasil e Santa Catarina  | 212                 |
| `ibge_rede_escolar` (900107)        | pesquisas v1: 40 (IDEB) e 13 (Censo Escolar, sinopse)                             | Orleans e Santa Catarina | 4.853               |

- `/api/v1/pesquisas/{p}/indicadores/0` é a árvore; `/api/v1/pesquisas/{p}/periodos/all/indicadores/0/resultados/{local}`, os resultados. Só `4211702` e `42`: o Brasil não responde nesta API, e o IDEB nacional vem do arquivo do INEP.
- Uma tabela pode ter vários recortes (`EDUCACAO_CENSO`), e recortes repetem linhas. `semRepetidos` tira a repetição exata; o mesmo id com outro valor fica, e o executor rejeita o lote.
- Fora da coleta: 10139 (escolarização, o mesmo número da 10056 de 6 anos em diante) e a variável 1002667 da 10061, que divide por todos os de 18 anos ou mais.
- Indicadores `educacao-censo`, `educacao-comparacao` e `rede-escolar`, com periodicidade `anual`. Tudo fonte única: o IBGE republica o INEP, e isso não conta como conferência.

### Como ler o Censo de educação

`periodo` `2022`, salvo a 1549 (`2010`). `localidade` `4211702` no lote 900105; `42` e `1` no 900106. `categoria` vazia é o total.

| Indicador                       | `tabela` | `variavel` | `categoria`                                                                                                                                                                                                                            |
| ------------------------------- | -------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Taxa de alfabetização, 15 anos+ | 10091    | 2513       | vazia; `Homens`, `Mulheres`; `Urbana`, `Rural`; `15 a 17 anos`, `18 e 19 anos`, `20 a 24 anos`, `25 a 34 anos`, `35 a 44 anos`, `45 a 54 anos`, `55 a 64 anos`, `65 anos ou mais`, `75 anos ou mais` (dentro do anterior)              |
| Pessoas por alfabetização       | 10092    | 950        | vazia; `Alfabetizadas`, `Não alfabetizadas`                                                                                                                                                                                            |
| Frequência escolar bruta        | 10056    | 3795       | vazia; `0 a 3 anos`, `4 a 5 anos`, `6 a 14 anos`, `15 a 17 anos`, `18 a 24 anos`, `25 anos ou mais`                                                                                                                                    |
| Até 5 anos, por nível           | 10057    | 13282      | vazia; idade `0 a 3 anos`, `4 a 5 anos`; nível `Creche`, `Pré-escolar`, `Regular de ensino fundamental`; cruzado `Creche\|0 a 3 anos`                                                                                                  |
| 6 a 17 anos, por nível          | 10058    | 13283      | vazia; o nome do nível (`Regular do ensino médio`, `Superior de graduação`...)                                                                                                                                                         |
| 18 anos ou mais, por nível      | 10059    | 13284      | vazia; o nome do nível (`Superior de graduação`, `Mestrado`...)                                                                                                                                                                        |
| Instrução, 25 anos ou mais      | 10061    | 2667       | `25 anos ou mais` é o total; `Sem instrução e fundamental incompleto\|25 anos ou mais` e os outros três; `Superior completo\|25 anos ou mais\|Homens`. Percentual: conta a partir destas pessoas                                       |
| Média de anos de estudo         | 10062    | 13285      | vazia; `Homens`, `Mulheres`; `25 anos ou mais`, `18 a 24 anos`, e cada um com `\|Homens`, `\|Mulheres`                                                                                                                                 |
| Quem estuda, por local          | 10324    | 2021       | vazia; `Município de residência`, `Outro município`, `País estrangeiro`; `Outro município\|<curso>`; `Superior de graduação` e `<local>\|Superior de graduação`; o mesmo com `Especialização de nível superior, mestrado ou doutorado` |
| Censo 2010: população           | 1549     | 93         | vazia; `0 a 3 anos`, `4 ou 5 anos`, `6 anos`, `7 a 14 anos`, `15 a 17 anos`, `18 ou 19 anos`, `20 a 24 anos`, `25 anos ou mais`                                                                                                        |
| Censo 2010: quem frequentava    | 1549     | 364        | as mesmas. 6 a 14 anos é a soma de `6 anos` e `7 a 14 anos`, nas duas variáveis                                                                                                                                                        |

### Como ler o IDEB e a rede escolar

`tabela` `pesquisa-40` ou `pesquisa-13`, `variavel` o id do indicador, `periodo` o ano, `localidade` `4211702` ou `42`. `categoria` é o caminho da árvore com `>`, sem a raiz "Ensino básico" nem a do IDEB, igual às chaves de `docs/educacao/extratos/ibge-pesquisas.json`. Filtre por `categoria`, que é estável e diz a rede; o id serve de chave.

| Indicador                   | `tabela`    | `categoria`                                                                                                                         | Observação                                                                                                                                              |
| --------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IDEB                        | pesquisa-40 | `Ensino fundamental > Anos iniciais > Pública`, `... > Pública > Municipal`, `... > Estadual`                                       | O mesmo com `Anos finais`; `Ensino médio > Pública`, `... > Pública > Estadual`. `unidade` `índice`                                                     |
| IDEB, só em SC              | pesquisa-40 | `Ensino fundamental > Anos iniciais`, `... > Privada`; o mesmo em `Anos finais` e `Ensino médio`                                    | SC não traz a municipal nem `Ensino médio > Pública`: a rede pública do médio em SC lê `... > Pública > Estadual`, e a municipal vem do arquivo do INEP |
| Matrículas da etapa         | pesquisa-13 | `Matrículas > Ensino infantil`, `... > Creche`, `... > Pré-escolar`, `Matrículas > Ensino fundamental`, `Matrículas > Ensino médio` | `unidade` `matrículas`                                                                                                                                  |
| Creche e pré-escola, rede   | pesquisa-13 | `Matrículas > Ensino infantil > Creche > Municipal`, `... > Privado`                                                                | Rede é `Municipal`, `Estadual`, `Federal`, `Privado`                                                                                                    |
| Matrícula por série e rede  | pesquisa-13 | `Matrículas > Ensino fundamental > 6º ano > Municipal`, `Matrículas > Ensino médio > 1º série > Estadual`                           | Denominador de "cerca de N de M". A fonte escreve "1º série". Médio também tem `4º série` e `Não seriada`, sem valor em Orleans                         |
| Matrícula da etapa por rede | pesquisa-13 | soma de `<etapa> > <série> > <rede>`                                                                                                | A fonte não publica: some em centavos ou no SQL                                                                                                         |
| Docentes                    | pesquisa-13 | `Docentes > Ensino fundamental > Anos iniciais > Municipal`, `Docentes > Ensino médio`                                              | `unidade` `docentes`. O médio não abre rede. Pode contar em mais de uma etapa: não some                                                                 |
| Escolas                     | pesquisa-13 | `Escolas > Ensino fundamental > Anos finais > Estadual`, `Escolas > Ensino médio`                                                   | `unidade` `escolas`. O médio não abre rede                                                                                                              |

## Regras de negócio

- `categoria` junta as categorias da resposta com `|`, sem as chamadas `Total`: `Urbana`, `Homens|0 a 4 anos`. Vazia é o total da tabela.
- Símbolos do SIDRA: `...`, `..` e `X` viram `valor` nulo, com o símbolo em `simbolo`, nunca zero. `-` é zero absoluto: `valor` `0`, com o símbolo guardado. Qualquer outro texto recusa o registro, e o lote é rejeitado.
- Nas pesquisas é diferente: `-`, vazio e `null` são falta de dado, com `valor` nulo, e o ano fica como linha. Ausência não vira zero, e a lacuna do IDEB sai daí. Id fora da árvore recusa o registro, e o lote é rejeitado.
- A API de pesquisas devolve Orleans como `421170`; a linha guarda `4211702`.
- O `ano` do lote é o ano da coleta, e a rodada usa o ano corrente. A API lê o lote publicado de maior `ano`.
- Sem conferência com outra fonte: tudo do IBGE é fonte única. `validar` confere a coerência interna:
  - `ibge_populacao`: exige o Censo 2022 (4709) com número.
  - `ibge_censo`: exige as tabelas do Censo; urbana + rural = total da 9923; homens + mulheres nas faixas = total da 9514.
  - `ibge_pib`: exige o PIB; a composição (513 + 517 + 6575 + 525 + 543) fecha com o PIB em até 3 mil reais: as cinco parcelas e o total vêm arredondados, cada um em até 0,5 mil. Ano com parcela em `...` não entra na conta nem rejeita.
  - `ibge_comparacao`: as três validações acima, em cada lugar; o erro e o item da conferência dizem de qual. Linha de outra localidade recusa o registro. Recusada, não afeta os lotes de Orleans.
  - `ibge_educacao_censo`: exige as dez tabelas. Alfabetizadas + não alfabetizadas = total da 10092, exato, porque é universo. O resto é amostra: locais = total da 10324 (geral, graduação e pós), cursos = outro município, níveis = total da 10057 a 10059, instrução = total da 10061, faixas = total da 1549. Cada parte e o total vêm arredondados em até meia pessoa: a soma pode diferir em até `(partes + 1) / 2`, e 398 + 188 × 585 não rejeita. Na 10324, o total ainda pode passar da soma em até 0,5%, só nesse sentido. A diferença sempre fica em `totais_fonte`. Parte sem número (`X`) tira aquela conta, sem rejeitar.
  - `ibge_educacao_comparacao`: a mesma validação, em cada lugar. Recusada, não afeta Orleans.
  - `ibge_rede_escolar`: exige IDEB e matrícula do fundamental em cada lugar. Soma das folhas (série × rede, ou etapa × rede na educação infantil) = total da etapa, por ano, sem tolerância, em creche, pré-escola, fundamental e médio. Ano com a etapa sem valor fica fora da conta.

## Carga e limites conhecidos

- Carga: `pnpm importar ibge --ano <ano corrente>`, uma consulta por tabela, com a série inteira. Passa nas validações sem ajuste, com a composição do PIB fechando dentro de 3 mil reais em todos os anos com composição (2002 a 2021): o maior desvio é de 2 mil, em Santa Catarina, em 2019.
- Carga das consultas de educação: passa nas validações em todos os lugares, com `--json` em `data/ibge/`. Reproduz os 336 valores de `ibge-censo.json` (sem a 10139) e os 966 de `ibge-pesquisas.json`, mais as 90 somas por rede.
- Soma das séries por rede = etapa fecha sem diferença nos 144 itens: 18 anos (2008 a 2025) × 4 etapas × 2 lugares.
- Condições de moradia e IDHM: não verificados, e o IDHM é de 2010.

## Testes

- `test/support/agregados.ts` — `variavel`, `ClienteIbgeFake` (as duas portas), `respostasDaPopulacao`, `respostasDoCenso`, `respostasDoPib`; `test/support/educacao.ts` — `respostasDaEducacao`, `respostasDasPesquisas`, `VALORES_DA_REDE`. Valores fictícios.
- Fixtures do banco de teste: `ibgeEducacaoCenso`, `ibgeEducacaoComparacao`, `ibgeRedeEscolar`, em `popularCenario` (`null` deixa sem coleta). `importador.spec.ts` confere que passam nas validações.
- Quem roda o importador inteiro com fake passa também `pesquisas`: sem ela, a porta é o cliente real.
- Unit: `normalizar`, `cliente` (transporte falso), `importador` (validações). `test/integration/importador.spec.ts`: gravação e publicação.

## Armadilhas

- Tabela inexistente responde `500`, não `404`: o cliente repete quatro vezes antes de desistir.
- A composição do PIB sai depois do total: em 2022 e 2023 vem `...`. PIB per capita exibido pelo IBGE em 2023 divide pelo Censo 2022, porque não há estimativa nesse ano.
- `-` aparece de verdade na pirâmide de Orleans ("100 anos ou mais", homens). Com `-` = 0, as faixas somam exatamente o Censo.
- Não há estimativa em 2022 nem em 2023, e o IBGE também não estimou 2007 nem 2010: a série tem buracos, e quem precisa da população de um ano usa `populacaoDoAno`.
- **10324 não fecha só por arredondamento.** Em SC e no Brasil, o total passa da soma dos três locais: 938 e 20.541 pessoas no geral (0,05% e 0,04%), 766 e 15.969 na graduação (0,28% e 0,25%), 171 e 4.572 na pós (0,30% e 0,37%). Os metadados não têm outra categoria de local, e a causa não está documentada. Em Orleans, o caso é só arredondamento: 398 + 188 × 585. Percentual de "fora do município" divide pelo total da tabela.
- **Fundamental de 2021.** A linha de cada ano (`... > 1º ano`) vem vazia, em Orleans e em SC, mas série × rede tem valor e fecha com a etapa. Total da série em 2021: some as redes.
- **Matrículas de 2015 a 2017 não são recorte da fonte.** O médio de Orleans cai para 539, 557 e 543, mas as outras séries seguem normais: é uma turma pequena atravessando os anos em diagonal. 8º ano de 2013: 13; 9º de 2014: 52; 1ª série de 2015: 112; 2ª de 2016: 64; 3ª de 2017: 49 (43 estaduais + 6 privados). SC mostra a mesma diagonal: 44.659, 50.701, 73.834, 53.394, 47.425. Em 2018, o médio volta a 730. A causa não está confirmada (a mudança para o fundamental de 9 anos é hipótese): a tela mostra a série e não afirma motivo.
