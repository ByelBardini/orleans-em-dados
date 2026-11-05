# Fontes sem API: tutorial de download

Tudo aqui é público e gratuito, sem cadastro. Tamanhos de novembro de 2026.

## Como baixar

1. Abra a página do indicador e clique na aba do ano.
2. Baixe o link **Municípios** e, para comparar, **Brasil, regiões e UFs**.
3. Descompacte fora do repositório, ou em `data/`. O git ignora `data/`, `*.xlsx` e `*.xls`.
4. Cada zip traz `.xlsx`, `.ods` e `.txt` com o MD5. Use o `.xlsx`.
5. Filtre as linhas conforme a tabela abaixo. Os anos anteriores estão nas outras abas, com o mesmo layout.

**Filtros:** arquivo municipal, `CO_MUNICIPIO = 4211702`. Arquivo estadual, `UNIDGEO` ou `CODIGO` igual a `Brasil` ou `Santa Catarina`.

**Colunas comuns:** `NO_CATEGORIA` é a localização (Total, Urbana, Rural), e `NO_DEPENDENCIA` é a rede (Total, Federal, Estadual, Municipal, Privada, Pública). `--` é dado ausente, nunca zero. Os códigos das colunas ficam numa linha do cabeçalho, nas primeiras linhas da planilha.

## Indicadores do INEP

Páginas em [Indicadores Educacionais](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais).

| Indicador                                | Página                                                                                                                                      | Municípios                                                                                                                                     | UFs e Brasil                                                                                                                                                                                                                                                                                        | Colunas                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Abandono, reprovação, aprovação (2025)   | [abrir](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/taxas-de-rendimento-escolar)               | [32,9 MB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/tx_rend_municipios_2025.zip)                     | [377 KB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/tx_rend_brasil_regioes_ufs_2025.zip)                                                                                                                                                                   | `1_CAT_` aprovação, `2_CAT_` reprovação, `3_CAT_` abandono + `FUN_AI`, `FUN_AF`, `MED`...               |
| Evasão, repetência, promoção (2021–2022) | [abrir](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/taxas-de-transicao)                        | [16,7 MB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/taxa_transicao/tx_transicao_municipios_2021_2022.zip) | [166 KB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/taxa_transicao/tx_transicao_brasil_regioes_ufs_2021_2022.zip)                                                                                                                                               | `1_CAT1_` promoção, `CAT2` repetência, `CAT3` evasão, `CAT4` migração para EJA                          |
| Distorção idade-série (2025)             | [abrir](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/taxas-de-distorcao-idade-serie)            | [14,4 MB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/TDI_2025_MUNICIPIOS.zip)                         | [169 KB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/TDI_2025_BRASIL_REGIOES_UFS.zip)                                                                                                                                                                       | `FUN_AI_CAT_0`, `FUN_AF_CAT_0`, `MED_CAT_0`...                                                          |
| Alunos por turma (2025)                  | [abrir](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/media-de-alunos-por-turma)                 | [18,0 MB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/ATU_2025_MUNICIPIOS.zip)                         | [193 KB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/ATU_2025_BRASIL_REGIOES_UFS.zip)                                                                                                                                                                       | `CRE_CAT_0`, `PRE_CAT_0`, `FUN_AI_CAT_0`...                                                             |
| Horas-aula por dia (2025)                | [abrir](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/media-de-horas-aula-diaria)                | [14,8 MB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/HAD_2025_MUNICIPIOS.zip)                         | [157 KB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/HAD_2025_BRASIL_REGIOES_UFS.zip)                                                                                                                                                                       | Como em alunos por turma                                                                                |
| Docentes com curso superior (2025)       | [abrir](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/percentual-de-docentes-com-curso-superior) | [11,3 MB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/DSU_2025_MUNICIPIOS.zip)                         | [118 KB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/DSU_2025_BRASIL_REGIOES_UFS.zip)                                                                                                                                                                       | Conta pessoas                                                                                           |
| Adequação da formação docente (2025)     | [abrir](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/adequacao-da-formacao-docente)             | [23,6 MB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/AFD_2025_MUNICIPIOS.zip)                         | [280 KB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/AFD_2025_BRASIL_REGIOES_UF.zip)                                                                                                                                                                        | `ED_INF_CAT_1` a `5`, grupos por etapa. Conta aulas, não pessoas                                        |
| Regularidade docente (2025)              | [abrir](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/regularidade-do-corpo-docente)             | [6,0 MB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/IRD_2025_MUNICIPIOS.zip)                          | [78 KB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/IRD_2025_BRASIL_REGIOES_UFS.zip)                                                                                                                                                                        | `EDU_BAS_CAT_1` a `4`: percentual de escolas por faixa                                                  |
| Esforço docente (2025)                   | [abrir](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/esforco-docente)                           | [18,4 MB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/IED_2025_MUNICIPIOS.zip)                         | [216 KB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2025/IED_2025_BRASIL_REGIOES_UFS.zip)                                                                                                                                                                       | `FUN_CAT_1` a `6`, níveis por etapa                                                                     |
| Remuneração média de docentes (2021)     | [abrir](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/remuneracao-media-dos-docentes)            | [4,1 MB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2021/remuneracao_docentes_municipios_2021.zip)         | [128 KB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2021/remuneracao_docentes_brasil_regioes_ufs_2021.zip)                                                                                                                                                      | Base RAIS. O arquivo de UF não tem rede municipal para SC                                               |
| Nível socioeconômico (2023)              | [abrir](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/nivel-socioeconomico)                      | [11,5 MB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2023/nivel_socioeconomico/INSE_2023_municipios.xlsx)  | [estados, 153 KB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2023/nivel_socioeconomico/INSE_2023_estados.xlsx); [Brasil, 16 KB](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2023/nivel_socioeconomico/INSE_2023_brasil.xlsx) | Filtre `TP_TIPO_REDE` (2, 3 ou 5), `TP_LOCALIZACAO = 0` e, em UF, `TP_CAPITAL = 0`. Há linhas repetidas |

## Alfabetização no 2º ano

Página: [Avaliação da Alfabetização, resultados](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/avaliacao-da-alfabetizacao/resultados).

- [Municípios, 2023 a 2025, 0,5 MB](https://download.inep.gov.br/avaliacao_da_alfabetizacao/resultados/resultados_e_metas_municipios_2025_3.xlsx): filtre `CO_MUNICIPIO`. Só a rede municipal.
- [UFs e Brasil, 18 KB](https://download.inep.gov.br/avaliacao_da_alfabetizacao/resultados/resultados_e_metas_ufs_2025_v3.xlsx): filtre `SIGLA_UF` ou `NOME_UF`. Rede pública.
- Colunas: `PC_ALUNO_ALFABETIZADO_2023` a `2025`, `META_FINAL_2024` a `2030`, `PC_AVALIADOS_LP`.

## IDEB

Página: [Ideb, resultados](https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados). Dá as notas de português e matemática, o Brasil e SC na rede municipal. O índice de Orleans e de SC nas demais redes sai pela API.

- Municípios: [anos iniciais, 25,3 MB](https://download.inep.gov.br/ideb/resultados/divulgacao_anos_iniciais_municipios_2025.zip); [anos finais, 24,4 MB](https://download.inep.gov.br/ideb/resultados/divulgacao_anos_finais_municipios_2025.zip); [ensino médio, 8,5 MB](https://download.inep.gov.br/ideb/resultados/divulgacao_ensino_medio_municipios_2025.zip).
- Comparação: [regiões e UFs, 758 KB](https://download.inep.gov.br/ideb/resultados/divulgacao_regioes_ufs_ideb_2025.zip); [Brasil, 86 KB](https://download.inep.gov.br/ideb/resultados/divulgacao_brasil_ideb_2025.zip).
- Colunas: `REDE`, `VL_OBSERVADO_2005` a `2025`, `VL_INDICADOR_REND_2025`, `VL_NOTA_MATEMATICA_2025`, `VL_NOTA_PORTUGUES_2025`.

## Ensino superior

| Arquivo                                                                                                                                           | Tamanho | Filtro                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Microdados do Censo da Educação Superior 2024](https://download.inep.gov.br/microdados/microdados_censo_da_educacao_superior_2024.zip)           | 457 MB  | `MICRODADOS_CADASTRO_CURSOS_2024.CSV` com `CO_MUNICIPIO = 4211702`. `TP_DIMENSAO = 1` é presencial, e `2`, a distância. Unibave em `MICRODADOS_ED_SUP_IES_2024.CSV`, `CO_IES = 4163` |
| [IGC 2023](https://download.inep.gov.br/educacao_superior/indicadores/resultados/2023/IGC_2023.xlsx)                                              | 1,9 MB  | Código da IES `4163`                                                                                                                                                                 |
| [CPC 2023](https://download.inep.gov.br/educacao_superior/indicadores/resultados/2023/CPC_2023.xlsx)                                              | 3,1 MB  | Código do município `4211702`                                                                                                                                                        |
| [Conceito Enade 2023](https://download.inep.gov.br/educacao_superior/indicadores/resultados/2023/conceito_enade_2023.xlsx)                        | 1,5 MB  | Código do município `4211702`                                                                                                                                                        |
| [Conceito Enade Licenciaturas 2025](https://download.inep.gov.br/educacao_superior/indicadores/resultados/2025/conceito_enade_licenciaturas.xlsx) | 0,5 MB  | Código do município `4211702`                                                                                                                                                        |

Os CSV usam `;` e codificação Latin-1. Outros anos: [microdados](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-da-educacao-superior) e [indicadores de qualidade](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/indicadores-de-qualidade-da-educacao-superior). A [Sinopse](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/educacao-superior) tem 397 MB e não foi usada.

## ENEM

Página: [Microdados do Enem](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enem).

- [2025, 1,04 GB](https://download.inep.gov.br/microdados/microdados_enem_2025.zip) e [2024, 526 MB](https://download.inep.gov.br/microdados/microdados_enem_2024.zip). Descompactados, passam de 2 GB cada.
- `RESULTADOS_2025.csv`: `CO_MUNICIPIO_ESC`, `TP_DEPENDENCIA_ADM_ESC`, `CO_MUNICIPIO_PROVA`, `NU_NOTA_CN`, `NU_NOTA_CH`, `NU_NOTA_LC`, `NU_NOTA_MT`, `NU_NOTA_REDACAO`.
- `PARTICIPANTES_2025.csv`: perfil por município da prova. **Não liga** com as notas.
- A [Sinopse, 2,1 MB](https://download.inep.gov.br/informacoes_estatisticas/sinopses_estatisticas/sinopses_enem/2025/sinopse_enem_2025.zip), para em estados.
- Os arquivos têm respostas por participante: leia em fluxo, guarde só totais.

## SIOPE

Página: [Relatórios Municipais](https://www.gov.br/fnde/pt-br/assuntos/sistemas/siope/relatorios-municipais). Os relatórios têm reCAPTCHA, então uma pessoa precisa consultar.

| Relatório                                                                                                       | Escolha                                                   | O que traz                                                             |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| [Indicadores](https://www.fnde.gov.br/siope/indicadoresFinanceirosEEducacionais.do)                             | Santa Catarina, Orleans e o ano; exporte em CSV           | Índices legais, investimento por aluno                                 |
| [RREO](https://www.fnde.gov.br/siope/relatorioRREOMunicipal2006.do)                                             | Ano, período Anual, Santa Catarina, Orleans; salve em PDF | Anexo 8, o detalhe dos gastos em educação                              |
| [Remuneração](https://www.fnde.gov.br/siope/consultarRemuneracaoMunicipal.do)                                   | Santa Catarina, Orleans, ano, mês TODOS; exporte em CSV   | **Nome, CPF parcial e salário por pessoa.** Nunca versionar o original |
| [Cumprimento dos indicadores](https://www.fnde.gov.br/siope/situacaoCumprimentoIndicadores.do?esfera=MUNICIPAL) | Municipal, Santa Catarina, Orleans, ano                   | Situação legal do ano. Não usado                                       |

**[Painel SIOPE](https://www.gov.br/fnde/pt-br/assuntos/sistemas/siope/painel-siope), sem CAPTCHA:** clique no funil, escolha a UF Santa Catarina, digite `ORLEANS` em Município, tecle Enter e marque. Na aba **Ind 1.2**, refaça o filtro, ou ela mostra a média de SC. Use só para o índice de 25% de 2012 a 2019: a coluna de Fundeb diverge do relatório.

Os [arquivos abertos](https://www.gov.br/fnde/pt-br/assuntos/sistemas/siope/arquivos-dados-analiticos) param em 2019, e o de indicadores tem cerca de 200 MB por ano.

## Demanda por creche

[Painel Retrato da Educação Infantil 2025](https://app.powerbi.com/view?r=eyJrIjoiYjFmNWU0NjItMTZiMS00MGE3LWEyNWUtMzUwNzYyZjk0MTg3IiwidCI6ImI4YzI1OTMyLTVlNzYtNGIyYi05YzUzLWQ0MTc0NWU5YzkyZCJ9) (MEC e Gaepe-Brasil, [apresentado pela Atricon](https://atricon.org.br/atualizacao-do-painel-retrato-da-educacao-infantil-no-brasil-ja-esta-disponivel/)):

1. Em **Unidade da Federação**, marque SC.
2. Em **Município**, role a lista até Orleans. Não há busca.
3. Navegue pelas 21 páginas. As principais são 1 (nível de gestão), 8 (solicitações não atendidas), 10 (quantidade), 12 (divulgação) e 13 (critérios).

Algumas páginas têm filtro próprio e voltam para "Todos". Sobre o levantamento: [página do MEC](https://www.gov.br/mec/pt-br/pnei/retrato-da-educacao-infantil-no-brasil). A obrigação de levantar a demanda está na [Lei 14.851/2024](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/L14851.htm).

## Consulta visual

O [QEdu de Orleans](https://qedu.org.br/municipio/4211702-orleans) reúne IDEB, aprendizado adequado, infraestrutura das escolas e abandono, com CSV por gráfico. Serve para conferir a olho. O número principal deve vir da fonte original.

## Depois de baixar

Deixe tudo numa pasta, com ou sem subpastas: o extrator acha pelo nome. Os relatórios do SIOPE ficam nas subpastas `indicadores/` e `remuneração/`, e o nome dos arquivos de remuneração é `Planilha*.csv`.

```bash
pnpm extrair educacao inep --origem <pasta>       # --de-extratos, se faltar arquivo municipal
pnpm extrair educacao siope --origem <pasta>
pnpm extrair educacao enem --origem <pasta>
pnpm extrair educacao superior --origem <pasta>
pnpm extrair educacao mec
pnpm extrair educacao varrer --origem <pasta>     # tem de dizer 0 achados
pnpm importar --arquivo docs/educacao/snapshots/<chave>-<ano>.json
```

Faltam os arquivos municipais de rendimento, transição, distorção, turmas, horas, docentes com superior, alfabetização e IDEB: na carga atual, Orleans veio de `docs/educacao/extratos/inep-orleans.json` nesses lotes. Baixe-os e rode de novo sem `--de-extratos` para refazer pela fonte. O Anexo 8 e o Retrato são transcritos em `docs/educacao/curados/`: ano novo entra lá, à mão.
