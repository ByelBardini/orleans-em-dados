# Fontes de dados

| Fonte                                                                                                    | Papel                                                                    | Status no projeto                                                                        |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| [Portal da Transparência Betha — Orleans](https://transparencia.betha.cloud/#/mJRAZlfGu2RI9KNBWj49aw==)  | Dados operacionais de Prefeitura, FMS, SAMAE e Fundação Ambiental        | **Integrada**: consultas `57153`, `57140` e `57170`                                      |
| [TCE-SC / Farol](https://servicos.tcesc.tc.br/farol_externo/)                                            | Conferência e Câmara Municipal                                           | **Coletor integrado** (receitas e empenhos); ver `packages/importadores/tcesc/README.md` |
| [SICONFI](https://www.siconfi.tesouro.gov.br/) / [API](https://apidatalake.tesouro.gov.br/docs/siconfi/) | Despesa por função (DCA Anexo I-E) e índices de educação (RREO Anexo 14) | **Integrada**: consultas `900201` e `900202`; o resto do RREO e o RGF continuam fora     |
| [IBGE](https://servicodados.ibge.gov.br/api/docs)                                                        | População, Censo 2022, PIB, Censo de educação, IDEB e rede escolar       | **Integrada**: consultas `900101` a `900107`                                             |
| [INEP](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos)                                  | Indicadores educacionais, IDEB, ENEM e ensino superior                   | **Por snapshot**: consultas `900301` a `900315`                                          |
| [SIOPE](https://www.gov.br/fnde/pt-br/assuntos/sistemas/siope)                                           | Índices legais, investimento por aluno e remuneração declarada           | **Por snapshot**: consultas `900401` a `900405`, exercícios de 2020 em diante            |
| [MEC](https://www.gov.br/mec/pt-br/pnei/retrato-da-educacao-infantil-no-brasil)                          | Retrato da Educação Infantil: resposta do município                      | **Por snapshot**: consulta `900501`                                                      |

As fontes de educação (IBGE, INEP, SIOPE, SICONFI e MEC) estão em [educacao/README.md](educacao/README.md). IBGE e SICONFI são coletados por API; INEP, SIOPE e MEC, por snapshot versionado (seção Educação, abaixo).

## IBGE: agregados usados

Código do município: `4211702`. Sem autenticação. O lote traz a série inteira: `coletas.ano` é o ano da coleta, e `periodo` é o ano de referência.

| Consulta         | Tabela | Variáveis                                                                               |
| ---------------- | ------ | --------------------------------------------------------------------------------------- |
| `ibge_populacao` | 6579   | 9324, população estimada. Não há estimativa em 2022 nem em 2023                         |
|                  | 200    | 93, população nos censos até 2010                                                       |
|                  | 4709   | 93, população no Censo 2022                                                             |
| `ibge_censo`     | 4714   | 93 população, 6318 área, 614 densidade                                                  |
|                  | 9923   | 93 por situação do domicílio                                                            |
|                  | 9514   | 93 por sexo e faixa de idade de 5 anos                                                  |
|                  | 10295  | 13431 e 13534, rendimento domiciliar per capita médio e mediano                         |
| `ibge_pib`       | 5938   | 37 PIB; 513, 517, 6575, 525 e 543, a composição, que vem depois do total (`...` até lá) |

`ibge_comparacao` pede as mesmas tabelas para o Brasil e Santa Catarina (`localidades=N1[all]|N3[42]`), e Orleans é comparada a eles no mesmo ano.

Símbolos do SIDRA: `...`, `..` e `X` ficam sem valor, com o símbolo guardado. `-` é zero absoluto. A coerência é conferida na coleta: urbana + rural = total; homens + mulheres nas faixas = total; composição = PIB, em até 1 mil reais, por arredondamento das parcelas.

## SICONFI: DCA Anexo I-E

`https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?an_exercicio=<ano>&no_anexo=DCA-Anexo I-E&id_ente=4211702`, sem autenticação, paginação ORDS (`hasMore`, `offset`).

- Responde para Orleans de 2018 a 2025. Em todos, a soma das funções é igual à linha de total nas três etapas.
- Em 2024 e 2025, o total fecha ao centavo com o TCE-SC, e a função Legislativa é igual à Câmara (UG 1864).
- Função não é entidade: Saúde é igual ao FMS em 2024 e 2025, mas Saneamento 2024 (R$ 10.902.059,23) difere do SAMAE no TCE-SC (R$ 10.791.652,53). Por isso, cada função é fonte única.
- O campo `populacao` da resposta não é usado: traz 23.531 em 2024 e 2025, diferente do IBGE.
- A DCA do exercício é entregue até 30 de abril do ano seguinte. Conta em formato desconhecido é recusada, porque o quadro já mudou de um ano para outro.

### RREO Anexo 14

`https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio=<ano>&nr_periodo=6&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo 14&id_ente=4211702`. Consulta `siconfi_indices` (`900202`). Só as contas do mínimo de educação e do Fundeb na remuneração são guardadas, para comparar com o SIOPE. Igualdade do percentual não confere: a comparação é do valor.

## Educação: INEP, SIOPE e MEC

Essas fontes não têm API utilizável: o INEP publica arquivos, os relatórios do SIOPE têm CAPTCHA, e o Retrato do MEC é um painel. Um extrator local lê os arquivos e gera snapshots agregados em `docs/educacao/snapshots/`, versionados, que entram no banco com `pnpm importar --arquivo`. Em produção, não se baixa nada, e os importadores não têm agenda. Passo a passo em [educacao/fontes-download.md](educacao/fontes-download.md).

| Fonte | Cobre                                                                                                                                                            | Selo                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| INEP  | Rendimento, transição, distorção, turmas, horas, formação, regularidade, esforço, RAIS de 2021, nível socioeconômico, alfabetização, IDEB, ENEM, ensino superior | Fonte única                                            |
| SIOPE | Indicadores, Anexo 8 e remuneração declarada                                                                                                                     | Fonte única; comparado com o RREO Anexo 14 nos índices |
| MEC   | Respostas de Orleans ao Retrato da Educação Infantil 2025                                                                                                        | Fonte única, com "a Prefeitura informou ao MEC"        |

- **O que veio de extrato:** nos lotes do INEP em que faltou o arquivo municipal original, Orleans vem de `docs/educacao/extratos/inep-orleans.json`, e `meta.filtro.extrato` diz isso. A lista e como refazer estão em [educacao/README.md](educacao/README.md).
- **Transcrito à mão:** o Anexo 8, em PDF, e o Retrato do MEC, lido em tela, ficam em `docs/educacao/curados/`. No Anexo 8, `aplicado ÷ receita` tem de bater com o percentual do PDF. O Retrato ainda precisa de uma nova leitura na tela.
- **SIOPE de 2012 a 2019 não entrou:** os snapshots começam em 2020. Os relatórios desses anos pedem CAPTCHA, e o Painel SIOPE, que abre sem ele, foi lido em tela e não vai ao ar sem conferir. Os arquivos abertos do SIOPE, que param em 2019, também não entraram. Quando os relatórios forem baixados, entram no gráfico do mínimo, com o Fundeb de 2018 e 2019.
- **Dados pessoais:** só o relatório de remuneração do SIOPE traz nome e CPF. Nome e CPF ficam em memória, para contar cada pessoa uma vez, e só saem totais e medianas: contagem abaixo de 5 vira "menos de 5", e mediana exige 10 pessoas. O original nunca é versionado: `data/`, `*.xlsx` e `*.xls` ficam fora do git. A guarda do importador recusa registro com padrão de CPF ou campo de nome, e `pnpm extrair educacao varrer` procura nos snapshots os nomes e CPFs das planilhas e tem de dizer 0 achados.

## Consultas Betha integradas

| ID      | Nome                           | Filtro de exercício                                                 | Campos somados e conferidos                                                   |
| ------- | ------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `57153` | Receitas Orçamentárias         | `{"ano":["AAAA"]}`                                                  | `valorOrcadoAtualizado`, `valorArrecadadoNoMes`                               |
| `57140` | Execução Detalhada de Despesas | `{"anoExercicio":["AAAA"]}`                                         | `valorEmpenho`, `valorLiquidadoEmpenho`, `valorPagoEmpenho`                   |
| `57170` | Despesas Orçamentárias         | `{"ano":["AAAA"]}` (`anoExercicio` é ignorado e traz todos os anos) | `valorEmpenhadoAtualizado`, `valorLiquidadoAtualizado`, `valorPagoAtualizado` |

Cada consulta tem um esquema de filtro próprio. Ao acrescentar uma consulta, confirme o payload real no DevTools do
portal antes de implementar.

**Paginação:** sem ordenação explícita, a paginação por offset devolveu IDs repetidos no exercício corrente (2026), e
mesmo `sortBy=id` falhou em páginas de 1.000. O coletor ordena por `id` e pede até 10.000 registros por requisição
(uma página só nos volumes atuais); se houver repetição, relê tudo até 3 vezes antes de rejeitar a coleta.

## Acesso à API Betha

- O portal obtém um token anônimo por OAuth (fluxo implícito, HTTP 303). O coletor reproduz esse fluxo. O token
  fica só em memória, é renovado antes de expirar e, em caso de `401`, renovado uma única vez.
- O cabeçalho `app-context` identifica o portal de Orleans e não é uma credencial.
- São **endpoints internos observados**, sem contrato ou SLA. A autorização para uso automatizado contínuo ainda não
  foi confirmada com a Betha ou com o município. Se o acesso anônimo deixar de existir, o projeto **não** vai
  contorná-lo (nada de navegador headless nem de burlar autenticação).
- O coletor pausa entre páginas (`BETHA_PAUSA_MS`) e repete com espera exponencial em `429` e `5xx`.

## Identificação das entidades

O segmento intermediário do ID dos registros (`211:<código>:...`) identifica a entidade:

| Código | Entidade                     |
| ------ | ---------------------------- |
| `728`  | Prefeitura Municipal         |
| `319`  | Fundo Municipal de Saúde     |
| `2473` | SAMAE                        |
| `320`  | Fundação Ambiental Municipal |

Status: **inferido**. Em 2025, a soma por código reproduziu, centavo a centavo, os totais obtidos com o filtro de
entidade do portal, e os órgãos dos empenhos são coerentes com cada entidade. Ainda falta a confirmação formal no
cadastro. Fica na tabela `entidades` (coluna `status_mapeamento`), definida em `packages/db/migrations/001_inicial.sql`.
