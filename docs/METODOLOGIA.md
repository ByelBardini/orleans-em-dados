# Metodologia

## O que o painel exibe

O número principal é só a parte conferida entre as fontes. Quem mantém as coletas continua com o dado bruto intacto.

| Rótulo na tela                    | O que significa                                                                                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conferido com o TCE-SC`          | O valor que as duas fontes registram, ao centavo. Receita por entidade, natureza de 8 dígitos e mês; despesa por entidade; lista de empenhos, um a um.                                  |
| `conferido com a Betha até DD/MM` | Ano em curso: a despesa vem do TCE-SC, nos empenhos com par na Betha até o último dado que o Tribunal recebeu.                                                                          |
| `conferido com a Betha`           | Sem data: o gasto com educação de um exercício encerrado. A função 12 da DCA é igual, ao centavo, à soma das ações de educação na Betha 57170, nas três etapas. Só o total é conferido. |
| `fonte única, sem conferência`    | Orçamento e órgão (Betha), Câmara (TCE-SC), cada função da despesa (SICONFI), os dados do IBGE e, na educação, INEP, SIOPE e MEC: não há com o que comparar. A Câmara fica à parte.     |
| `aguardando TCE`                  | Mês que o Tribunal ainda não recebeu. É pendência de remessa: o valor entra no conferido quando a remessa chegar.                                                                       |

- **Receita:** só a diferença sai. Se as fontes têm o mesmo sinal, o conferido é o valor de menor módulo; com sinais opostos, ou com a linha em uma fonte só, é zero.
- **A conta aparece sempre ao lado:** conferido + em discrepância (+ aguardando) = total da fonte. O conferido pode ficar abaixo de cada fonte.
- **Despesa encerrada:** vale a 57170 se fecha com o TCE-SC nas três etapas. Se a diferença é igual à soma das linhas de modalidade 71 nas três etapas, vale o valor sem essas linhas. Fora disso, a entidade fica sem número, fora da soma, e vai para a seção.
- **Lista de empenhos:** só os casados 1:1 entre as fontes, com identificação e órgão da 57140, e liquidado e pago do TCE-SC.
- **Tabela de rubricas:** 14 dígitos quando todos os meses batem; natureza com mês divergente fica em 8 dígitos, sem rateio.

Igualdade entre as fontes não é auditoria nem homologação contábil: mostra que as duas publicam o mesmo número.

### Despesa por função e dados do IBGE

- **Despesa por função (SICONFI, DCA Anexo I-E):** o total sem a Câmara é comparado com o TCE-SC nas três etapas. Quando fecha, leva `conferido com o TCE-SC`. Num ano sem coleta do Tribunal, leva fonte única, e os anos de 2018 a 2023 estão assim. Com diferença, o valor de cada fonte vai para a seção Discrepâncias.
- **Cada função é fonte única:** função não é entidade, e igualdade do total não confere cada função. Saneamento 2024 difere do SAMAE no TCE-SC. A função 12, Educação, é a única com par: quando é igual à soma das ações de educação na Betha, nas três etapas, leva `conferido com a Betha`, em Para onde vai e no caderno de Educação.
- **A Câmara fica à parte:** a função Legislativa fica fora do total e da participação, como na aba Despesas.
- **Só exercícios encerrados:** a DCA é entregue até 30 de abril do ano seguinte. O RREO do ano em curso não fecha com a DCA em 2025, sem causa demonstrada, e não é usado na despesa. Do RREO, só o Anexo 14 do 6º bimestre entra, nos índices de educação.
- **Valores nominais:** o número principal é sempre o nominal, o que confere com as fontes. A comparação entre anos usa a participação no total.
- **Correção pela inflação (só na aba Dinheiro da Educação):** o gasto com educação e o investimento por aluno também podem ser vistos em reais do último ano completo do IPCA. A conta divide pela média dos 12 números-índice de cada ano (IBGE, tabela 1737) e multiplica pela média do ano-base, como o Tesouro faz com fluxos anuais. Ano sem os 12 meses publicados fica sem correção. O crescimento real compara o primeiro e o último ano corrigidos.
- **Leitura:** gastar mais numa área não prova serviço melhor. A função Educação não é o índice constitucional de educação.
- **IBGE:** população, território, situação do domicílio, pirâmide etária, rendimento e PIB são fonte única. Na coleta, as partes são conferidas com o total da própria tabela. Cada número traz o próprio ano.
- **Comparação com Santa Catarina e Brasil:** Conheça Orleans usa as mesmas tabelas e o mesmo ano nos três lugares, e diz quanto cada número está acima ou abaixo: em percentual, ou em pontos quando já é percentual. Verde e vermelho só aparecem no dinheiro (rendimento e PIB per capita), onde mais é melhor; densidade, área urbana, crescimento e idade ficam sem cor, porque ficar acima ou abaixo não é bom nem ruim por si só. O número do estado e o do país valem para todos os moradores juntos: não são a média simples dos municípios, em que uma cidade pequena pesaria tanto quanto a capital.
- **Divisor:** valor por morador e PIB per capita usam a estimativa ou o censo do próprio ano, senão o anterior mais próximo, e o texto diz qual. O PIB per capita de 2023 divide pelo Censo 2022, porque o IBGE não estimou 2023. O número é calculado aqui, não copiado, e coincide com o publicado: em Orleans, R$ 59.547,10 no indicador 47001 do IBGE; Santa Catarina dá R$ 67.459,74, e o Brasil, R$ 53.886,67, os mesmos noticiados na divulgação das Contas Regionais. Conferido à mão em 02/11/2026. De 2011 a 2022, Orleans difere do indicador em até 1 centavo, por arredondamento; em 2010, em R$ 2,51, com o Censo 2010 como divisor.
- **Dois números do Brasil:** as Contas Nacionais do IBGE (tabela 6784) publicam R$ 51.693,92 de PIB per capita em 2023, com o mesmo PIB e 211,7 milhões de moradores. Com o Censo 2022, 203,1 milhões, a conta dá R$ 53.886,67. O painel compara com este, porque Orleans também divide pelo Censo; contra o outro, Orleans ficaria 15,2% acima, em vez de 10,5%.
- **Composição do PIB:** cada ano tem a sua. Enquanto o IBGE só publica o total dos anos seguintes, a tela mostra a composição do último ano publicado com o total daquele ano, e diz que ela não descreve o ano mais recente.
- **PIB per capita não é renda:** divide pela população tudo o que é produzido na cidade, e pode refletir uma atividade concentrada. O rendimento domiciliar do Censo aparece ao lado.

### Educação

O caderno de Educação tem sete abas e compara Orleans com Santa Catarina e o Brasil. Não usa o filtro de exercício: cada número traz o próprio ano. O selo fica no título de cada bloco.

| Número                                                                                 | Fonte                                  | Comparado com                                | Selo                                                                                     |
| -------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Gasto com educação (função 12)                                                         | SICONFI, DCA Anexo I-E                 | Betha 57170, soma das ações, nas três etapas | `conferido com a Betha` onde fecha ao centavo; fonte única nos anos sem coleta da Betha  |
| Gasto por ação e por natureza                                                          | Betha 57170                            | —                                            | Fonte única: só o total é conferido                                                      |
| Índice de 25% e Fundeb na remuneração                                                  | SIOPE, Anexo 8 e Indicadores           | SICONFI, RREO Anexo 14                       | Fonte única, com aviso quando o valor difere. Igualdade do percentual não confere        |
| Repasses (Fundeb e outros)                                                             | Betha 57153, receita conferida         | TCE-SC, a mesma conferência da receita       | `conferido com o TCE-SC`; rubrica fora do conferido não sai como número                  |
| Contribuição e resultado do Fundeb                                                     | SIOPE, Anexo 8                         | Contribuição × dedução no TCE-SC             | Fonte única no resultado; contribuição conferida onde coincide                           |
| Investimento por aluno, remuneração declarada, temporários                             | SIOPE                                  | —                                            | Fonte única. Educação básica de 2022 e 2023 não sai: o SIOPE não recomenda esses valores |
| Rendimento, transição, distorção, turmas, horas, formação, INSE, ENEM, ensino superior | INEP                                   | —                                            | Fonte única                                                                              |
| IDEB, matrículas, docentes, escolas                                                    | IBGE, pesquisas 40 e 13                | Não conta: o IBGE republica o INEP           | Fonte única                                                                              |
| Alfabetização, frequência, instrução, local da escola                                  | IBGE, Censo                            | Partes = total, na coleta                    | Fonte única                                                                              |
| Procura por creche                                                                     | MEC, Retrato da Educação Infantil 2025 | —                                            | Fonte única, sempre com "a Prefeitura informou ao MEC"                                   |

- **Rede:** é quem mantém a escola: municipal, estadual, federal, privada. A pública soma municipal, estadual e federal, e `todas` junta pública e privada. No nível socioeconômico, a pública é só estadual e municipal (código 5 da fonte). O caderno abre na rede pública e compara rede com rede, porque a média geral muda com o peso de cada rede em cada lugar. O que a fonte não abre por rede, como o Censo, fica em `todas`.
- **Como termina o ano:** aprovação, o aluno termina o ano e passa para a série seguinte; reprovação, termina o ano, mas não passa; abandono, sai da escola durante o ano; evasão, não se matricula no ano seguinte. As três primeiras são do mesmo ano e somam perto de 100%, conferido na carga com tolerância de 0,2. A evasão vem das taxas de transição, cujo dado mais recente é 2021–2022: é de outro período e não se soma às outras. "Cerca de N de M" é taxa × matrículas da série e da rede, e vem com o aviso de que é um ano só.
- **IDEB:** junta a nota da prova e a aprovação, numa escala de 0 a 10, e sai a cada dois anos. A série de Orleans e de Santa Catarina vem do IBGE, e a do Brasil, do arquivo do INEP. Ano sem dado é lacuna, nunca zero, e "o melhor da série" só aparece quando é verdade na rede escolhida.
- **Meta nacional × dado:** a linha de meta vem do PNE, [Lei 15.388/2026](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/L15388.htm). De 0 a 3 anos: toda a demanda manifesta por creche e, em nível nacional, ao menos 60% das crianças, até o fim da vigência. De 4 e 5 anos: pré-escola universal até o 2º ano de vigência. De 6 a 17 anos: acesso universal à escola até o 3º ano de vigência, uma meta só, com a linha nas faixas de 6 a 14 e de 15 a 17. De 18 a 24, sem linha. A meta é nacional, e o dado de frequência é do Censo 2022, anterior à lei.
- **Declarado × medido:** medido é o que sai de censo, prova ou levantamento nacional do IBGE e do INEP. Declarado é o que a Prefeitura informa, sem contagem de fora: a resposta ao Retrato do MEC e a remuneração no SIOPE. Por isso, a resposta sobre creche sempre leva "a Prefeitura informou ao MEC", e a remuneração, "entre os profissionais declarados". A quantidade na fila de creche não tem número público: é sem dado, nunca zero.
- **O que não é publicado:** nada por escola; contagem abaixo de 5 pessoas sai como "menos de 5"; mediana com menos de 10 pessoas fica nula; cor ou raça e deficiência de Orleans não aparecem, porque os grupos são pequenos; média do ENEM de rede com menos de 2 escolas não sai, nem a linha que permitiria deduzi-la. Nome, CPF, número de inscrição e valor individual nunca entram no banco nem nos snapshots.
- **Dinheiro:** reais nominais e só exercício encerrado; o SIOPE de 2026, parcial, não aparece. Na remuneração, cada ano é a foto de maio, e 2026 vai rotulado assim. O mínimo de 25% abre em 2020: os relatórios do SIOPE de 2012 a 2019 ainda não entraram. A conta do Fundeb é recebido − contribuição = resultado, e o que não fecha fica como diferença na conta, sem afirmar causa.
- **SIOPE × SICONFI:** o SIOPE é o número principal, e o valor que difere vai para o bloco Educação de Discrepâncias, com o de cada fonte, independente do filtro de ano e fora da conta do ano. Os demonstrativos não explicam a diferença, e a tela não dá hipótese de causa.
- **Leitura:** gastar mais não prova ensino melhor, e moradores (Censo) e oferta de faculdade (Censo da Educação Superior) não se somam.

### Seção Discrepâncias

Cada valor retirado aparece em `#discrepancias` (`#conferencia` continua abrindo), por área e tipo, com o valor de cada fonte, a diferença e o lado que registra mais. Receita, despesa e empenhos não se somam. Cada caso tem uma situação:

- **Confirmado no portal em DD/MM/AAAA:** conferido à mão; o registro fica em `packages/db/src/conferencia/conferencias-manuais.ts`.
- **Confirmado em parte:** só um exemplo foi conferido à mão, e a evidência diz qual.
- **Calculado (provável):** o tipo vem do padrão dos números; ninguém conferiu no portal.
- **Rever:** foi conferido à mão, e o valor mudou depois.

A seção explica essas situações antes dos casos, e nunca leva nome de credor nem histórico.

## Coleta e conferência com o totalizador

1. Busca a primeira página e registra `totalHits`, que é a **quantidade de linhas**, e não um valor financeiro.
2. Pagina até capturar todos os registros. Se `totalHits` mudar durante a coleta, o snapshot é invalidado.
3. Verifica se os IDs são únicos.
4. Soma os campos monetários em **centavos inteiros**, preservando valores negativos. Campos ausentes são contados e
   não são tratados como zero.
5. Busca os `/totalizadores` com **o mesmo filtro** e compara campo a campo.
6. Grava no banco, numa única transação, a coleta, os totalizadores, os registros brutos (JSONB) e a versão
   normalizada. A normalização é feita em SQL a partir do bruto, convertendo os valores direto para `NUMERIC`.
7. Se tudo bateu (status `totalizador_conciliado`), a coleta passa a ser a **publicada** para aquele ano. Caso
   contrário, fica registrada como `rejeitado` e **a publicação anterior é mantida**.

"Conciliado com o totalizador" confirma a integridade da extração. Não confirma a contabilidade consolidada do
município nem a equivalência com TCE-SC/SICONFI.

### Resultado da coleta de 2025 (31/10/2026)

| Consulta | Registros | Campo                   | Soma = totalizador |
| -------- | --------: | ----------------------- | -----------------: |
| `57153`  |     1.469 | `valorOrcadoAtualizado` |  R$ 149.083.697,04 |
|          |           | `valorArrecadadoNoMes`  |  R$ 171.092.955,92 |
| `57140`  |     9.757 | `valorEmpenho`          |  R$ 160.833.350,29 |
|          |           | `valorLiquidadoEmpenho` |  R$ 142.524.230,52 |
|          |           | `valorPagoEmpenho`      |  R$ 142.524.230,52 |

## Regras de apresentação

- **Não somar visões diferentes** da mesma execução: empenhos (`57140`), despesas por credor (`57171`) e despesa
  orçamentária (`57170`) não se somam.
- `valorEmpenho` (`57140`) é o valor **original** do empenho, e não a despesa empenhada líquida de anulações. O
  dashboard deixa isso explícito.
- Receita arrecadada é a soma de `valorArrecadadoNoMes`, com sinais. `valorArrecadadoAteMes` é acumulado e **nunca**
  é somado entre meses.
- O mês da receita é **inferido** do sufixo `_1` a `_12` do ID. A semântica ainda não foi confirmada.
- Rubricas são tratadas como texto, para preservar os zeros à esquerda.
- O painel não calcula superávit (receita − empenhos), porque isso exige o balanço orçamentário consolidado.
- A Câmara Municipal não está na seleção Betha. Todo valor indica sua abrangência.
- Uma diferença entre fontes é informação de transparência. Pode decorrer de critério, abrangência ou atualização, e
  não indica, por si só, erro nem irregularidade.

## Dado atrasado

Os importadores rodam todo dia, sobre o exercício corrente e o anterior. O painel avisa "Dado atrasado", com a data da última atualização, quando a fonte passa de dois dias sem atualizar no exercício corrente, ou de dois meses no anterior: uma rodada que falhe de madrugada não acende o aviso. Exercícios mais antigos não são atualizados automaticamente e não recebem o aviso. Enquanto isso, o painel continua mostrando o último dado publicado. Dado de periodicidade anual, como os da educação, só fica atrasado depois de dois anos.

## Níveis de confiabilidade

Conforme a seção 7.2 da [especificação](ESPECIFICACAO_TECNICA.md): `coletado` → `integridade_validada` →
`totalizador_conciliado` → `comparacao_externa_pendente` / `comparacao_externa_com_divergencia` /
`comparacao_externa_conciliada`. As coletas seguem em `totalizador_conciliado`, que confirma só a extração. O nível que
o público vê é o `conferido com o TCE-SC`, calculado número a número na consulta, sem mudar o status da coleta.
