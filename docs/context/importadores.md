# Importadores

Coleta das fontes externas, gravação e publicação. Um pacote por fonte em `packages/importadores/<fonte>/`, sobre o contrato de `packages/importadores/nucleo/`; `apps/worker` agenda as rodadas e traz a CLI. Fontes: [betha.md](betha.md), [tcesc.md](tcesc.md), [ibge.md](ibge.md), [siconfi.md](siconfi.md).

## O contrato (`packages/importadores/nucleo`)

Todo importador novo segue `Importador` e `ConsultaImportada` (`nucleo/src/importador.ts`): `id`, `fonte`, `agenda` (cron, no fuso de São Paulo), `anosDaRodada(agora)` e `consultas`, cada uma com `id`, `chave`, `tabela`, `coletar` (só I/O), `normalizar` (pura, lança se o registro não servir) e `validar`. Gravar e publicar são do executor. Fonte nova entra em `apps/worker/src/registro.ts`.

- `executar(importador, ano, { repositorio, relogio, aoMontarLote? }, chaves?)` (`executor.service.ts`) — coletar → normalizar → validar → gravar → publicar, consulta por consulta; falha numa não impede a seguinte. Devolve `ResultadoDaExecucao`, sem relançar.
- `RepositorioDeLotesPostgres` (`lotes.dao.ts`) — implementa a porta `RepositorioDeLotes`: `gravar` (uma transação, linhas em blocos de 1.000), `publicar` (troca o ponteiro), `reconfirmar`, `abrirExecucao`, `fecharExecucao`.
- `gravarSnapshot(consulta, snapshot, origem, repositorio)` (`snapshot.ts`) — grava um `{ meta, registros }` já coletado, sem passar pela fonte: os exemplos e os arquivos salvos com `--json`.
- `ocultarSegredos(texto)` — tira `Bearer` e `access_token` da mensagem de erro antes de gravar.

O núcleo já confere contagem e ids únicos; `validar` cuida do que é da fonte (totalizador, total do motor).

## Contrato

Status da consulta: `publicada`, `sem_mudanca`, `nao_publicada` (exemplo sobre dado real), `rejeitada` (gravada, publicação anterior intacta), `falhou` (nada gravado).

Status da execução, em `execucoes`: `em_andamento`, `sucesso`, `rejeitada`, `falhou`; falha tem prioridade sobre rejeição.

## Worker e CLI (`apps/worker`)

- `pnpm worker` — sobe o agendador. Cada importador é uma fila do pg-boss (`importador-<id>`), política `singleton` (uma rodada ativa por importador), com `schedule` no fuso `America/Sao_Paulo` e até 3 repetições com espera crescente a partir de 10 minutos.
- `pnpm importar <betha|tcesc|ibge|siconfi> --ano 2025 [--consulta <chave>] [--json]` — roda à mão, sem fila. Com `--json`, salva o snapshot em `data/<fonte>/<consulta>-<ano>.json` (`.rejeitado.json` quando reprovado).
- `pnpm importar --arquivo <snapshot.json>`, `pnpm db:exemplos` — grava snapshots já existentes; exemplos fictícios só são publicados se não houver dado real para o ano.
- `pnpm conferir --ano 2025 [--json]` — relatório da conferência no console.

- `rodarImportador(importador, dependencias)` (`src/rodada.ts`) — todos os exercícios da rodada; relança `RodadaComFalha` depois de tentar todos, para a fila repetir. Lote rejeitado não relança: repetir na hora traria o mesmo dado, e a próxima rodada tenta de novo.
- `montarFilas(boss, importadores, rodar, opcoes?)` (`src/filas.ts`), `importarDaFonte`, `importarArquivos`, `salvarSnapshot` (`src/comandos.ts`).

## Regras de negócio

- Uma coleta só é publicada com todos os registros capturados, ids únicos e soma em centavos igual ao total da fonte. Qualquer falha: `rejeitado`, gravada e não publicada, e o dashboard continua com o lote anterior.
- Mesmo conteúdo da coleta publicada (mesmo hash) não vira outra coleta: só atualiza `coletas.finalizado_em`, a data que o dashboard mostra.
- `ano` é o exercício em toda fonte, salvo no IBGE, em que é o ano da coleta: a fonte publica séries, e o lote traz a série inteira. O ano de referência é o `periodo` da linha.
- Campo ausente é contado em `camposAusentes`, nunca somado como zero.

## Regras de arquitetura

- `normalizar` devolve dinheiro como texto decimal (`dinheiro()` de `packages/contracts`), para o valor chegar ao `NUMERIC` sem passar por float.
- I/O entra por parâmetro (`cliente`, `abrirSessao`, `transporte`, `relogio`), para o teste não sair para a rede.
- Token nunca vai para log nem para mensagem de erro.

## Testes

- `nucleo/test/support/fakes.ts` — `RepositorioDeLotesFake` (guarda a ordem das chamadas), `relogioFake`, `bruto`, `consultaFake`, `importadorFake`.
- `packages/importadores/fixtures/src/` (pacote de teste) — `snapshots.ts`: snapshots fictícios das consultas (`receitas`, `empenhos`, `despesas`, `tcescReceitas`, `tcescEmpenhos`, `ibgePopulacao`, `ibgeCenso`, `ibgePib`, `siconfiFuncoes({ ano, contas })`, e `snapshot(consultaId, registros, opções)` para montar outro), com receita negativa, incoerência mês × acumulado, empenho renumerado, cópia antiga, empenho sem liquidação e a Câmara; o TCE-SC vai só até fevereiro (exercício parcial). `banco-de-teste.ts`: `limparColetas()` (mantém o catálogo), `popularBancoDeTeste()` (todas publicadas) e `popularCenario({ ... })`, que troca lotes; `ibgePopulacao: null` e `siconfiFuncoes: []` deixam a fonte sem coleta.
- `apps/worker/test/integration/filas.spec.ts` sobe o pg-boss de verdade no Postgres descartável, com o esquema `pgboss` recriado a cada `it`.

## Armadilhas

- A entrega do pg-boss é at-least-once, e erro engolido no handler conta como sucesso, sem repetição.
- Endpoints da Betha e apps do TCE-SC não são APIs documentadas: ids, campos e filtros podem mudar.
- O pnpm repassa `--` literalmente: é `pnpm importar betha --ano 2025`, não `pnpm importar betha -- --ano 2025` (o `parseArgs` leria o resto como posicional).
- `credor` pode ser pessoa física: fixture de teste e log nunca levam nome real.
