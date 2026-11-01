# Conferência Betha × TCE-SC: manter as duas fontes ou trocar?

> Data: 01/11/2026 · Exercícios: 2024 (encerrado), 2025 (encerrado) e 2026 (em curso).
> Reproduzir: `npm run coletar -- --ano AAAA && npm run coletar:tcesc -- --ano AAAA && npm run conferir -- --ano AAAA --json`
> (resultado completo em `data/conferencias/AAAA.json`).

## Resposta curta

**Manter as duas, com papéis diferentes. A conferência compensa: com custo baixo, ela encontrou
erros reais nos dados da Betha que o dashboard atual exibe sem perceber.**

- As fontes são **a mesma contabilidade**: em 2025, 9.738 empenhos casam um a um, e a
  despesa por entidade bate **ao centavo** nas três etapas. Isso responde se o TCE é confiável
  como referência: é.
- Mas **não são cópias perfeitas**. Em todos os anos testados apareceram divergências
  concentradas e explicáveis (duplicidades na Betha, rubricas ausentes, renumeração no SAMAE).
  Elas só aparecem quando há uma segunda fonte.
- **Trocar tudo pelo TCE perderia** o ano corrente (o TCE está cerca de 1 mês atrás), o
  orçamento atualizado por rubrica e o órgão/secretaria dos empenhos.
- **Ficar só com a Betha perderia** a Câmara Municipal e a única forma de detectar quando o
  portal publica algo errado.

O custo de manter as duas é menor do que o relatório de investigação previa: o coletor TCE não
precisa de autenticação, exportação CSV nem cookies. Ele monta hipercubos próprios na API do Qlik
e roda em segundos.

## O que foi feito

1. **Coletor TCE-SC** (`collectors/tcesc/`): sessão anônima na Qlik Engine API, seleção
   conferida de município e exercício, hipercubos próprios e conciliação da soma das linhas com
   o total do motor. Duas consultas:
   - receitas por unidade × natureza × mês;
   - **empenho a empenho** (9.877 em 2025, inclusive a Câmara).
2. **Betha `57170`** (despesa orçamentária atualizada) integrada. Filtro confirmado: `{"ano": [...]}`.
3. **Correção no coletor Betha:** a paginação sem ordenação devolvia IDs repetidos no ano
   corrente. A 57140 de 2026 era rejeitada sempre, e 2025 só funcionou por acaso.
4. **`npm run conferir`**: compara as coletas publicadas por entidade, mês, natureza e empenho.
5. Coleta e conferência de 2024, 2025 e 2026 nas duas fontes. Todas as 15 coletas foram
   conciliadas internamente com o totalizador da própria fonte.

## Resultados

### Despesa por entidade (Betha 57170 × TCE por unidade gestora)

| Exercício | Prefeitura | FMS | SAMAE | Fundação Ambiental | Câmara (só TCE) |
|---|---|---|---|---|---:|
| 2024 | igual | igual | **Betha +R$ 123.887,32** | igual | R$ 2.718.927,41 |
| 2025 | igual | igual | igual | igual | R$ 2.981.800,76 |
| 2026 até 30/09 | — | — | — | — | R$ 2.560.486,37 |

"Igual" significa empenhado, liquidado e pago idênticos ao centavo. Em 2025, o UG 1864 do TCE
(Câmara) confirma **diretamente** o valor que antes era só inferido por diferença. Betha (4
entidades) + Câmara = total TCE, sem dupla contagem.

### Receita arrecadada

| Exercício | Betha 57153 | TCE | Diferença | Naturezas iguais (8 díg. × entidade) |
|---|---:|---:|---:|---:|
| 2024 | R$ 150.576.666,82 | R$ 149.487.031,78 | +R$ 1.089.635,04 | 73 de 76 |
| 2025 | R$ 171.092.955,92 | R$ 170.915.184,25 | +R$ 177.771,67 | 73 de 81 |
| 2026, jan.–set. | — | R$ 140.848.635,73 | — | 78 de 85 |

A série mensal confirma que o sufixo `_N` do ID Betha é o mês. Em 2024, 9 dos 12 meses são
idênticos.

### Empenhos individuais (Betha 57140 × TCE)

Casamento 1:1 por entidade + número + data + valor original:

| Exercício | Casados | Só na Betha | Só no TCE (fora Câmara) |
|---|---:|---:|---:|
| 2024 | 9.069 | 41 (SAMAE, R$ 495.222,16) | 37 (SAMAE, R$ 147.994,62) |
| 2025 | 9.738 | 19 (SAMAE, R$ 36.742,61) | 0 |
| 2026 até 30/09 | **8.376 (100%)** | 0 | 0 |

Prefeitura, FMS e Fundação Ambiental casam 100% em todos os anos.

## O que só a conferência revelou

Nenhuma das hipóteses abaixo está comprovada contabilmente. São divergências **localizadas**,
com a pista mais provável.

1. **Empenhos duplicados no SAMAE (Betha 57140).** Em 2025, 19 registros com IDs antigos
   (`211:2473:2349xxxx`) e sem liquidação repetem empenhos que o próprio SAMAE renumerou: o
   antigo nº 334 é o atual nº 335, e assim por diante. O total exibido hoje no dashboard para o
   SAMAE fica **R$ 36.742,61 maior** do que o real. A Betha 57170 e o TCE concordam entre si e
   não têm esses registros. Em 2024 o padrão se repete em escala maior, e ali até a 57170 do SAMAE difere do TCE.
2. **FPM contado duas vezes em 2024 (Betha 57153).** O mesmo valor, R$ 1.135.545,25, aparece em
   julho como "Cotas Extraordinárias" (`17115121`) e como "1% Cota entregue no mês de julho"
   (`17115131`). O TCE registra uma vez só. Em 2025 e 2026 só existe a primeira rubrica.
   Provável duplicidade de lançamento ou de mapeamento no portal.
3. **IRRF retido do SAMAE ausente na Betha.** Nos três anos, o TCE tem R$ 236 mil (2024),
   R$ 429 mil (2025) e R$ 415 mil (2026) na natureza `11130311` do SAMAE. A Betha mostra zero ou
   menos que isso. Provavelmente a retenção é registrada contabilmente, mas não aparece na
   consulta do portal.
4. **Diferenças pontuais de classificação:** convênios da saúde (R$ 250.000 em 2025), SUS
   Atenção Primária (R$ 320.136,80 em 2025) e uma reclassificação de R$ 15.312,12 na Prefeitura
   entre duas rubricas, que se compensa.

Os itens 1 e 2 afetam números que o dashboard já publica. Sem o TCE, não haveria como
percebê-los.

## Atualização

Em 01/11/2026, o TCE tinha empenhos de 2026 **até 30/09** (Câmara até 29/10) e receitas até
setembro. A Betha tinha até 29/10. O app do TCE foi recarregado em 30–31/10, ou seja, os dados
chegam pela remessa do e-Sfinge, não diariamente.

Consequência: **para o ano corrente, a Betha é a única fonte atual**. Até onde o TCE já chegou,
os dados batem 100%. Isso torna a conferência retroativa confiável: um mês depois, cada mês
Betha pode ser "carimbado" contra o TCE.

## O que cada fonte tem que a outra não tem

| Só na Betha | Só no TCE |
|---|---|
| Dados do mês corrente | Câmara Municipal |
| Orçamento atualizado por rubrica (57153) e por ação (57170) | Liquidação e pagamento reais por empenho, com estornos |
| Órgão/secretaria do empenho | Função, subfunção, elemento, fonte de recurso, projeto/atividade |
| Consultas de pessoal, programas etc. (não integradas) | Nº de licitação/contrato/convênio, situação cadastral do credor |
| | Todos os municípios de SC, com o mesmo modelo (permite comparações) |

## Recomendação por indicador

| Indicador | Fonte exibida | Papel da outra fonte |
|---|---|---|
| Ano corrente (receitas, despesas) | Betha | TCE confere os meses já remetidos |
| Exercício encerrado: totais por entidade | Betha, com selo da conferência | TCE é a referência; divergência vira alerta visível |
| Despesa da Câmara | **TCE** (fonte explícita) | — |
| Total municipal com Legislativo | Betha + Câmara/TCE, quando a conferência das 4 entidades fechar | — |
| Lista de empenhos | Betha 57140, sem os registros que o TCE não reconhece em ano encerrado | TCE |
| Execução orçamentária (empenhado líquido) | Betha 57170 | TCE |
| Orçamento atualizado | Betha | — |
| Classificação funcional e fonte de recurso | TCE (expansão futura) | — |

## Como a validação deve funcionar

Regras simples, todas já possíveis com o que foi implementado:

1. **Coleta:** cada fonte concilia com o próprio totalizador (já existe nas duas).
2. **Conferência anual por entidade:** `|Betha 57170 − TCE| = 0` nas três etapas, e
   `|Betha 57153 − TCE| = 0` na receita. Fora disso, o ano fica "com divergência", com a lista
   de naturezas ou empenhos responsáveis (já é o que `conferir` produz).
3. **Conferência mensal retroativa** para o ano corrente, só nos meses que o TCE já tem
   (derivar o mês-limite da maior `data_empenho` do TCE, não do calendário).
4. **Empenhos:** casamento 1:1. Os "só na Betha" de exercício encerrado entram numa lista de
   suspeitos, e não no total.
5. Nunca corrigir silenciosamente um número com o outro. Mostrar as duas fontes e a diferença.

## Próximos passos sugeridos

Já feito: aba **Conferência** no dashboard (`#conferencia`), alimentada por `GET /api/conferencias?ano=AAAA`
(consultas em `db/conferencias.js`, as mesmas do `npm run conferir`). No ano em curso, compara só o período que o TCE
já recebeu.

1. Persistir cada conferência (tabela `comparacoes_fontes`) para ter histórico das divergências.
2. Selo de conferência nas páginas de Receitas e Despesas.
3. Trocar os cartões de execução da Visão Geral para a 57170 (o total exato) e mostrar a Câmara
   com fonte TCE.
4. Tratar os registros "fantasmas" do SAMAE na listagem de empenhos.
5. Agendar: Betha diária ou semanal; TCE semanal, após a recarga do app.
6. Opcional: avisar a Prefeitura/SAMAE sobre os itens 1 a 3, em linguagem neutra.

## Limites

- Os painéis do TCE usam Qlik sem contrato de API. Os IDs dos apps e os nomes de campo podem
  mudar. O coletor falha de forma explícita nesse caso.
- Três exercícios, um município. O padrão "igual ao centavo" não foi demonstrado para outros anos.
- Igualdade entre as fontes não é auditoria nem homologação contábil. Divergência não é
  irregularidade.
