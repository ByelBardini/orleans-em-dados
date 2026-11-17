# Dashboard — Discrepâncias

A página `apps/web/src/paginas/Discrepancias.tsx` (`#discrepancias`). As regras da seção pública estão em [conferencia.md](../conferencia.md); a rota, em [api.md](../api.md).

## Regras de negócio

- A aba é "Discrepâncias", em `#discrepancias`; `#conferencia` continua abrindo (`ALIASES`).
- Discrepâncias lê `/api/discrepancias`: grupos em blocos por área (receita, despesa, empenhos, despesa por função, que não se somam), cada um com rótulo, explicação, o `total` da resposta e os casos. Na área `funcao`, a coluna Betha vira SICONFI, e a manchete diz "as fontes". Grupo ou área sem caso não aparece. Até 10 casos abertos; o resto em "Ver todos os N". Em até 720 px, cada caso vira bloco, sem rolagem lateral.
- Bloco "Educação" (`BlocoDeEducacao`, no fim da página, abaixo de "Os totais"): lê `/api/educacao/discrepancias`, sem ano nem entidade. Aparece também no ano sem conferência, não pede de novo ao trocar o filtro e fica fora da manchete e da conta do ano. Cabeçalhos e o "a mais ..." vêm das fontes do grupo. Valor nulo é travessão, com o percentual embaixo e "sem valor para comparar" na diferença. Sem coluna Situação, e sem coleta ou sem caso, some, sem título solto. Reaproveita `.grupo-de-casos` e `.tabela-casos`, sem CSS novo. Fábrica de teste: `discrepanciasDeEducacao`, em `test/support/educacao.ts`.
- "O que diz a coluna Situação" explica as quatro situações antes dos blocos, só quando há caso.
- Cada caso: entidade, natureza ou número, mês ou data, valor por fonte, diferença com o lado que registra mais (nunca sinal), nota, evidência e `seloDaSituacao`. Pedido aberto no município (protocolo, e-SIC) nunca aparece: nem na tela, nem na resposta, nem no relatório. Em `mes_diferente` não há lado: "R$ X em meses diferentes". Natureza dividida diz "parte dos R$ Y da natureza".
- A conta do ano é uma por área, lida de `/api/receitas`, `/api/despesas/resumo` e `/api/despesas/empenhos/resumo`. Empenhos: casados + `fonte: betha` da seção + aguardando = totalizador `valorEmpenho` da 57140. A despesa em curso não tem conta. A conta usa sinal, e o `total` do grupo é em módulo: os grupos somados podem não repetir o "em discrepância" (2025: R$ 15.312,12 entram com os dois sinais), e a página avisa.
- "Aguardando o TCE-SC" vem à parte, abaixo dos grupos, sem selo de situação e sem palavra de problema.
- "Os totais, para conferir" lê `/api/conferencias`, por último e só com a seção disponível: despesa, receita e empenhos por entidade, receita mês a mês, Câmara, como ler e coletas, todos neutros.
- Filtro de entidade do App: a seção mostra o alternador (quem chega com ele ligado precisa soltar). Casos e aguardando filtram por `codigoEntidade`, com o total refeito em centavos; as contas pedem o recorte à API; o total dos empenhos é a soma das partes, porque o totalizador é do município; os totais filtram por sigla, e a Câmara sai.
