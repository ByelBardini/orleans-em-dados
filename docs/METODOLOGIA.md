# Metodologia

## Coleta e validação

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

| Consulta | Registros | Campo | Soma = totalizador |
|---|---:|---|---:|
| `57153` | 1.469 | `valorOrcadoAtualizado` | R$ 149.083.697,04 |
| | | `valorArrecadadoNoMes` | R$ 171.092.955,92 |
| `57140` | 9.757 | `valorEmpenho` | R$ 160.833.350,29 |
| | | `valorLiquidadoEmpenho` | R$ 142.524.230,52 |
| | | `valorPagoEmpenho` | R$ 142.524.230,52 |

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
- Uma diferença entre fontes é informação de transparência. Pode decorrer de critério, abrangência ou atualização e
  não prova, por si, erro ou irregularidade.

## Níveis de validação

Conforme a seção 7.2 da [especificação](ESPECIFICACAO_TECNICA.md): `coletado` → `integridade_validada` →
`totalizador_conciliado` → `comparacao_externa_pendente` / `comparacao_externa_com_divergencia` /
`comparacao_externa_conciliada`. Os snapshots atuais estão em `totalizador_conciliado`.
