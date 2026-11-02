# API

API REST somente leitura sobre as coletas publicadas. Vive em `backend/src/` (pacote `@orleans-em-dados/backend`): `node:http` sem framework, nunca consulta as fontes externas.

## Estrutura

- `backend/src/server.js` — tabela `rotas` (caminho → handler, só `GET`), respostas JSON e CSV, cache das exclusões de empenho.
- `backend/src/dados.js` — `anosDisponiveis()`, `coletaPublicada(chave, ano)` (coleta + metadados exibidos + totalizadores).
- `backend/src/indicadores.js` — agregações em SQL: `resumoReceitas`, `resumoEmpenhos`, `resumoDespesas`, `buscarEmpenhos`, `todosEmpenhos`.

## Contrato

Todas as rotas recebem `ano` e respondem `404 { erro }` quando o ano não tem coleta publicada daquela consulta.

- `GET /api/anos` — `{ anos, exemplo, atualizadoEm: { [ano]: data }, entidades }`; só anos com receitas ou empenhos publicados.
- `GET /api/receitas?ano&entidade` — resumo da 57153 (totais, por mês, por entidade, por origem, naturezas) + `meta`.
- `GET /api/receitas.csv?ano&entidade` — naturezas em CSV.
- `GET /api/despesas/resumo?ano&entidade` — 57170 por entidade e, sem `entidade`, a Câmara pelo TCE-SC (`camara`).
- `GET /api/despesas/empenhos/resumo?ano&entidade` — 57140 por mês, entidade, órgão, credor e maiores, sem as cópias antigas apontadas pela conferência (`totais.excluidos`).
- `GET /api/despesas/empenhos?ano&q&entidade&orgao&situacao&offset&limit` — busca paginada (`limit` 1–200, padrão 50); `situacao` `pago` | `apagar` | `sem`.
- `GET /api/despesas/empenhos.csv` — mesma busca, todas as linhas.
- `GET /api/conferencias?ano` — saída de `conferencia(ano)` (ver [db.md](db.md)); `404 { erro, faltando }` sem as cinco coletas.
- Rota desconhecida: `404 { erro: 'Rota não encontrada' }`; exceção: `500 { erro: 'Erro interno' }`.

## Regras de negócio

- Cada visão Betha é agregada à parte: nada soma receitas com despesas nem empenhos (57140) com despesa orçamentária (57170).
- `meta.fonte` vira `DADOS FICTÍCIOS — exemplo` quando a coleta publicada é de exemplo.
- Grafias da Betha sem acento ("SERVIO") são agrupadas pela chave sem não-alfanuméricos; o nome exibido é a grafia mais frequente.
- A busca de empenhos ignora acento e caixa em número, credor, histórico e órgão.

## Testes

- `backend/test/integration/paridade.spec.js` — compara cada pedido de `backend/test/paridade/casos.js` (`CASOS`) com a resposta gravada em `backend/test/paridade/respostas/` (status, tipo, `Content-Disposition`, corpo; CSV com BOM), sobre o banco de `popularBancoDeTeste()`. Traz também valores escritos à mão, que provam que o gravado está certo.
- Regravar só com motivo no commit: `REGRAVAR_PARIDADE=1 pnpm exec vitest run --project=integracao backend/test/integration/paridade.spec.js`.
- `criarServidor()` (`server.js`) devolve o servidor sem `listen`; o teste sobe em porta efêmera.

## Armadilhas

- `/api/receitas` sem `ano` responde `404 { erro: 'Sem dados de receitas para null' }`: a mensagem cita o parâmetro cru.
- O CSV é contrato com o Excel em português: BOM (`﻿`), `;`, vírgula decimal, aspas escapadas e `\r\n`.
- `empenhosExcluidos(ano)` guarda a lista por 5 minutos: uma conferência nova só se reflete nas somas depois disso.
