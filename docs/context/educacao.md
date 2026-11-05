# Educação

Dados do caderno de Educação: o modelo no banco, o vocabulário comum e as fontes em snapshot. Os importadores por arquivo vivem em `packages/importadores/educacao/`; IBGE e SICONFI seguem nos próprios pacotes ([ibge.md](ibge.md), [siconfi.md](siconfi.md)). A tela está em [web.md](web.md), e as rotas, em [api.md](api.md).

## Modelo

- `educacao_valores` — contagem, taxa, nota e resposta em texto: `indicador`, `lugar`, `rede`, `etapa`, `recorte`, `periodo`, `valor` `NUMERIC(18,4)`, `texto`, `unidade`.
- `educacao_financas` — dinheiro e índice legal: `indicador`, `lugar`, `rede`, `recorte`, `periodo`, `valor` `NUMERIC(18,2)`, `percentual` `NUMERIC(7,2)`.
- Views `educacao_valores_publicados` e `educacao_financas_publicadas`. `ano` é o ano de referência do lote (o exercício, no dinheiro; 2022, na transição 2021–2022), e cada consulta × ano é um lote.
- Sem dado: `valor` nulo, nunca zero. `etapa` e `recorte` vazios são "não se aplica".

## Vocabulário

- `lugar`: `4211702` Orleans, `42` Santa Catarina, `1` Brasil.
- `rede`: `publica`, `municipal`, `estadual`, `federal`, `privada`, `todas`. A coluna `NO_DEPENDENCIA` do INEP mapeia assim: Total → `todas`, Pública → `publica`, Privada → `privada`. Só a localização Total entra.
- `etapa`: `educacao_infantil`, `creche`, `pre_escola`, `fundamental`, `anos_iniciais`, `anos_finais`, `ano_1` a `ano_9`, `multietapa`, `medio`, `serie_1` a `serie_4`, `medio_nao_seriado`, `eja`, `eja_fundamental`, `eja_medio`. São as chaves dos extratos.
- `unidade`: `%`, `alunos`, `horas`, `indice`, `nota`, `pessoas`, `escolas`, `anos`, `turmas`, `texto`, `cursos`, `vagas`, `instituicoes`, `municipios`. `pessoas` de 1 a 4 só existe como `texto` `menos de 5`: o normalizar recusa o número.

## Consultas e indicadores

| `consultas.id` | Chave                                             | Tabela              | `indicador`                                                                                                                                                     |
| -------------- | ------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 900105/900106  | `ibge_educacao_censo`, `ibge_educacao_comparacao` | `ibge_valores`      | tabelas do Censo, ver [ibge.md](ibge.md)                                                                                                                        |
| 900107         | `ibge_rede_escolar`                               | `ibge_valores`      | pesquisas 40 e 13, ver [ibge.md](ibge.md)                                                                                                                       |
| 900202         | `siconfi_indices`                                 | `educacao_financas` | `indice_educacao`, `fundeb_remuneracao` (`rede` `municipal`, `valor` aplicado, `percentual`)                                                                    |
| 900301         | `inep_rendimento`                                 | `educacao_valores`  | `aprovacao`, `reprovacao`, `abandono`                                                                                                                           |
| 900302         | `inep_transicao`                                  | `educacao_valores`  | `promocao`, `repetencia`, `evasao`, `migracao_eja` (`periodo` `2021-2022`)                                                                                      |
| 900303         | `inep_distorcao`                                  | `educacao_valores`  | `distorcao`                                                                                                                                                     |
| 900304         | `inep_turmas`                                     | `educacao_valores`  | `alunos_por_turma`                                                                                                                                              |
| 900305         | `inep_horas`                                      | `educacao_valores`  | `horas_aula`                                                                                                                                                    |
| 900306         | `inep_docentes_superior`                          | `educacao_valores`  | `docentes_superior`                                                                                                                                             |
| 900307         | `inep_adequacao`                                  | `educacao_valores`  | `adequacao`, com `recorte` `grupo_1` a `grupo_5`                                                                                                                |
| 900308         | `inep_regularidade`                               | `educacao_valores`  | `regularidade`, com `recorte` `baixa`, `media_baixa`, `media_alta`, `alta`                                                                                      |
| 900309         | `inep_esforco`                                    | `educacao_valores`  | `esforco`, com `recorte` `nivel_1` a `nivel_6`                                                                                                                  |
| 900310         | `inep_remuneracao`                                | `educacao_financas` | `remuneracao_rais`, por `recorte` conforme o arquivo                                                                                                            |
| 900311         | `inep_inse`                                       | `educacao_valores`  | `inse`                                                                                                                                                          |
| 900312         | `inep_alfabetizacao`                              | `educacao_valores`  | `alfabetizacao_2o_ano`, `alfabetizacao_meta`, `alfabetizacao_participacao`                                                                                      |
| 900313         | `inep_ideb`                                       | `educacao_valores`  | `ideb` (só o Brasil; Orleans e SC vêm do IBGE), `ideb_rendimento`, `ideb_matematica`, `ideb_portugues`, `ideb_aprovacao`                                        |
| 900314         | `inep_enem`                                       | `educacao_valores`  | `enem_inscritos`, `enem_presentes`, `enem_media_5_areas`, `enem_natureza`, `enem_humanas`, `enem_linguagens`, `enem_matematica`, `enem_redacao`, `enem_escolas` |
| 900315         | `inep_superior`                                   | `educacao_valores`  | `superior_*`: oferta presencial, perfil, por curso (`recorte` é o curso), EaD em total, docentes, IGC, CPC e Enade                                              |
| 900401         | `siope_indicadores`                               | `educacao_valores`  | percentuais `siope_<chave>`, abaixo                                                                                                                             |
| 900404         | `siope_indicadores_valores`                       | `educacao_financas` | valores `siope_<chave>`, abaixo                                                                                                                                 |
| 900402         | `siope_anexo8`                                    | `educacao_financas` | `indice_educacao`, `fundeb_remuneracao`, `gasto_total`, `fundeb_contribuicao`, `fundeb_resultado`, `receita_impostos`, `pessoal_ativo`, `capital`, `emenda_119` |
| 900403         | `siope_remuneracao`                               | `educacao_financas` | `mediana_40h`, `mediana_vencimento_40h`, `total_declarado`                                                                                                      |
| 900405         | `siope_remuneracao_carga`                         | `educacao_valores`  | `carga_temporaria`, `carga_horas`, `profissionais`, `formacao_magisterio`                                                                                       |
| 900501         | `mec_retrato`                                     | `educacao_valores`  | `retrato_<chave>`, em `texto`; `retrato_distribuicao` com `recorte` por nível de gestão entre os municípios de SC                                               |

`id_externo` é a junção de `lugar:rede:etapa:recorte:indicador:periodo` em `educacao_valores` e de `lugar:rede:recorte:indicador:periodo` em `educacao_financas`, que não tem etapa. O extrator monta, e o normalizar recusa o que não for essa junção.

## O que está gravado (contrato para as abas)

Lote é `<chave>-<ano>.json` em `docs/educacao/snapshots/`. Etapa ou recorte não citados são vazios.

**INEP, `lugar` Orleans, SC e Brasil; redes da coluna `NO_DEPENDENCIA`, só as que o arquivo traz. Orleans não tem `federal`.**

- `inep_rendimento-2025`: `aprovacao`, `reprovacao`, `abandono`; etapas `fundamental`, `anos_iniciais`, `anos_finais`, `ano_1`–`ano_9`, `medio`, `serie_1`–`serie_4`, `medio_nao_seriado`.
- `inep_transicao-2022`: `promocao`, `repetencia`, `evasao`, `migracao_eja`; `periodo` `2021-2022`; mesmas etapas, sem `serie_4` nem não seriado.
- `inep_distorcao-2025`: `distorcao`. `inep_turmas-2025`: `alunos_por_turma`, com `multietapa`. `inep_horas-2025`: `horas_aula`. As duas últimas têm também `educacao_infantil`, `creche`, `pre_escola`.
- `inep_docentes_superior-2025`: `docentes_superior`; etapas `educacao_infantil`, `creche`, `pre_escola`, `fundamental`, `anos_iniciais`, `anos_finais`, `medio`, `eja`, `eja_fundamental`, `eja_medio`.
- `inep_adequacao-2025`: `adequacao`; `recorte` `grupo_1`–`grupo_5`; etapas `educacao_infantil`, `fundamental`, `anos_iniciais`, `anos_finais`, `medio`, `eja_fundamental`, `eja_medio`.
- `inep_regularidade-2025`: `regularidade`; `recorte` `baixa`, `media_baixa`, `media_alta`, `alta`.
- `inep_esforco-2025`: `esforco`; `recorte` `nivel_1`–`nivel_6`; etapas `fundamental`, `anos_iniciais`, `anos_finais`, `medio`.
- `inep_remuneracao-2021` (`educacao_financas`): `remuneracao_rais`; `recorte` `<total|com_superior|sem_superior>:<medida>`. Medidas em reais: `primeiro_quartil`, `mediana`, `media`, `terceiro_quartil`, `media_40h`. Fora de reais, na mesma coluna `valor`: `docentes` (nulo abaixo de 5) e `carga_semanal`. `localizados_rais` fica em `percentual`. Orleans só tem `municipal`.
- `inep_inse-2023`: `inse`; recorte vazio é a média (`indice`), `alunos` é a contagem (`pessoas`), `nivel_1`–`nivel_8` são `%`. `publica` é o código 5 da fonte, estadual e municipal; o código 6, que inclui a federal, não entra. Orleans só tem a linha de localização total em `publica`.
- `inep_alfabetizacao-2025`: `alfabetizacao_2o_ano` (2023 a 2025), `alfabetizacao_meta` (`texto` `> 80` em 2030 para SC e Brasil), `alfabetizacao_participacao`; etapa `ano_2`. Orleans é `municipal`; SC e Brasil, `publica`. Orleans só tem as metas de 2024, 2025, 2026 e 2030, as do extrato.
- `inep_ideb-2025`: `ideb` (2005 a 2025, `valor` nulo onde a fonte não publica) só para o Brasil, em todas as redes (o arquivo de UFs do INEP não traz rede municipal, e a linha municipal de SC fica sem dado; na aba de anos finais do Brasil, a coluna de 2023 vem sem código, lida por posição); `ideb_rendimento`, `ideb_matematica`, `ideb_portugues`, `ideb_aprovacao` de 2025 nos três lugares; etapas `anos_iniciais`, `anos_finais`, `medio`. A série de Orleans e de SC vem do IBGE.
- `inep_enem-2024` e `-2025`: etapa `medio`; `enem_inscritos`, `enem_presentes`, `enem_media_5_areas`, `enem_natureza`, `enem_humanas`, `enem_linguagens`, `enem_matematica`, `enem_redacao` por escola de conclusão, nas redes `todas`, `publica` e cada dependência. `enem_escolas` só em Orleans. `recorte` `prova_em_orleans` é o município da prova, rede `todas`; `prova_em_orleans:escola_em_orleans`, `:escola_em_outro_municipio`, `:sem_escola` abrem `enem_inscritos`.
- `inep_superior-2024`, rede `todas`: ver abaixo.

**Ensino superior.** `superior_instituicao` e `superior_natureza` em `texto`; `superior_cursos`, `superior_vagas`, `superior_inscritos`, `superior_ingressantes`, `superior_matriculas`, `superior_concluintes`; `superior_perfil` com `recorte` `mulheres`, `noturno`, `de_18_a_24`, `escola_publica`, `prouni`, `fies`; `superior_docentes` (recorte vazio é o total; `doutores`, `mestres`, `especialistas`, `tempo_integral`), `superior_tecnicos`; `superior_ead_instituicoes`, `superior_ead_matriculas`, `superior_ead_ingressantes`. Por curso, com `recorte` `Nome (grau)`: `superior_curso_vagas`, `_ingressantes`, `_matriculas`, `_concluintes`, e `_mulheres`, `_noturno` só a partir de 10 matrículas. Avaliação, com `recorte` na área em maiúsculas: `superior_cpc_participantes`, `superior_cpc_continuo`, `superior_cpc_faixa`, `superior_enade_faixa` (2023); `superior_licenciatura_participantes`, `_proficiencia`, `_faixa` (2025). `superior_igc_continuo`, `superior_igc_faixa`, e `superior_igc_distribuicao` em SC, `recorte` `faixa_<n>`. Faixa `SC` da fonte é sem conceito: `texto`, `valor` nulo.

**SIOPE, `rede` `municipal`, Orleans, exercícios de 2020 a 2025.**

- `siope_indicadores-<ano>`: `siope_indice_educacao` (1.1), `siope_fundeb_remuneracao` (1.2), `siope_fundeb_outras_despesas` (1.3), `siope_fundeb_nao_aplicado` (1.4), `siope_fundeb_em_infantil` (2.1), `siope_fundeb_em_fundamental` (2.2), `siope_despesa_infantil` (2.4), `siope_despesa_fundamental` (2.5), `siope_educacao_na_despesa_total` (2.8).
- `siope_indicadores_valores-<ano>`: `siope_por_aluno_infantil` (4.1), `siope_por_aluno_fundamental` (4.2), `siope_por_aluno_educacao_basica` (4.8; 2022 e 2023 sem registro, porque o SIOPE não recomenda), `siope_professores_por_aluno` (4.10), `siope_nao_docentes_por_aluno` (4.11), `siope_saldo_financeiro_fundeb` (7.2), `siope_fundeb_nao_utilizado` (7.3, de 2021 em diante), `siope_educacao_valor_exigido` (8.1), `siope_educacao_valor_aplicado` (8.2).
- `siope_anexo8-<ano>`: `indice_educacao` e `fundeb_remuneracao` (recorte vazio: aplicado e `percentual`; `exigido`: valor exigido); `gasto_total` com `recorte` `dotacao`, `empenhado`, `liquidado`, `pago`, `restos_nao_processados`; `fundeb_contribuicao`, `fundeb_resultado`, `receita_impostos`, `pessoal_ativo`; `capital` com `empenhado`, `liquidado`; `emenda_119` só em 2023, com `exigido_2021`, `aplicado_2021`, `diferenca_a_menor_2021`, `complementado_em_2022`. 2020 tem outro formato: sem `fundeb_contribuicao`, `receita_impostos`, `pessoal_ativo` e `capital`, e o `fundeb_remuneracao` só traz o percentual.
- `siope_remuneracao-<ano>`, 2020 a 2026: `mediana_40h` com `recorte` `<magisterio|outros>:<todos|efetivo|temporario>`, `mediana_vencimento_40h` com `:efetivo` e `:temporario`; `periodo` `AAAA-05`, e nulo com menos de 10 pessoas. `total_declarado`, `periodo` `AAAA`, só em ano completo: 2026 não tem. Quem é efetivo e temporário no mesmo mês conta em `todos` e fica fora das duas medianas de vínculo.
- `siope_remuneracao_carga-<ano>`, 2020 a 2026, `periodo` `AAAA-05`: `carga_temporaria` (`magisterio:temporario`, `outros:temporario`), `carga_horas` (`:todos`), `profissionais` (`:todos`, `:efetivo`, `:temporario`), `formacao_magisterio` com `recorte` `licenciatura_plena`, `pedagogia`, `nivel_medio`, `nao_habilitados_autorizados`.

**MEC.** `mec_retrato-2025`, Orleans, `municipal`, em `texto`: `retrato_solicitacoes_nao_atendidas_creche`, `retrato_quantidade_na_lista_de_espera` (sem valor nem texto: não há número), `retrato_lista_unificada`, `retrato_listas_divulgadas_ao_publico`, `retrato_criterios_de_prioridade`, `retrato_idade_inicial_creche`, `retrato_criancas_fora_da_pre_escola_por_falta_de_vaga`, `retrato_nivel_de_gestao_da_demanda`. `retrato_distribuicao` em SC, `recorte` `inicial`, `elementar`, `basico`, `avancado`.

## Extratores

`pnpm extrair educacao <inep|siope|enem|superior> --origem <pasta> [--de-extratos] [--destino <pasta>]`, `pnpm extrair educacao mec` e `pnpm extrair educacao varrer --origem <pasta>`. Não tocam no banco. Geram `{ meta, registros }` com um registro por linha, passando pelo `normalizar` e pelo `validar` da consulta: lote que seria recusado não gera arquivo. Carga: `pnpm importar --arquivo <snapshot.json>`.

- `extratores/arquivos.ts`: `registrosPorCodigo` acha o cabeçalho pelos códigos das colunas e falha fora do layout; `linhasDoCsv` lê em fluxo.
- `--de-extratos`: arquivo municipal ausente faz Orleans vir de `docs/educacao/extratos/inep-orleans.json`, e `meta.filtro` traz `extrato: true` e `origemPorLugar`. Sem a opção, falha. Nesta carga vieram assim `inep_rendimento-2025`, `inep_transicao-2022`, `inep_distorcao-2025`, `inep_turmas-2025`, `inep_horas-2025`, `inep_docentes_superior-2025`, `inep_alfabetizacao-2025` e `inep_ideb-2025`.
- Curados à mão: `docs/educacao/curados/anexo8.json`, valores conferidos no PDF (o `exigido` de 2020 não está no PDF: vem do indicador 8.1), e `retrato-mec.json`, lido na tela, a reconferir.
- `varrer` procura nos snapshots e curados os nomes, os dois primeiros nomes e o miolo dos CPFs das planilhas, além do padrão de CPF. Só devolve contagens.

## Regras dos extratores

- Rede de Orleans com menos de 2 escolas no ENEM não publica nota nem inscritos e presentes; `enem_escolas` continua. Com uma só rede retida, `todas` também sai (e `publica`, se a retida for pública), para não deduzir por subtração. Em 2024 e 2025, estadual e privada têm 2 escolas cada: nada ficou retido.
- `0,00%` e `R$ 0,00` do SIOPE viram nulo, salvo em 1.4 e 7.3. Exercício com o 6º bimestre zerado é parcial e não gera lote: 2026 fica de fora dos indicadores. Painel SIOPE de 2012 a 2019 não entra.
- Anexo 8: `aplicado ÷ receita` tem de bater com o percentual do PDF, com tolerância de 0,01. Em 2020, sem a receita, a base é `exigido ÷ 25%`.
- Remuneração: pessoa é nome + CPF, só em memória; a soma das linhas tem de ser igual à linha de total da planilha. Erro diz a linha, nunca o conteúdo.
- `superior_natureza` é o `TP_CATEGORIA_ADMINISTRATIVA` do Censo: `Privada sem fins lucrativos` para o Unibave. O arquivo do IGC classifica a mesma instituição como `Comunitária/Confessional`; a tela usa só o campo do Censo.
- IGC: as faixas de SC somam 82 instituições (6, 52, 22 e 2 nas faixas 2 a 5), e a distribuição fecha.

## Armadilhas

- O leitor em fluxo do `exceljs` devolve `{ sharedString: n }` quando os textos vêm depois das abas no zip, e o modo `emit` dele não entrega os textos: `textosCompartilhados` lê a tabela direto do zip. O escritor do `exceljs` grava numa ordem que o leitor em fluxo não lê; a fábrica `planilha` dos testes monta o zip à mão.
- IDEB: nas UFs, as duas primeiras colunas não têm código, e na aba de anos iniciais a coluna de rendimento de 2025 repete o código `VL_INDICADOR_REND_2023` (lida como `#2`). Rótulos trazem nota de rodapé: `Total (4)`, `Santa Catarina*`.
- `Planilha.csv` e `Planilha (1).csv` são o mesmo relatório: mesmo ano com a mesma soma passa, com soma diferente falha.
- As colunas de parcela da Remuneração mudam de nome entre os anos (60% e 40% antes de 2021): só o `Total (a + b + c)` é exigido.
