# Educação em Orleans: dados e fontes

Levantamento feito em novembro de 2026, que virou a base do caderno de Educação do painel. **Os dados do sistema são [`snapshots/`](snapshots/)**, gerados por `pnpm extrair educacao` e carregados com `pnpm importar --arquivo`, mais o que vem de API, de IBGE e SICONFI. Os [extratos](extratos/README.md) viraram referência de valor da primeira carga: os snapshots foram conferidos contra eles, e o sistema não os lê, salvo no caso abaixo.

## Por onde começar

| Arquivo                                  | Para quê                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| [indicadores.md](indicadores.md)         | Todos os indicadores possíveis: direto ou calculado, fórmula, fonte e último valor |
| [fontes-api.md](fontes-api.md)           | APIs usadas: URL, parâmetros, códigos e exemplos                                   |
| [fontes-download.md](fontes-download.md) | Tutorial dos arquivos sem API: onde baixar e o que filtrar                         |
| [snapshots/](snapshots/)                 | O que o sistema carrega: um `<chave>-<ano>.json` por lote                          |
| [curados/](curados/)                     | Transcrito à mão: Anexo 8 do SIOPE, em PDF, e Retrato do MEC, lido na tela         |
| [extratos/](extratos/README.md)          | Referência da primeira carga, sem informação sensível                              |
| [investigacao.md](investigacao.md)       | Como a investigação correu, o que surpreendeu e o que ficou em aberto              |

## Resumo do que temos

| Tema                                         | Fonte                          | Como se obtém         | Referência mais recente |
| -------------------------------------------- | ------------------------------ | --------------------- | ----------------------- |
| Alfabetização, frequência escolar, instrução | IBGE, Censo                    | API                   | 2022                    |
| IDEB                                         | IBGE (republica o INEP) e INEP | API e arquivo         | 2025                    |
| Matrículas, docentes, escolas                | IBGE (republica o INEP)        | API                   | 2025                    |
| Abandono, reprovação, aprovação, distorção   | INEP                           | Arquivo               | 2025                    |
| Evasão, repetência, promoção                 | INEP                           | Arquivo               | 2021–2022               |
| Alfabetização no 2º ano                      | INEP                           | Arquivo               | 2025                    |
| Formação, regularidade e esforço docente     | INEP                           | Arquivo               | 2025                    |
| Alunos por turma, horas-aula                 | INEP                           | Arquivo               | 2025                    |
| Nível socioeconômico                         | INEP                           | Arquivo               | 2023                    |
| Índice de 25% e Fundeb na remuneração        | SIOPE e SICONFI                | Relatório e API       | 2025                    |
| Investimento por aluno                       | SIOPE                          | Relatório             | 2025                    |
| Remuneração declarada, temporários           | SIOPE                          | Relatório             | foto de maio de 2026    |
| Remuneração média de docentes                | INEP (RAIS)                    | Arquivo               | 2021                    |
| Gasto com educação                           | SICONFI e Betha                | API, já no projeto    | 2025                    |
| Repasses para educação                       | Betha e TCE-SC                 | Já no projeto         | 2025                    |
| Ensino superior na cidade                    | INEP                           | Arquivo               | 2024                    |
| Notas do superior (IGC, CPC, Enade)          | INEP                           | Arquivo               | 2023 e 2025             |
| ENEM das escolas de Orleans                  | INEP                           | Arquivo, só em resumo | 2025                    |
| Demanda por creche                           | MEC, resposta do município     | Painel                | 2025                    |

Sem número público: fila de creche em quantidade, nota de ENEM por morador e infraestrutura por município em fonte direta. Detalhes em [investigacao.md](investigacao.md#o-que-ficou-em-aberto).

## Lotes em que Orleans vem de extrato

A primeira carga não tinha os arquivos municipais originais destes lotes. SC e o Brasil vêm dos arquivos do INEP, e Orleans, de `extratos/inep-orleans.json`, com `--de-extratos`. O lote registra isso em `meta.filtro`: `extrato: true` e `origemPorLugar`.

| Lote                          | Arquivo municipal que faltou                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `inep_rendimento-2025`        | `tx_rend_municipios_2025.xlsx`                                                                                                                 |
| `inep_transicao-2022`         | `TX_TRANSICAO_MUNICIPIOS_2021_2022.xlsx`                                                                                                       |
| `inep_distorcao-2025`         | `TDI_MUNICIPIOS_2025.xlsx`                                                                                                                     |
| `inep_turmas-2025`            | `ATU_MUNICIPIOS_2025.xlsx`                                                                                                                     |
| `inep_horas-2025`             | `HAD_MUNICIPIOS_2025.xlsx`                                                                                                                     |
| `inep_docentes_superior-2025` | `DSU_MUNICIPIOS_2025.xlsx`                                                                                                                     |
| `inep_alfabetizacao-2025`     | `resultados_e_metas_municipios_2025*.xlsx`                                                                                                     |
| `inep_ideb-2025`              | `divulgacao_anos_iniciais_municipios_2025.xlsx`, `divulgacao_anos_finais_municipios_2025.xlsx`, `divulgacao_ensino_medio_municipios_2025.xlsx` |

**Como refazer:**

1. Baixe os arquivos conforme [fontes-download.md](fontes-download.md) e deixe-os na pasta de origem, fora do git, junto com os demais do INEP. O extrator acha pelo nome, sem diferenciar maiúsculas.
2. Rode `pnpm extrair educacao inep --origem <pasta>`, **sem** `--de-extratos`: arquivo ausente faz o comando falhar, em vez de cair no extrato.
3. Confira `meta.filtro.extrato` igual a `false` nos lotes, e que os valores de Orleans reproduzem `extratos/inep-orleans.json`.
4. Carregue cada lote com `pnpm importar --arquivo docs/educacao/snapshots/<chave>-<ano>.json`.

## O que não entrou

- **SIOPE de 2012 a 2019:** os snapshots começam em 2020. Os relatórios desses anos têm CAPTCHA, o Painel SIOPE foi lido em tela, e o que foi lido em tela não vai ao ar sem conferir. Os arquivos abertos, que param em 2019, também não entraram. O mínimo de 25% abre em 2020 até os relatórios serem baixados.
- **SIOPE de 2026 nos indicadores:** exercício parcial não gera lote. Na remuneração, 2026 entra como a foto de maio.

## Regras

- **Rastreabilidade:** todo número aponta para uma fonte e um ano.
- **Dados pessoais:** nada de nome, CPF, número de inscrição ou valor individual. Arquivos originais ficam fora do git, e `pnpm extrair educacao varrer` tem de dizer 0 achados nos snapshots e curados.
- **Grupos pequenos:** contagem abaixo de 5 vira "menos de 5", mediana exige 10 pessoas, média do ENEM exige 2 escolas na rede, e nada é publicado por escola. Cor ou raça e deficiência de Orleans não aparecem.
- **Diferença entre fontes não é irregularidade:** vai para Discrepâncias, sem rótulo de problema.
- **Comparação rede com rede:** a média geral muda com o peso das redes em cada lugar.
- **Reais nominais:** nenhum valor foi corrigido pela inflação.
