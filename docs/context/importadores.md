# Importadores

Coleta das fontes externas e gravação no banco. Vive em `packages/importadores/` (pacote `@orleans-em-dados/importadores`, sem `src/`: fontes na raiz). Rodam à mão pela CLI; não há agendamento.

## O contrato (`packages/importadores/nucleo`)

Todo importador novo segue `Importador` e `ConsultaImportada` (`nucleo/src/importador.ts`): `id`, `fonte`, `agenda` (cron), `anosDaRodada(agora)` e `consultas`, cada uma com `id`, `chave`, `tabela`, `coletar` (só I/O), `normalizar` (pura, lança se o registro não servir) e `validar`. Gravar e publicar são do executor.

- `executar(importador, ano, { repositorio, relogio }, chaves?)` (`executor.service.ts`) — coletar → normalizar → validar → gravar → publicar, consulta por consulta. Devolve `ResultadoDaExecucao`; não relança: quem decide repetir é o worker, pelo `status`.
- `RepositorioDeLotesPostgres` (`lotes.dao.ts`) — implementa a porta `RepositorioDeLotes`: `gravar` (uma transação, linhas em blocos de 1.000), `publicar` (troca o ponteiro), `reconfirmar`, `abrirExecucao`, `fecharExecucao`.
- `ocultarSegredos(texto)` — tira `Bearer` e `access_token` da mensagem de erro antes de gravar.

Status da consulta: `publicada`, `sem_mudanca` (mesmo hash da publicada: não grava outra coleta e só atualiza `coletas.finalizado_em`), `nao_publicada` (exemplo sobre dado real), `rejeitada` (gravada, publicação anterior intacta), `falhou` (nada gravado). Status da execução, em `execucoes`: `em_andamento`, `sucesso`, `rejeitada`, `falhou`; falha tem prioridade sobre rejeição.

O núcleo já confere contagem e ids únicos; `validar` cuida do que é da fonte (totalizador).

## Estrutura

- `packages/importadores/betha/` — Portal da Transparência Betha: `auth.js`, `client.js`, `config.js`, `coletar.js` (CLI).
- `packages/importadores/tcesc/` — Farol TCE-SC (Qlik Engine API sobre WebSocket): `qlik-client.js`, `config.js`, `coletar.js` (CLI). Detalhe do protocolo em `packages/importadores/tcesc/README.md`.
- `packages/importadores/gravar.js` — `gravarColeta(snapshot, origem)`: grava e publica uma coleta.
- `packages/importadores/conferir.js` — CLI da conferência (`pnpm conferir --ano 2025 [--json]`).
- `packages/importadores/importar-arquivo.js` — CLI que grava snapshots JSON já existentes (`pnpm importar <arquivos>` ou `pnpm db:exemplos`).

## Contrato

- Snapshot `{ meta, registros }`: `meta` traz `consultaId`, `ano`, `filtro`, `iniciadoEm`, `coletadoEm`, `totalHits`, `capturados`, `idsUnicos`, `camposAusentes`, `conferencia` (por campo: `fonte`, `calculado`, `diferenca`), `status` e `erros`; `registros` são os payloads com `id`.
- Betha `57153` (filtro `ano`), `57140` (filtro `anoExercicio`), `57170` (filtro `ano`; com `anoExercicio` volta todos os exercícios). Campos somados e conferidos contra `/totalizadores` em `CONSULTAS` de `betha/config.js`.
- TCE-SC `900001` (receitas: unidade × natureza × mês × dedução) e `900002` (um empenho por `ID Empenho`), filtrados por ente `ORLEANS` e ano.
- Com `--json`, o snapshot também vai para `data/betha/` ou `data/tcesc/` (fora do git; `.rejeitado.json` quando há erro).

## Funções e utilitários

- `BethaAuthClient` (`betha/auth.js`) — token anônimo pelo fluxo implícito (HTTP 303), só em memória, renovado 60 s antes de expirar; confere o destino do redirecionamento.
- `BethaQueryClient` (`betha/client.js`) — `buscar(consultaId, filtro, { offset, limit })` e `totalizadores(consultaId, filtro)`; em `401` renova o token uma vez, em `429`/`5xx`/erro de rede repete até 4 vezes com espera exponencial.
- `QlikSessao` (`tcesc/qlik-client.js`) — `abrir(appId)`, `selecionar(campo, texto)`, `limparSelecoes()`, `selecoes()`, `hipercubo({ dimensoes, medidas })`, `infoApp()`, `fechar()`.
- `gravarColeta` (`gravar.js`) — numa transação: `coletas` → `totais_fonte` → `registros_brutos` (um parâmetro JSON expandido no servidor) → tabela normalizada (SQL de `NORMALIZAR` por consulta) → `publicacoes`.

## Regras de negócio

- Uma coleta só é `totalizador_conciliado` com todos os registros capturados, ids únicos, `totalHits` estável e soma em centavos igual ao totalizador da fonte (Betha) ou ao total do motor (TCE-SC). Qualquer falha: `rejeitado`, gravada e não publicada.
- Campo ausente é contado em `camposAusentes`, nunca somado como zero.
- TCE-SC: as duas seleções (ente e ano) têm de ser exatamente as pedidas, e o app não pode ter sido recarregado durante a coleta.

## Regras de arquitetura

- A normalização bruto → tabela é SQL (`INSERT ... SELECT` sobre o `JSONB`), para o valor ir de texto JSON para `NUMERIC` sem passar por float.
- Token nunca vai para log nem para mensagem de erro.

## Testes

- `nucleo/test/support/fakes.ts` — `RepositorioDeLotesFake` (guarda a ordem das chamadas), `relogioFake`, `consultaFake`, `importadorFake`.

- `packages/importadores/test/support/snapshots.js` — snapshots fictícios das cinco consultas (`receitas`, `empenhos`, `despesas`, `tcescReceitas`, `tcescEmpenhos`, e `snapshot(consultaId, registros, opções)` para montar outro). Carregam receita negativa, incoerência mês × acumulado, empenho renumerado, cópia antiga, empenho sem liquidação e a Câmara; o TCE-SC vai só até fevereiro (exercício parcial).
- `packages/importadores/test/support/banco-de-teste.js` — `limparColetas()` (mantém o catálogo) e `popularBancoDeTeste()` (as cinco publicadas).
- Gravação e publicação são provadas em `packages/importadores/test/integration/gravar.spec.js`.

## Armadilhas

- Paginação da Betha sem ordenação é instável (em 2026 a 57153 devolveu 1.294 registros com 1.017 ids únicos): o cliente ordena por `id`, e `coletar.js` ainda repete a leitura inteira até 3 vezes antes de entregar uma coleta inconsistente.
- O Qlik devolve `double` (`170915184.25000012`): o coletor converte para centavos e recusa o que não cai sobre um centavo inteiro. Nulo no Qlik é `qIsNull` ou `qText '-'`.
- Selecionar no Qlik por texto não restringe o recorte neste servidor: a seleção é pelo `qElemNumber` lido na sessão.
- Endpoints da Betha e apps do TCE-SC não são APIs documentadas: ids, campos e filtros podem mudar.
- `pnpm` repassa `--` literalmente: é `pnpm coletar --ano 2025`, não `pnpm coletar -- --ano 2025` (o `parseArgs` leria o resto como posicional).
- `credor` pode ser pessoa física: fixture de teste e log nunca levam nome real.
