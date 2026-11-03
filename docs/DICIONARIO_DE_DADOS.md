# Dicionário de dados

As consultas Betha vêm primeiro. A despesa por função (SICONFI) e os agregados do IBGE estão no fim.

Levantamento feito sobre a coleta completa de 2025 (31/10/2026). Descrições marcadas com **(Betha)** vêm do
próprio endpoint de totalizadores; as demais são interpretação a partir do nome e do comportamento dos dados.

## Estrutura das respostas

### Busca textual — `POST /transparencia/api/busca-textual/{consulta}`

```json
{
  "totalHits": 1469,
  "hits": [ { "id": "211:728:697340_4", "sourceAsMap": { ... } } ]
}
```

| Campo                | Tipo    | Significado                                                            |
| -------------------- | ------- | ---------------------------------------------------------------------- |
| `totalHits`          | inteiro | Quantidade de registros que atendem ao filtro (não é valor financeiro) |
| `hits[]`             | lista   | Página de registros (`offset`/`limit`)                                 |
| `hits[].id`          | texto   | ID do registro na Betha. Único dentro da consulta                      |
| `hits[].sourceAsMap` | objeto  | Os campos do registro (abaixo)                                         |

Nenhum outro campo veio no envelope ou no `hit`.

### Totalizadores — `POST /transparencia/api/busca-textual/{consulta}/totalizadores`

Lista com um objeto por campo totalizável:

| Campo       | Exemplo                            | Significado                          |
| ----------- | ---------------------------------- | ------------------------------------ |
| `campo`     | `valorArrecadadoNoMes`             | Nome do campo em `sourceAsMap`       |
| `titulo`    | `Valor arrecadado mês`             | Rótulo exibido no portal             |
| `descricao` | `Referente ao valor efetivamente…` | Definição oficial do campo           |
| `format`    | `currency`                         | Formato de exibição                  |
| `tipo`      | `BigDecimal`                       | Tipo no servidor da Betha            |
| `totalizar` | `SOMA`                             | Operação de totalização              |
| `valor`     | `171092955.92`                     | Total do campo para o filtro enviado |
| `ordem`     | `29`                               | Posição da coluna no portal          |

### Formato do ID

`211:<entidade>:<identificador>` — o prefixo `211` é igual em todos os registros (provavelmente a
organização/município na Betha). O segundo segmento identifica a entidade (`728` Prefeitura, `319` FMS, `2473` SAMAE,
`320` Fundação Ambiental — mapeamento inferido, ver [FONTES_DE_DADOS.md](FONTES_DE_DADOS.md)). Nas receitas, o
terceiro segmento tem o sufixo `_N` (ver abaixo).

---

## `57153` — Receitas Orçamentárias

Filtro: `{"ano":["2025"]}` · 1.469 registros · nenhum campo nulo.

Cada registro é **uma rubrica de receita, de uma entidade, em um mês**. ID: `211:728:697340_4` → entidade `728`,
rubrica interna `697340`, mês `4`.

| Campo                   | Tipo            | Descrição                                                                                                                                                                | Observações em 2025                                                                                                                                                                                            |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rubricaNatureza`       | texto (14 díg.) | Código da natureza da receita (classificação MCASP). Os 2 primeiros dígitos são a origem (`11` impostos, `17` transferências correntes, `24` transferências de capital…) | 190 códigos distintos. **Guardar como texto**                                                                                                                                                                  |
| `descricaoNatureza`     | texto           | Nome da natureza                                                                                                                                                         | 187 descrições distintas (há nomes repetidos em códigos diferentes)                                                                                                                                            |
| `valorOrcado`           | decimal         | Previsão inicial no orçamento                                                                                                                                            | Só aparece no registro do mês 1; nos demais meses é 0                                                                                                                                                          |
| `valorOrcadoDeducoes`   | decimal         | Dedução da previsão                                                                                                                                                      | Só em 5 rubricas, todas cota-partes (FPM, ICMS, IPVA, IPI, ITR), exatamente 20% da previsão — compatível com a dedução para o FUNDEB, **a confirmar**                                                          |
| `valorOrcadoAtualizado` | decimal         | **(Betha)** “Valor orçado após modificações no orçamento inicial”                                                                                                        | Igual a `valorOrcado` em todos os registros de 2025; só no mês 1                                                                                                                                               |
| `valorLancadoNoMes`     | decimal         | Valor lançado (constituído) no mês, antes da arrecadação                                                                                                                 | Diferente de zero em 91 registros, principalmente tarifas do SAMAE                                                                                                                                             |
| `valorArrecadadoNoMes`  | decimal         | **(Betha)** “Valor efetivamente arrecadado para a receita no mês”                                                                                                        | **Campo a somar.** 7 valores negativos (ajustes), preservados                                                                                                                                                  |
| `valorArrecadadoAteMes` | decimal         | Arrecadação acumulada até o mês                                                                                                                                          | **Nunca somar entre meses.** Em 33 de 1.469 registros o acumulado não bate com a soma dos meses anteriores (ex.: rubrica `697340`, meses 4 e 5 repetem −6.236,62 com o mesmo acumulado). Causa não investigada |
| `percentualRealizado`   | decimal         | Percentual arrecadado sobre o orçado                                                                                                                                     | Só calculado no registro que tem orçamento (mês 1); varia de −15,86 a 325,02                                                                                                                                   |

**Mês:** o sufixo `_1`…`_12` se comporta como competência (o orçamento só aparece no `_1`; o acumulado cresce com
o sufixo). Uma rubrica tem de 1 a 12 registros — meses sem movimento não aparecem. Semântica ainda **não confirmada**.

---

## `57140` — Execução Detalhada de Despesas

Filtro: `{"anoExercicio":["2025"]}` · 9.757 registros · datas de 02/01/2025 a 30/12/2025.

Cada registro é **um empenho**. ID: `211:<entidade>:<identificador do empenho>`.

| Campo                   | Tipo              | Descrição                                                                                      | Observações em 2025                                                                                                                     |
| ----------------------- | ----------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `numeroEmpenho`         | inteiro           | Número do empenho na entidade                                                                  | 1 a 6.220. **Não é único**: numeração por entidade, e há 19 números repetidos dentro do SAMAE (ver abaixo)                              |
| `dataEmpenho`           | data `AAAA-MM-DD` | Data de emissão do empenho                                                                     |                                                                                                                                         |
| `descricaoOrgao`        | texto             | Órgão/secretaria                                                                               | 13 valores, incluindo grafias corrompidas (`FUNDAO AMBIENTAL`, `SERVIO AUT. MUN. DE GUA`)                                               |
| `credor.nomeCredor`     | texto             | Nome do credor (objeto `credor` só tem esse campo)                                             | 975 credores. Pode ser pessoa física: **dado pessoal**. Não vem CPF/CNPJ                                                                |
| `historicoEmpenho`      | texto             | Descrição do objeto da despesa                                                                 | 14 a 3.092 caracteres                                                                                                                   |
| `valorEmpenho`          | decimal           | **(Betha)** “Valor do empenho”                                                                 | Nunca nulo nem zero                                                                                                                     |
| `valorLiquidadoEmpenho` | decimal           | **(Betha)** “Total liquidado para o empenho descontados os valores de anulação de liquidações” | **Nulo em 278** registros (ausente, não zero). Igual a `valorPagoEmpenho` em todos os registros não nulos                               |
| `valorPagoEmpenho`      | decimal           | **(Betha)** “Total pago para o empenho descontados os valores de anulação de pagamento”        | Nulo nos mesmos 278                                                                                                                     |
| `saldoAPagar`           | decimal           | Saldo a pagar                                                                                  | Nulo nos mesmos 278. Diferente de zero em 35 registros; nesses, é igual a `valorEmpenho − valorPagoEmpenho`. Não inferir para os demais |

**Números de empenho repetidos:** 19 pares no SAMAE com mesmo número, data, valor, órgão e credor, mas IDs
diferentes (ex.: IDs `23590121` e `23527296`, de 01/04/2025). Ambos entram no totalizador da Betha. Pode ser
duplicação na publicação ou registros legitimamente distintos — **não classificar sem investigação**. A chave do
registro no banco é o `id`, nunca o número.

**Liquidado = pago:** em todos os 9.479 empenhos com valores, o liquidado é igual ao pago. Isso foi reproduzido pelo
totalizador da Betha, mas não reflete necessariamente toda a realidade de pagamentos; tratar com ressalva.

## `900201` — DCA Anexo I-E (SICONFI)

Tabela `siconfi_funcoes`, uma linha por coluna × conta do anexo. Sem credor nem pessoa física.

| Campo no anexo | Coluna             | Descrição                                                                                                        |
| -------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `coluna`       | `etapa`            | `empenhado`, `liquidado`, `pago`, `rp_nao_processados`, `rp_processados`. As etapas nunca se somam               |
| `conta`        | `tipo`             | `total` (`Despesas Exceto Intraorçamentárias`), `funcao` (`10 - Saúde`), `subfuncao` (`10.301 - Atenção Básica`) |
|                | `funcao_codigo`    | Texto, com o zero à esquerda (`01`). Nulo na linha de total                                                      |
|                | `subfuncao_codigo` | `10.301`, ou `FU12` em "Demais Subfunções" da função 12: o código não inventa número                             |
|                | `conta`            | O nome, sem o código                                                                                             |
| `valor`        | `valor`            | `NUMERIC(18,2)`, em valores nominais                                                                             |

A linha de total inclui a Câmara. O total do painel é a soma das funções sem a `01`.

## `900101`, `900102`, `900103`, `900104` — agregados do IBGE

Tabela `ibge_valores`, uma linha por tabela × variável × período × categoria. Sem dado pessoal.

| Coluna       | Descrição                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| `ano`        | Ano da coleta, e não o de referência: o lote traz a série inteira                                          |
| `localidade` | Código do IBGE: `4211702` Orleans, `42` Santa Catarina, `1` Brasil                                         |
| `periodo`    | Ano de referência da linha                                                                                 |
| `categoria`  | Categorias da resposta, juntas com `\|`, sem as chamadas Total (`Homens\|0 a 4 anos`). Vazia é o total     |
| `valor`      | `NUMERIC(18,3)`: pessoas, km², reais ou mil reais, conforme `unidade`. Nulo quando o SIDRA traz um símbolo |
| `unidade`    | A unidade que o IBGE informa para a variável                                                               |
| `simbolo`    | `...`, `..` ou `X`, sem valor; `-` é zero absoluto, com `valor` 0. Nulo quando há número                   |
