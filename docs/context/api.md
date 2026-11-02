# API

API REST somente leitura sobre as coletas publicadas, em Fastify. Vive em `apps/api/src/` (pacote `@orleans-em-dados/api`) e nunca consulta as fontes externas.

## Estrutura

- `src/app.ts` — `criarApp(opcoes?)`: monta o Fastify, registra os módulos e traduz 404 e erro. `src/index.ts` só sobe a porta (`PORT`, padrão 3000).
- `src/modules/<área>/` — `<área>.dao.ts` (SQL), `<área>.routes.ts` (borda). Áreas: `coletas`, `receitas`, `despesas`, `empenhos`, `conferencias`, `importacoes`.
- `src/lib/borda.ts` — `parametro`, `texto`, `responder`, `responderCsv`.
- `src/lib/consultas.ts` — `consultar`, `ENTIDADE`, `chaveTexto`. `src/lib/csv.ts` — `gerarCsv`.

## Contrato

Todas as rotas de dados recebem `ano` e respondem `404 { erro }` quando o ano não tem coleta publicada daquela consulta. O schema de cada resposta está em [contracts.md](contracts.md).

- `GET /api/anos` — exercícios publicados de receitas ou empenhos, entidades e `atualizadoEm` por ano.
- `GET /api/receitas?ano&entidade` — resumo da 57153 (totais, por mês, por entidade, por origem, naturezas) + `meta`.
- `GET /api/receitas.csv?ano&entidade` — naturezas em CSV.
- `GET /api/despesas/resumo?ano&entidade` — 57170 por entidade e, sem `entidade`, a Câmara pelo TCE-SC (`camara`).
- `GET /api/despesas/empenhos/resumo?ano&entidade` — 57140 por mês, entidade, órgão, credor e maiores, sem as cópias antigas apontadas pela conferência (`totais.excluidos`).
- `GET /api/despesas/empenhos?ano&q&entidade&orgao&situacao&offset&limit` — busca paginada (`limit` 1–200, padrão 50); `situacao` `pago` | `apagar` | `sem`, qualquer outra é ignorada.
- `GET /api/despesas/empenhos.csv` — mesma busca, todas as linhas.
- `GET /api/conferencias?ano` — saída de `conferencia(ano)` (ver [conferencia.md](conferencia.md)); `404 { erro, faltando }` sem as cinco coletas.
- `GET /api/importacoes` — por importador do registro: última execução (sem a mensagem de erro, que fica só no banco) e, por exercício, a data da consulta publicada mais antiga da fonte. Exemplo não conta.
- Rota desconhecida ou método diferente de `GET`: `404 { erro: 'Rota não encontrada' }`; exceção: `500 { erro: 'Erro interno' }`.

## Regras de negócio

- Cada visão Betha é agregada à parte: nada soma receitas com despesas nem empenhos (57140) com despesa orçamentária (57170).
- `meta.fonte` vira `DADOS FICTÍCIOS — exemplo` quando a coleta publicada é de exemplo.
- Grafias da Betha sem acento ("SERVIO") são agrupadas pela chave sem não-alfanuméricos; o nome exibido é a grafia mais frequente.
- A busca de empenhos ignora acento e caixa em número, credor, histórico e órgão.

## Regras de arquitetura

- Toda resposta JSON de sucesso sai por `responder(reply, schema, corpo)`, com o schema de `packages/contracts`: desvio vira erro aqui, não na tela.
- Valor pedido pelo usuário vai sempre como parâmetro do SQL; `filtroBusca` só interpola as cláusulas fixas dela.
- Rota nova: módulo em `src/modules/`, schema no contracts, caso em `test/paridade/casos.ts`.

## Testes

- `test/integration/paridade.spec.ts` — compara cada pedido de `test/paridade/casos.ts` (`CASOS`) com a resposta gravada em `test/paridade/respostas/` (status, tipo, `Content-Disposition`, corpo; CSV com BOM), sobre o banco de `popularBancoDeTeste()`. Traz também valores escritos à mão, que provam que o gravado está certo.
- Regravar só com motivo no commit: `REGRAVAR_PARIDADE=1 pnpm exec vitest run --project=integracao apps/api/test/integration/paridade.spec.ts`.
- Unit: `gerarCsv`, `filtroBusca`, `criarExclusoes`. `app.inject()` serve para rota sem paridade; a paridade sobe o servidor de verdade, em porta efêmera.

## Armadilhas

- `/api/receitas` sem `ano` responde `404 { erro: 'Sem dados de receitas para null' }`: a mensagem cita o parâmetro cru.
- O CSV é contrato com o Excel em português: BOM (`﻿`), `;`, vírgula decimal, aspas escapadas e `\r\n`.
- `criarExclusoes` guarda a lista por 5 minutos: uma conferência nova só se reflete nas somas depois disso.
- Objeto usado como mapa com chave vinda do usuário pega o que é herdado de `Object` (`?situacao=constructor` já virou erro 500): `filtroBusca` usa `Map`.
