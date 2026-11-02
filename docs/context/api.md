# API

API REST somente leitura sobre as coletas publicadas, em Fastify. Vive em `apps/api/src/` (pacote `@orleans-em-dados/api`) e nunca consulta as fontes externas.

## Estrutura

- `src/app.ts` — `criarApp(opcoes?)`: monta o Fastify, registra os módulos e traduz 404 e erro. `src/index.ts` só sobe a porta (`PORT`, padrão 3000).
- `src/modules/<área>/` — `<área>.dao.ts` (SQL), `<área>.service.ts` (composição com a conferência), `<área>.routes.ts` (borda). Áreas: `coletas`, `receitas`, `despesas`, `empenhos`, `discrepancias`, `conferencias`, `importacoes`.
- `src/lib/borda.ts` — `parametro`, `texto`, `responder`, `responderCsv`.
- `src/lib/consultas.ts` — `consultar`, `ENTIDADE`, `chaveTexto`. `src/lib/csv.ts` — `gerarCsv`.

## Contrato

Todas as rotas de dados recebem `ano` e respondem `404 { erro }` quando o ano não tem coleta publicada daquela consulta. O schema de cada resposta está em [contracts.md](contracts.md).

- `GET /api/anos` — exercícios publicados de receitas ou empenhos, entidades e `atualizadoEm` por ano.
- `GET /api/receitas?ano&entidade` — a receita conferida (`dadosConferidos().receita`): `arrecadadoNoMes` é sempre o conferido, em totais, por mês, por entidade, por origem e nas naturezas (mistas, com `nivel` 8 ou 14). O bloco `conferencia` traz a conta com o total da fonte. O orçado continua, declarado em `fonteUnica`.
- `GET /api/receitas.csv?ano&entidade` — as naturezas da rota JSON, com a coluna `Arrecadado conferido`.
- `GET /api/despesas/resumo?ano&entidade` — `dadosConferidos().despesa`, cada entidade com `fonte`, `conferida` e `dataCorte`. Entidade não conferida sai sem número e fora de `totais`. Sem `entidade`, a Câmara à parte (`camara`, `conferida: false`). `conferencia.diferencaBetha` e `totalBetha` são a conta do empenhado no exercício encerrado (conferido + linhas retiradas + entidade fora inteira = total da 57170); nulos no ano em curso, porque o aguardando é valor original da Betha e o conferido é líquido do TCE-SC.
- `GET /api/despesas/empenhos/resumo?ano&entidade` — só o conjunto casado, por mês, entidade, órgão, credor e maiores; `totais.excluidos` é o número de registros da 57140 fora da lista, separado em `aguardandoTce` (depois do corte) e `emDiscrepancia` (sem par até o corte). Sem conferência, os dois ficam em zero.
- `GET /api/despesas/empenhos?ano&q&entidade&orgao&situacao&offset&limit` — busca paginada no conjunto casado (`limit` 1–200, padrão 50); `situacao` `pago` (liquidado do TCE-SC > 0 e saldo zero) | `apagar` (saldo > 0) | `sem` (sem liquidação: liquidado do TCE-SC nulo ou zero), qualquer outra é ignorada. Saldo nulo não é zero: não entra em `pago`.
- `GET /api/despesas/empenhos.csv` — mesma busca, todas as linhas.
- `GET /api/discrepancias?ano` — a seção pública: `grupos` por área e tipo, com `rotulo`, `explicacao`, `total` e `itens`, `aguardando` à parte e `resumo`. Sem `avisos`, credor nem histórico. `404 { erro }` em ano inválido ou sem a coleta de receitas.
- `GET /api/conferencias?ano` — saída de `conferencia(ano)` (ver [conferencia.md](conferencia.md)); `404 { erro, faltando }` sem as cinco coletas.
- `GET /api/importacoes` — por importador do registro: última execução (sem a mensagem de erro, que fica só no banco) e, por exercício, a data da consulta publicada mais antiga da fonte. Exemplo não conta.
- Rota desconhecida ou método diferente de `GET`: `404 { erro: 'Rota não encontrada' }`; exceção: `500 { erro: 'Erro interno' }`.

## Regras de negócio

- Cada visão Betha é agregada à parte: nada soma receitas com despesas nem empenhos (57140) com despesa orçamentária (57170).
- As rotas de dados têm três estados: conferido; coleta de exemplo (os números fictícios de sempre, `meta.fonte` `DADOS FICTÍCIOS — exemplo` e `conferencia.disponivel: false`); ano real sem as cinco coletas (`conferencia.disponivel: false`, com `faltando`, arrecadação e execução nulas, listas vazias, e só o orçado, que é fonte única). Nos dois últimos, `/api/discrepancias` responde `disponivel: false`, sem grupos.
- Empenho: `empenhado` é o valor original da Betha (conceito da 57140); `empenhadoLiquido`, `liquidado` e `pago` são do TCE-SC, e `saldoAPagar` é liquidado − pago. Órgão, credor e histórico são da Betha.
- Ano em curso: nada depois do corte do TCE-SC sai em agregado nem na lista. O valor fica em `conferencia.aguardandoTce` e em `aguardando` da seção.
- Discrepâncias: um grupo por área e tipo, porque receita, despesa e empenhos não se somam (`sem_causa` pode sair três vezes). `total` soma `itens[].valor`, em módulo e em centavos; em `mes_diferente`, `valor` é o que mudou de mês. O tipo interno `empenho_fantasma` sai como `empenho_sem_execucao`, com o rótulo "Registro sem execução e sem par no TCE-SC". Rótulo, explicação e nota não afirmam causa.
- Grafias da Betha sem acento ("SERVIO") são agrupadas pela chave sem não-alfanuméricos; o nome exibido é a grafia mais frequente.
- A busca de empenhos ignora acento e caixa em número, credor, histórico e órgão.

## Regras de arquitetura

- Toda resposta JSON de sucesso sai por `responder(reply, schema, corpo)`, com o schema de `packages/contracts`: desvio vira erro aqui, não na tela.
- Valor pedido pelo usuário vai sempre como parâmetro do SQL; `filtroBusca` só interpola as cláusulas fixas dela.
- O conjunto casado é filtrado e somado no Postgres: os pares de `empenhosConferidos` entram por `unnest` e juntam com `tcesc_empenhos` por `id_externo` (`conjuntoConferido`, a relação `e` de todas as consultas de `empenhos.dao.ts`). Nunca some em JS.
- A seção copia campo a campo (`paraItem`): campo novo em `Discrepancia` não vira público sem passar por ali.
- Rota nova: módulo em `src/modules/`, schema no contracts, caso em `test/paridade/casos.ts`.

## Testes

- `test/integration/paridade.spec.ts` — compara cada pedido de `test/paridade/casos.ts` (`CASOS`) com a resposta gravada em `test/paridade/respostas/` (status, tipo, `Content-Disposition`, corpo; CSV com BOM), sobre o banco de `popularBancoDeTeste()`. Traz também valores escritos à mão, que provam que o gravado está certo.
- Regravar só com motivo no commit: `REGRAVAR_PARIDADE=1 pnpm exec vitest run --project=integracao apps/api/test/integration/paridade.spec.ts`.
- `test/integration/conferidos.spec.ts` — só o conferido em cada rota, sobre cenários próprios: duplicidade, registro sem par, ano em curso, ano sem o TCE-SC, coleta de exemplo.
- Unit: `gerarCsv`, `filtroBusca`, `montarSecao`. `app.inject()` serve para rota sem paridade; a paridade sobe o servidor de verdade, em porta efêmera.

## Armadilhas

- `/api/receitas` sem `ano` responde `404 { erro: 'Sem dados de receitas para null' }`: a mensagem cita o parâmetro cru.
- O CSV é contrato com o Excel em português: BOM (`﻿`), `;`, vírgula decimal, aspas escapadas e `\r\n`.
- Regravar a paridade grava em LF: arquivo que só mudou o fim de linha aparece no `git status`, e `git diff --ignore-space-at-eol` mostra que não mudou. Restaure esses.
- Nº de empenho repete entre datas: `q=340` no SAMAE 2025 acha o nº 340 de 26/03, casado com o TCE-SC, e não o de 01/04, retirado. Confira pelo `id`.
- Os registros de `CONFERENCIAS_MANUAIS` valem nas fixtures: o SAMAE com `so_tce` em `11130311` e outro valor sai `rever`.
- Objeto usado como mapa com chave vinda do usuário pega o que é herdado de `Object` (`?situacao=constructor` já virou erro 500): `filtroBusca` usa `Map`.
