# IBGE

Importador dos agregados do IBGE: população, Censo 2022 e PIB de Orleans, e os mesmos dados de Santa Catarina e do Brasil para a comparação. Vive em `packages/importadores/ibge/` (pacote `@orleans-em-dados/importador-ibge`), sobre o contrato de [importadores.md](importadores.md), e grava em `ibge_valores` ([db.md](db.md)).

## Estrutura

- `src/config.ts` — `IBGE`, as listas `POPULACAO`, `CENSO`, `PIB` e `COMPARACAO` (tabela, variáveis, classificação, localidades), `VARIAVEIS_DO_PIB` e `LUGARES_DA_COMPARACAO`.
- `src/cliente.ts` — `IbgeClienteHttp.agregado(consulta)`; porta `ClienteIbge`. Repete `429`, `5xx` e erro de rede com espera exponencial, até 4 tentativas.
- `src/normalizar.ts` — `registrosDaResposta(tabela, resposta)` (uma resposta vira registros brutos) e `normalizarValor(registro)` (registro vira linha).
- `src/importador.ts` — `criarImportadorIbge({ cliente? })` e as validações de cada consulta.

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

## Regras de negócio

- `categoria` junta as categorias da resposta com `|`, sem as chamadas `Total`: `Urbana`, `Homens|0 a 4 anos`. Vazia é o total da tabela.
- Símbolos do SIDRA: `...`, `..` e `X` viram `valor` nulo, com o símbolo em `simbolo`, nunca zero. `-` é zero absoluto: `valor` `0`, com o símbolo guardado. Qualquer outro texto recusa o registro, e o lote é rejeitado.
- O `ano` do lote é o ano da coleta, e a rodada usa o ano corrente. A API lê o lote publicado de maior `ano`.
- Sem conferência com outra fonte: tudo do IBGE é fonte única. `validar` confere a coerência interna:
  - `ibge_populacao`: exige o Censo 2022 (4709) com número.
  - `ibge_censo`: exige as tabelas do Censo; urbana + rural = total da 9923; homens + mulheres nas faixas = total da 9514.
  - `ibge_pib`: exige o PIB; a composição (513 + 517 + 6575 + 525 + 543) fecha com o PIB em até 3 mil reais: as cinco parcelas e o total vêm arredondados, cada um em até 0,5 mil. Ano com parcela em `...` não entra na conta nem rejeita.
  - `ibge_comparacao`: as três validações acima, em cada lugar; o erro e o item da conferência dizem de qual. Linha de outra localidade recusa o registro. Recusada, não afeta os lotes de Orleans.

## Carga e limites conhecidos

- Carga: `pnpm importar ibge --ano <ano corrente>`, uma consulta por tabela, com a série inteira. Passa nas validações sem ajuste, com a composição do PIB fechando dentro de 3 mil reais em todos os anos com composição (2002 a 2021): o maior desvio é de 2 mil, em Santa Catarina, em 2019.
- Sem escolarização, alfabetização, condições de moradia nem IDHM: tabelas não verificadas, e o IDHM é de 2010.

## Testes

- `test/support/agregados.ts` — `variavel`, `ClienteIbgeFake`, `respostasDaPopulacao`, `respostasDoCenso`, `respostasDoPib`, com valores fictícios.
- Unit: `normalizar`, `cliente` (transporte falso), `importador` (validações). `test/integration/importador.spec.ts`: gravação e publicação.

## Armadilhas

- Tabela inexistente responde `500`, não `404`: o cliente repete quatro vezes antes de desistir.
- A composição do PIB sai depois do total: em 2022 e 2023 vem `...`. PIB per capita exibido pelo IBGE em 2023 divide pelo Censo 2022, porque não há estimativa nesse ano.
- `-` aparece de verdade na pirâmide de Orleans ("100 anos ou mais", homens). Com `-` = 0, as faixas somam exatamente o Censo.
- Não há estimativa em 2022 nem em 2023, e o IBGE também não estimou 2007 nem 2010: a série tem buracos, e quem precisa da população de um ano usa `populacaoDoAno`.
