# Metodologia

## O que o painel exibe

O número principal é só a parte conferida entre as fontes. Quem mantém as coletas continua com o dado bruto intacto.

| Rótulo na tela                    | O que significa                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `conferido com o TCE-SC`          | O valor que as duas fontes registram, ao centavo. Receita por entidade, natureza de 8 dígitos e mês; despesa por entidade; lista de empenhos, um a um. |
| `conferido com a Betha até DD/MM` | Ano em curso: a despesa vem do TCE-SC, nos empenhos com par na Betha até o último dado que o Tribunal recebeu.                                         |
| `fonte única, sem conferência`    | Orçamento e órgão (Betha) e Câmara (TCE-SC): não há com o que comparar. A Câmara fica à parte e não soma com as entidades.                             |
| `aguardando TCE`                  | Mês que o Tribunal ainda não recebeu. É pendência de remessa: o valor entra no conferido quando a remessa chegar.                                      |

- **Receita:** só a diferença sai. Se as fontes têm o mesmo sinal, o conferido é o valor de menor módulo; com sinais opostos, ou com a linha em uma fonte só, é zero.
- **A conta aparece sempre ao lado:** conferido + em discrepância (+ aguardando) = total da fonte. O conferido pode ficar abaixo de cada fonte.
- **Despesa encerrada:** vale a 57170 se fecha com o TCE-SC nas três etapas. Se a diferença é igual à soma das linhas de modalidade 71 nas três etapas, vale o valor sem essas linhas. Fora disso, a entidade fica sem número, fora da soma, e vai para a seção.
- **Lista de empenhos:** só os casados 1:1 entre as fontes, com identificação e órgão da 57140, e liquidado e pago do TCE-SC.
- **Tabela de rubricas:** 14 dígitos quando todos os meses batem; natureza com mês divergente fica em 8 dígitos, sem rateio.

Igualdade entre as fontes não é auditoria nem homologação contábil: mostra que as duas publicam o mesmo número.

### Seção Discrepâncias

Cada valor retirado aparece em `#discrepancias` (`#conferencia` continua abrindo), por área e tipo, com o valor de cada fonte, a diferença e o lado que registra mais. Receita, despesa e empenhos não se somam. Cada caso tem uma situação:

- **Confirmado no portal em DD/MM/AAAA:** conferido à mão; o registro fica em `packages/db/src/conferencia/conferencias-manuais.ts`.
- **Confirmado em parte:** só um exemplo foi conferido à mão, e a evidência diz qual.
- **Calculado (provável):** o tipo vem do padrão dos números; ninguém conferiu no portal.
- **Rever:** foi conferido à mão, e o valor mudou depois.

Se houver pedido de informação, o caso mostra só o número do protocolo. A seção nunca leva nome de credor nem histórico.

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

Os importadores rodam todo dia, sobre o exercício corrente e o anterior. O painel avisa "Dado atrasado", com a data da última atualização, quando a fonte passa de dois dias sem atualizar no exercício corrente, ou de dois meses no anterior: uma rodada que falhe de madrugada não acende o aviso. Exercícios mais antigos não são atualizados automaticamente e não recebem o aviso. Enquanto isso, o painel continua mostrando o último dado publicado.

## Níveis de confiabilidade

Conforme a seção 7.2 da [especificação](ESPECIFICACAO_TECNICA.md): `coletado` → `integridade_validada` →
`totalizador_conciliado` → `comparacao_externa_pendente` / `comparacao_externa_com_divergencia` /
`comparacao_externa_conciliada`. As coletas seguem em `totalizador_conciliado`, que confirma só a extração. O nível que
o público vê é o `conferido com o TCE-SC`, calculado número a número na consulta, sem mudar o status da coleta.
