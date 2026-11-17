# API — Armadilhas

- Percentual que a tela mostra com uma casa sai da API com uma casa (`emPercentual(a, b, 1)`): 23,548 viraria 23,55 e, na tela, 23,6, e o certo é 23,5. Vale para o 2010 da frequência e para "em outro município".
- `/api/receitas` sem `ano` responde `404 { erro: 'Sem dados de receitas para null' }`: a mensagem cita o parâmetro cru.
- O CSV é contrato com o Excel em português: BOM (`﻿`), `;`, vírgula decimal, aspas escapadas e `\r\n`.
- Regravar a paridade grava em LF: arquivo que só mudou o fim de linha aparece no `git status`, e `git diff --ignore-space-at-eol` mostra que não mudou. Restaure esses.
- Nº de empenho repete entre datas: `q=340` no SAMAE 2025 acha o nº 340 de 26/03, casado com o TCE-SC, e não o de 01/04, retirado. Confira pelo `id`.
- Os registros de `CONFERENCIAS_MANUAIS` valem nas fixtures: o SAMAE com `so_tce` em `11130311` e outro valor sai `rever`.
- Objeto usado como mapa com chave vinda do usuário pega o que é herdado de `Object` (`?situacao=constructor` já virou erro 500): `filtroBusca` usa `Map`.
