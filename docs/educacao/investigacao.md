# Investigação

**Pergunta:** o que dá para saber sobre a educação de Orleans usando só dados públicos e rastreáveis? O levantamento foi feito em novembro de 2026, antes de qualquer código da página.

## Como correu

| Etapa                       | O que foi feito                                                               | Resultado                                                         |
| --------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. Catálogo do IBGE         | Filtrar o catálogo de agregados e testar cada tabela com Orleans              | Alfabetização, frequência e instrução do Censo 2022               |
| 2. API de pesquisas do IBGE | Testar as pesquisas usadas pela página Cidades                                | IDEB de 2005 a 2025, matrículas, docentes e escolas               |
| 3. Indicadores do INEP      | Abrir cada página e clicar nas abas de ano, porque os links só carregam assim | Abandono, evasão, distorção e outros, só em arquivo               |
| 4. SICONFI                  | Listar os anexos do RREO de Orleans                                           | Índices legais no Anexo 14. O Anexo 8 não existe lá               |
| 5. SIOPE                    | API fora do ar; relatórios com CAPTCHA; o painel abriu sem CAPTCHA            | CSV e PDF baixados à mão, e série de 2012 a 2025 do índice de 25% |
| 6. Creche                   | Procurar lista de espera no MEC, no TCE-SC e na Prefeitura                    | Só a resposta do município ao MEC, sem quantidade                 |
| 7. Superior e ENEM          | Filtrar arquivos de centenas de MB e GB por município                         | Cursos do Unibave e médias das escolas de Orleans                 |
| 8. Comparação               | Baixar os arquivos de estados e Brasil                                        | Orleans × SC × Brasil, rede com rede                              |
| 9. Limpeza                  | Agregar, retirar dados pessoais e testar                                      | Pasta [extratos](extratos/README.md)                              |

## O que surpreendeu

- **O IDEB estava no IBGE:** a API de pesquisas republica o índice, sem baixar nada do INEP. Os valores batem com o arquivo do INEP em 2023 e 2025.
- **O gasto fecha ao centavo:** em 2025, Betha, SICONFI e SIOPE dão R$ 37.481.724,75 de liquidado. Fecha também em 2021 e 2024, e em 2023 sobra 1 centavo. Em 2020 e 2022 há diferença de R$ 457.336,71 e R$ 443.952,22.
- **Os índices legais não fecham:** SIOPE e SICONFI divergem em quase todos os anos, sem causa documentada. O maior caso é o índice de educação de 2023: 27,72% × 29,06%, ou R$ 1.079.630,91.
- **Uma hipótese para 2023:** essa diferença é quase igual ao que faltou aplicar em 2021 (R$ 1.078.882,55), o que sugere que a compensação da Emenda 119/2022 entrou só no SICONFI. Não está confirmado.
- **2021 abaixo de 25%:** as duas fontes trazem 23,28%. A [Emenda 119/2022](https://www.gov.br/fnde/pt-br/assuntos/sistemas/siope/emenda-constitucional-no-119-2022) afastou as penalidades de 2020 e 2021, e o Anexo 8 de 2023 mostra a diferença complementada em 2022.
- **O painel oficial diverge do relatório oficial:** o Painel SIOPE mostra 93,71% de Fundeb na remuneração em 2025, e o relatório, 87,61%. O índice de 25% bate nos seis anos comparados.
- **Fila de creche:** a Prefeitura respondeu ao MEC "Não há demanda" em 2025, e os campos de quantidade vêm vazios. A frequência em creche é de 49,83% no Censo, o que não contradiz a resposta: nem toda família pede vaga.
- **Temporários:** a carga horária temporária do magistério declarado foi de 10,6% em 2020 para 45,4% em 2026, e a dos demais profissionais, de 18,1% para 67,2%.
- **Formação na educação infantil:** 36,9% das aulas da rede municipal são de quem tem licenciatura na área, contra 64,0% em SC.
- **Reprovação e abandono:** no 2º ano municipal, a reprovação é de 10,1%, contra 2,1% em SC. Na rede pública, o abandono no ensino médio é de 6,0%, contra 3,9%. Em compensação, as turmas são menores: 6,3 alunos por turma na creche municipal, contra 10,5.
- **Ensino superior:** o Unibave tem 1.504 matrículas presenciais em 2024, enquanto 398 moradores cursavam graduação na cidade em 2022. Os anos diferem, mas o quadro sugere alunos de fora. Dos moradores em graduação, 32,1% estudam em outro município.
- **ENEM:** o INEP tirou o município de residência em 2024 e devolveu o código da escola. Por isso, só existe o recorte de quem conclui em escolas de Orleans: 96 alunos em 2025, 48,2% da 3ª série.

## Becos sem saída

- **LDE/UFPR:** série até 2020.
- **Base dos Dados:** tem quase tudo, mas é cópia do INEP, exige conta Google e está atrasada em alfabetização.
- **QEdu:** ótimo para olhar, sem API confirmada, e bloqueia acesso automatizado.
- **Sinopses:** a do ENEM para em estados, e a do Censo Escolar tem 232 MB para algo que a API do IBGE já entrega.
- **Índice do SIOPE por API:** respondeu `500` em todas as tentativas.
- **E-MEC:** parou em verificação contra robôs. Não contornamos.

## O que ficou em aberto

- **Quantidade na fila de creche:** não há número público. Falta verificar o site da Prefeitura, que não abriu no navegador usado na pesquisa por certificado inválido.
- **Causa da diferença SIOPE × SICONFI:** só os demonstrativos não explicam.
- **Fundeb na remuneração de 2018 e 2019:** falta o relatório desses anos.
- **IDEB do Brasil:** arquivo não baixado.
- **Valor do Fundeb na remuneração de 2020:** só o percentual foi lido.
- **Séries:** abandono, reprovação e formação foram lidos só em 2025.
- **API do SIOPE:** nada confirmado com dado real.
- **ENEM por morador, infraestrutura por município:** sem fonte direta. A infraestrutura depende dos microdados do Censo Escolar.

## Decisões

- **Rede com rede:** o total de Orleans fica abaixo de SC no ENEM (544,35 × 552,13), mas as redes quase empatam (estadual 523,64 × 521,11).
- **Nada por escola:** há escolas com menos de 10 inscritos no ENEM, e o [próprio INEP encerrou o Enem por Escola](https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/enem/nota-de-esclarecimento-encerramento-do-enem-por-escola) depois da edição de 2015, por uso em rankings.
- **Declarado é declarado:** a resposta sobre creche aparece como informação do município.
- **Só agregados:** ver [extratos](extratos/README.md#dados-sensíveis).
- **Sem contornar proteções:** o CAPTCHA fica com a pessoa, e nenhum certificado inválido foi ignorado.
