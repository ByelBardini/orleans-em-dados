# Extratos

Dados de educação de Orleans já transformados, referência de valor da primeira carga. O sistema carrega [`../snapshots/`](../snapshots/), e só lê daqui com `--de-extratos` ([lista dos lotes](../README.md#lotes-em-que-orleans-vem-de-extrato)). Podem ser versionados: não têm nome, CPF, número de inscrição, credor nem valor individual. Cada JSON traz `fonte`, `gerado_em` e `regras`.

| Arquivo                   | Conteúdo                                                                                                                                      | Origem                               | Como foi gerado                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| `ibge-censo.json`         | Alfabetização, frequência, instrução, local da escola; Orleans, SC e Brasil                                                                   | API do IBGE                          | Uma consulta por bloco, com a URL dentro do arquivo                             |
| `ibge-pesquisas.json`     | IDEB de Orleans e SC; matrículas, docentes e escolas                                                                                          | API do IBGE                          | Pesquisas 40 e 13, com nomes da árvore; soma por rede no fundamental e no médio |
| `inep-orleans.json`       | Rendimento, evasão, distorção, turmas, horas, formação, regularidade, esforço, IDEB, alfabetização, remuneração de 2021, nível socioeconômico | Arquivos do INEP                     | Linhas com `CO_MUNICIPIO = 4211702`; `--` vira `null`; colunas renomeadas       |
| `inep-comparacao.json`    | Os mesmos indicadores, para SC e Brasil                                                                                                       | Arquivos do INEP                     | Linhas de `Santa Catarina` e `Brasil`, no mesmo formato. Sem IDEB               |
| `indicadores-siope.json`  | Índices legais, Fundeb por etapa, investimento por aluno, 2020–2026                                                                           | CSV do SIOPE                         | Último bimestre de cada ano; zeros não calculados viram `null`                  |
| `indices-legais.json`     | Anexo 8 × Anexo 14, diferenças, gasto total × função 12                                                                                       | PDF do SIOPE, API do SICONFI, painel | Linhas lidas do PDF; painel de 2012 a 2019 lido em tela                         |
| `remuneracao-siope.json`  | Totais por mês, pessoas, carga temporária e medianas                                                                                          | CSV do SIOPE                         | Agregação descrita abaixo                                                       |
| `betha-educacao.json`     | Gasto por ação e natureza, repasses, dedução do Fundeb                                                                                        | Snapshots de `data/`                 | Soma por nome de ação e rubrica, sem ler empenhos                               |
| `calculados.json`         | Indicadores com fórmula de [indicadores.md](../indicadores.md)                                                                                | Demais extratos e APIs               | Contas em centavos inteiros                                                     |
| `superior-orleans.json`   | Oferta presencial, total a distância, IGC, CPC, Enade                                                                                         | Arquivos do INEP                     | `CO_MUNICIPIO = 4211702`; a distância só em total                               |
| `enem-orleans.json`       | Inscritos, presentes e médias por rede; Orleans, SC e Brasil                                                                                  | Microdados do INEP                   | Soma em fluxo das 9 milhões de linhas; nenhuma linha guardada                   |
| `creche-retrato-mec.json` | Respostas de Orleans ao Retrato 2025                                                                                                          | Painel do MEC                        | Transcrito da tela                                                              |

## Dados sensíveis

Só o relatório de remuneração do SIOPE traz dados pessoais: nome, CPF parcial e salário por pessoa.

1. Nome e CPF servem apenas em memória, para contar cada pessoa uma vez.
2. Só saem totais e medianas por tipo de profissional. Escola, segmento e valores individuais ficam de fora.
3. Contagem abaixo de 5 vira `menos de 5`, e mediana exige 10 pessoas.
4. A soma de cada ano é conferida com a linha de total da própria planilha.

O teste final procurou nesta pasta todos os 624 nomes e 612 CPFs das planilhas, além dos dois primeiros nomes de cada pessoa e do padrão de CPF, sem nenhum achado. Os microdados do ENEM são anonimizados pelo INEP, mas têm respostas por participante, então também só saem agregados, sem nada por escola.

## Limites

- Os scripts de extração foram avulsos e não estão no repositório. Quando a página for planejada, os importadores substituem estes arquivos.
- Os arquivos originais não são versionados. Para refazer, siga [fontes-download.md](../fontes-download.md).
- Valores lidos em tela precisam de conferência antes de publicar: Painel SIOPE, de 2012 a 2019, e Retrato do MEC.
