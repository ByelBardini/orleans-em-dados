# Dicionário de dados

As consultas Betha vêm primeiro. A despesa por função (SICONFI), os agregados do IBGE e as tabelas de educação estão no fim.

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

## `900101` a `900107` — agregados e pesquisas do IBGE

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

`900105` e `900106` são o Censo de educação (Orleans; Santa Catarina e Brasil). `900107` são as pesquisas 40 (IDEB) e 13 (matrículas, docentes e escolas), com `tabela` `pesquisa-40` ou `pesquisa-13` e `variavel` o id do indicador. `categoria` é o caminho da árvore, com `>`.

## Educação: tabelas

Sem nome, CPF nem valor individual. `id_externo` é a junção de `lugar:rede:etapa:recorte:indicador:periodo` em `educacao_valores`, e de `lugar:rede:recorte:indicador:periodo` em `educacao_financas`. Views: `educacao_valores_publicados`, `educacao_financas_publicadas`.

| Coluna       | Tabela              | Descrição                                                                                                                                  |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `ano`        | as duas             | Ano de referência do lote: o exercício, no dinheiro; 2022, na transição 2021–2022                                                          |
| `periodo`    | as duas             | Referência da linha: `2025`, `2021-2022`, `2026-05`                                                                                        |
| `indicador`  | as duas             | Chave do indicador, na tabela abaixo                                                                                                       |
| `lugar`      | as duas             | Código do IBGE: `4211702` Orleans, `42` Santa Catarina, `1` Brasil                                                                         |
| `rede`       | as duas             | `publica`, `municipal`, `estadual`, `federal`, `privada`, `todas`. Outro valor é recusado pelo banco                                       |
| `etapa`      | `educacao_valores`  | `creche`, `pre_escola`, `anos_iniciais`, `ano_1` a `ano_9`, `medio`, `serie_1` a `serie_4`, `eja` etc. Vazia: não se aplica                |
| `recorte`    | as duas             | Corte do indicador: `grupo_1`, `prova_em_orleans`, `magisterio:temporario`. Vazio: não se aplica                                           |
| `valor`      | `educacao_valores`  | `NUMERIC(18,4)`: contagem, taxa ou nota. Sem dado é nulo, nunca zero                                                                       |
| `texto`      | `educacao_valores`  | Resposta em texto: `menos de 5`, `> 80`, resposta ao Retrato do MEC                                                                        |
| `unidade`    | `educacao_valores`  | `%`, `alunos`, `horas`, `indice`, `nota`, `pessoas`, `escolas`, `anos`, `turmas`, `texto`, `cursos`, `vagas`, `instituicoes`, `municipios` |
| `valor`      | `educacao_financas` | `NUMERIC(18,2)`: dinheiro, em reais nominais                                                                                               |
| `percentual` | `educacao_financas` | `NUMERIC(7,2)`: o índice que acompanha o valor (Anexo 8, Anexo 14), nulo quando não há                                                     |

## Educação: consultas e indicadores

| ID                  | Chave                                                 | Tabela              | Indicadores                                                                                                                                                     |
| ------------------- | ----------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `900202`            | `siconfi_indices`                                     | `educacao_financas` | `indice_educacao`, `fundeb_remuneracao`                                                                                                                         |
| `900301`            | `inep_rendimento`                                     | `educacao_valores`  | `aprovacao`, `reprovacao`, `abandono`                                                                                                                           |
| `900302`            | `inep_transicao`                                      | `educacao_valores`  | `promocao`, `repetencia`, `evasao`, `migracao_eja`                                                                                                              |
| `900303`            | `inep_distorcao`                                      | `educacao_valores`  | `distorcao`                                                                                                                                                     |
| `900304`, `900305`  | `inep_turmas`, `inep_horas`                           | `educacao_valores`  | `alunos_por_turma`, `horas_aula`                                                                                                                                |
| `900306`            | `inep_docentes_superior`                              | `educacao_valores`  | `docentes_superior`                                                                                                                                             |
| `900307` a `900309` | `inep_adequacao`, `inep_regularidade`, `inep_esforco` | `educacao_valores`  | `adequacao`, `regularidade`, `esforco`, com `recorte` por grupo ou nível                                                                                        |
| `900310`            | `inep_remuneracao`                                    | `educacao_financas` | `remuneracao_rais`, de 2021, com `recorte` `<total\|com_superior\|sem_superior>:<medida>`                                                                       |
| `900311`            | `inep_inse`                                           | `educacao_valores`  | `inse`                                                                                                                                                          |
| `900312`            | `inep_alfabetizacao`                                  | `educacao_valores`  | `alfabetizacao_2o_ano`, `alfabetizacao_meta`, `alfabetizacao_participacao`                                                                                      |
| `900313`            | `inep_ideb`                                           | `educacao_valores`  | `ideb` (só o Brasil; Orleans e SC vêm do IBGE), `ideb_rendimento`, `ideb_matematica`, `ideb_portugues`, `ideb_aprovacao`                                        |
| `900314`            | `inep_enem`                                           | `educacao_valores`  | `enem_inscritos`, `enem_presentes`, `enem_media_5_areas`, as quatro áreas e a redação, `enem_escolas`                                                           |
| `900315`            | `inep_superior`                                       | `educacao_valores`  | `superior_*`: oferta presencial, perfil, por curso, EaD em total, docentes, IGC, CPC e Enade                                                                    |
| `900401`            | `siope_indicadores`                                   | `educacao_valores`  | percentuais `siope_<chave>`                                                                                                                                     |
| `900404`            | `siope_indicadores_valores`                           | `educacao_financas` | valores `siope_<chave>`, como `siope_por_aluno_fundamental`                                                                                                     |
| `900402`            | `siope_anexo8`                                        | `educacao_financas` | `indice_educacao`, `fundeb_remuneracao`, `gasto_total`, `fundeb_contribuicao`, `fundeb_resultado`, `receita_impostos`, `pessoal_ativo`, `capital`, `emenda_119` |
| `900403`            | `siope_remuneracao`                                   | `educacao_financas` | `mediana_40h`, `mediana_vencimento_40h`, `total_declarado`                                                                                                      |
| `900405`            | `siope_remuneracao_carga`                             | `educacao_valores`  | `carga_temporaria`, `carga_horas`, `profissionais`, `formacao_magisterio`                                                                                       |
| `900501`            | `mec_retrato`                                         | `educacao_valores`  | `retrato_<chave>`, em `texto`; `retrato_distribuicao`, por nível de gestão entre os municípios de SC                                                            |

O que cada lote traz, etapa por etapa, está em [context/educacao.md](context/educacao.md). A lista de indicadores, com importador, conferência e periodicidade, é `INDICADORES`, em `packages/contracts/src/indicadores/registro.ts`.
