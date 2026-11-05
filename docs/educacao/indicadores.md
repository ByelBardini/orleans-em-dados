# Catálogo de indicadores

- **Direto:** a fonte publica o número pronto.
- **Calculado:** nós calculamos, com a fórmula ao lado.
- **Valor:** último dado de Orleans, em todas as redes, salvo indicação.
- **Extrato:** arquivo em [extratos/](extratos/README.md) que guarda o dado.

Códigos de tabela em [fontes-api.md](fontes-api.md), e arquivos em [fontes-download.md](fontes-download.md).

## Alfabetização e instrução

| Indicador                               | Tipo      | Como se obtém                                          | Valor                                | Extrato        |
| --------------------------------------- | --------- | ------------------------------------------------------ | ------------------------------------ | -------------- |
| Taxa de alfabetização, 15 anos ou mais  | Direto    | IBGE 10091, variável 2513                              | 97,27% (2022)                        | `ibge-censo`   |
| Por sexo, idade, urbana e rural         | Direto    | IBGE 10091, categorias                                 | Rural 96,62%; 65 anos ou mais 92,36% | `ibge-censo`   |
| Pessoas não alfabetizadas               | Direto    | IBGE 10092, categoria 1024                             | 533                                  | `ibge-censo`   |
| Alfabetização no 2º ano                 | Direto    | INEP, rede municipal                                   | 65% (2025; meta 70%)                 | `inep-orleans` |
| Anos médios de estudo, 25 anos ou mais  | Direto    | IBGE 10062                                             | 9,7                                  | `ibge-censo`   |
| Superior completo, 25 anos ou mais      | Calculado | 10061: pessoas com superior ÷ total de 25 anos ou mais | 19,9%                                | `calculados`   |
| Médio completo ou mais                  | Calculado | 10061: (médio + superior) ÷ total de 25 anos ou mais   | 47,5%                                | `calculados`   |
| Sem instrução ou fundamental incompleto | Calculado | 10061: essa faixa ÷ total de 25 anos ou mais           | 36,3%                                | `calculados`   |

## Acesso

| Indicador                                  | Tipo      | Como se obtém                                                           | Valor                                                                | Extrato              |
| ------------------------------------------ | --------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------- |
| Frequência escolar por idade               | Direto    | IBGE 10056                                                              | 0–3: 49,83%; 4–5: 83,46%; 6–14: 96,75%; 15–17: 88,64%; 18–24: 25,12% | `ibge-censo`         |
| Frequência em 2010                         | Calculado | 1549: frequentava (364) ÷ população (93). 6–14 soma "6 anos" e "7 a 14" | 0–3: 34,3%; 15–17: 77,8%                                             | `calculados`         |
| Quem estuda, por nível                     | Direto    | IBGE 10057, 10058 e 10059                                               | 562 de 0–3 anos em creche                                            | `ibge-censo`         |
| Estudam em outro município                 | Calculado | 10324: outro município ÷ total                                          | 9,9% (510 de 5.129)                                                  | `calculados`         |
| Matrículas por etapa                       | Direto    | IBGE pesquisa 13                                                        | Creche 670; pré 614; fundamental 2.663; médio 716 (2025)             | `ibge-pesquisas`     |
| Matrículas do fundamental e médio por rede | Calculado | Pesquisa 13: soma de anos ou séries por rede                            | Fundamental: 934 municipal, 1.304 estadual, 425 privada              | `ibge-pesquisas`     |
| Demanda não atendida por creche            | Direto    | Retrato da Educação Infantil, resposta do município                     | "Não há demanda" (2025)                                              | `creche-retrato-mec` |

## Permanência

| Indicador             | Tipo   | Como se obtém               | Valor                                            | Extrato        |
| --------------------- | ------ | --------------------------- | ------------------------------------------------ | -------------- |
| Abandono              | Direto | INEP, `3_CAT_`              | Médio 5,1%; 1ª série 8,3%; fundamental 0% (2025) | `inep-orleans` |
| Reprovação            | Direto | INEP, `2_CAT_`              | Médio 7,8%; 2º ano municipal 10,1%               | `inep-orleans` |
| Aprovação             | Direto | INEP, `1_CAT_`              | Iniciais 97,8%; finais 96,5%; médio 87,1%        | `inep-orleans` |
| Evasão                | Direto | INEP, `1_CAT3_`             | Fundamental 2,0%; médio 8,6% (2021–2022)         | `inep-orleans` |
| Repetência e promoção | Direto | INEP, `1_CAT2_` e `1_CAT1_` | Médio: 8,5% e 82,5%                              | `inep-orleans` |
| Distorção idade-série | Direto | INEP, `_CAT_0`              | Iniciais 5,2%; finais 14,5%; médio 16,6%         | `inep-orleans` |

Abandono é sair durante o ano. Evasão é não se matricular no ano seguinte.

## Aprendizado

| Indicador                                       | Tipo      | Como se obtém                                               | Valor                                          | Extrato          |
| ----------------------------------------------- | --------- | ----------------------------------------------------------- | ---------------------------------------------- | ---------------- |
| IDEB, rede pública                              | Direto    | IBGE pesquisa 40, ou INEP                                   | Iniciais 6,6; finais 5,3; médio 3,9 (2025)     | `ibge-pesquisas` |
| IDEB por rede                                   | Direto    | Idem                                                        | Municipal: 6,4 e 5,1. Estadual: 6,7, 5,3 e 3,9 | `inep-orleans`   |
| Notas de português e matemática                 | Direto    | INEP, `VL_NOTA_`                                            | Pública, iniciais: 229,60 e 242,16             | `inep-orleans`   |
| Indicador de rendimento do IDEB                 | Direto    | INEP, `VL_INDICADOR_REND_`                                  | 0,97; 0,96; 0,84                               | `inep-orleans`   |
| Nível socioeconômico                            | Direto    | INEP, média do estrato                                      | 5,58 (2023). SC 5,50; Brasil 4,92              | `inep-orleans`   |
| ENEM: inscritos e presentes, escolas de Orleans | Calculado | Contagem por `CO_MUNICIPIO_ESC`                             | 134 e 96 (2025)                                | `enem-orleans`   |
| ENEM: média por área e rede                     | Calculado | Média das notas de quem tem nota na área                    | Redação 617,14; matemática 527,38              | `enem-orleans`   |
| ENEM: média das cinco áreas                     | Calculado | Média de quem esteve nas quatro provas e tem as cinco notas | 544,35. Estadual 523,64; privada 614,02        | `enem-orleans`   |
| ENEM: presentes ÷ 3ª série                      | Calculado | Presentes nas quatro provas ÷ matrículas da 3ª série (IBGE) | 48,2%                                          | `calculados`     |

## Professores e turmas

| Indicador                       | Tipo      | Como se obtém                                      | Valor                                                           | Extrato             |
| ------------------------------- | --------- | -------------------------------------------------- | --------------------------------------------------------------- | ------------------- |
| Aulas com licenciatura na área  | Direto    | INEP, adequação, grupo 1                           | Infantil municipal 36,9%; SC 64,0%                              | `inep-orleans`      |
| Aulas de quem não tem superior  | Direto    | INEP, adequação, grupo 5                           | Infantil municipal 19,4%; SC 5,5%                               | `inep-orleans`      |
| Docentes com curso superior     | Direto    | INEP, `_CAT_0`                                     | Infantil 81,9%; fundamental 89,9%; médio 91,7%                  | `inep-orleans`      |
| Regularidade docente            | Direto    | INEP, percentual de escolas por faixa              | Municipal: 21,4% baixa; 78,6% média-baixa                       | `inep-orleans`      |
| Esforço docente                 | Direto    | INEP, níveis 1 a 6                                 | Fundamental, níveis 5 e 6: 12,1%                                | `inep-orleans`      |
| Carga horária temporária        | Calculado | SIOPE, maio: horas de temporários ÷ horas totais   | Magistério: 10,6% (2020) → 45,4% (2026)                         | `remuneracao-siope` |
| Mediana de remuneração por 40 h | Calculado | SIOPE, maio: total da pessoa ÷ horas × 40, mediana | Efetivo R$ 6.606,76; temporário R$ 6.156,76 (2026)              | `remuneracao-siope` |
| Remuneração média por 40 h      | Direto    | INEP e RAIS, rede municipal                        | R$ 3.944,98 (2021)                                              | `inep-orleans`      |
| Alunos por turma                | Direto    | INEP, `_CAT_0`                                     | Creche municipal 6,3; iniciais municipal 15,8                   | `inep-orleans`      |
| Horas-aula por dia              | Direto    | INEP, `_CAT_0`                                     | Creche municipal 9,4; iniciais municipal 4,2                    | `inep-orleans`      |
| Docentes e escolas              | Direto    | IBGE pesquisa 13                                   | Fundamental: 189 docentes, 13 escolas (2025)                    | `ibge-pesquisas`    |
| Alunos por docente, municipal   | Calculado | Pesquisa 13: matrículas ÷ docentes da etapa e rede | Creche 11,8; pré 11,0. Docente pode contar em mais de uma etapa | `calculados`        |

## Financiamento

| Indicador                                | Tipo      | Como se obtém                                                  | Valor                                           | Extrato             |
| ---------------------------------------- | --------- | -------------------------------------------------------------- | ----------------------------------------------- | ------------------- |
| Índice de 25% em educação                | Direto    | SIOPE, indicador 1.1 ou Anexo 8. SICONFI, Anexo 14             | 28,63% e 28,31% (2025)                          | `indices-legais`    |
| Fundeb na remuneração                    | Direto    | SIOPE, indicador 1.2 ou Anexo 8. SICONFI, Anexo 14             | 87,61% e 87,27%                                 | `indices-legais`    |
| Fundeb em outras despesas e não aplicado | Direto    | SIOPE, indicadores 1.3 e 1.4                                   | 15,31% e 0,61%                                  | `indicadores-siope` |
| Diferença SIOPE × SICONFI                | Calculado | Valor aplicado no Anexo 14 − Anexo 8                           | 2023: R$ 1.079.630,91                           | `indices-legais`    |
| Resultado do Fundeb                      | Direto    | Anexo 8, linha 7: principal recebido − contribuição            | +R$ 1.435.438,97                                | `indices-legais`    |
| Investimento por aluno                   | Direto    | SIOPE, indicadores 4.1 e 4.2                                   | Infantil R$ 13.181,18; fundamental R$ 21.028,24 | `indicadores-siope` |
| Despesa com professores por aluno        | Direto    | SIOPE, indicador 4.10                                          | R$ 7.943,92                                     | `indicadores-siope` |
| Gasto com educação                       | Direto    | SICONFI, função 12. Em 2024 e 2025, igual à Betha e ao Anexo 8 | R$ 37.481.724,75 liquidado (2025)               | `indices-legais`    |
| Participação no total                    | Calculado | Função 12 ÷ (total − função 01, a Câmara)                      | 25,6%                                           | `calculados`        |
| Gasto por morador                        | Calculado | Função 12 ÷ população do ano                                   | R$ 1.518,34                                     | `calculados`        |
| Infantil × fundamental                   | Calculado | Subfunção ÷ função 12                                          | 39,6% e 54,9%. Em 2018: 25,2% e 69,3%           | `calculados`        |
| Gasto por ação                           | Direto    | Betha 57170, soma por nome da ação                             | Transporte R$ 3,95 mi; merenda R$ 1,65 mi       | `betha-educacao`    |
| Pessoal, custeio, investimento           | Calculado | Betha 57170: natureza 31, 33 e 44 ÷ total das ações            | 68,3%, 31,2% e 0,5%                             | `calculados`        |
| Repasses                                 | Direto    | Betha, por rubrica                                             | Fundeb R$ 17,45 mi; salário-educação R$ 1,07 mi | `betha-educacao`    |
| Repasse específico ÷ gasto               | Calculado | (Estado + PNATE) ÷ transporte; PNAE ÷ merenda                  | 35,5% e 20,1%. Mostrar lado a lado, sem somar   | `calculados`        |
| Gasto por matrícula municipal            | Calculado | Subfunção ÷ matrículas municipais da etapa                     | R$ 19.133,09. Conferência: preferir o oficial   | `calculados`        |

## Ensino superior

| Indicador                                    | Tipo      | Como se obtém                       | Valor                                                             | Extrato            |
| -------------------------------------------- | --------- | ----------------------------------- | ----------------------------------------------------------------- | ------------------ |
| Moradores em graduação                       | Direto    | IBGE 10324                          | 585; 398 em Orleans (2022)                                        | `ibge-censo`       |
| Moradores em graduação fora                  | Calculado | 10324: outro município ÷ total      | 32,1%. SC 26,9%; Brasil 27,2%                                     | `calculados`       |
| Matrículas, vagas, ingressantes, concluintes | Direto    | INEP, cursos presenciais em Orleans | 1.504; 998; 551; 209 (2024)                                       | `superior-orleans` |
| Por curso                                    | Direto    | Idem, por `NO_CURSO`                | Direito 233; Sistemas de Informação 186                           | `superior-orleans` |
| Perfil dos alunos                            | Calculado | Campo ÷ matrículas                  | Noturno 88,0%; mulheres 60,4%; escola pública 71,7%; Prouni 22,6% | `calculados`       |
| Docentes do Unibave                          | Direto    | INEP, IES                           | 160: 45 doutores, 73 mestres                                      | `superior-orleans` |
| IGC, CPC e Enade                             | Direto    | INEP                                | IGC 3 (2023)                                                      | `superior-orleans` |
| Auxílio universitário                        | Direto    | SICONFI 12.364; Betha, mesma ação   | R$ 399.200 (2025)                                                 | `calculados`       |

Moradores e oferta não se somam: um conta quem mora em Orleans, o outro, quem estuda na cidade.

## Dá para fazer, ainda não extraído

| Indicador                                | Como                                              |
| ---------------------------------------- | ------------------------------------------------- |
| Série de abandono, reprovação e formação | Mesmos arquivos do INEP, outras abas de ano       |
| Infraestrutura das escolas               | Microdados do Censo Escolar; o QEdu mostra pronto |
| Alfabetização de 2010 em 15 anos ou mais | IBGE 1379, somando idades                         |
| Fundeb na remuneração de 2018 e 2019     | Relatório de Indicadores do SIOPE                 |

## Cuidados de leitura

- **Declarado × medido:** a resposta sobre creche é do próprio município. Na tela: "a Prefeitura informou ao MEC".
- **Poucas pessoas:** 10,1% de reprovação no 2º ano municipal são cerca de 18 de 177 alunos. Um ano só não é tendência.
- **Aulas × pessoas:** adequação docente conta aulas, e docentes com superior conta pessoas.
- **Redes:** o ensino médio público de Orleans é do Estado, então não mede a Prefeitura.
- **Prova voluntária:** cerca de metade da 3ª série fez todas as provas do ENEM.
- **Comparação de alfabetização:** Orleans é rede municipal; SC e Brasil são rede pública.
