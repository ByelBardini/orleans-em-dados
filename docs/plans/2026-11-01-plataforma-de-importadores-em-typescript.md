# Plano: plataforma de importadores em TypeScript

> **Status:** concluído em 2026-11-02
> **Data:** 2026-11-01
> **Pedido original:** migrar backend, db, coletores e frontend de JavaScript para TypeScript (Fastify + Drizzle + Zod) e transformar a coleta numa plataforma de importadores diários, sem mudar o que o dashboard mostra hoje.
> **Na especificação:** §2.2 (estrutura pronta para novos indicadores), §8 (modelo de dados), §9 etapas B e D (extração transacional e atualização contínua), §11 pendência "política de atualização, retenção, registro de erros e snapshots" e critérios de aceite "nunca publica conjunto incompleto" e "precisão monetária", §12 (tipos e validações de payload, testes de integração).

## Contexto

Hoje o lado servidor é JavaScript sem testes: um `node:http` com tabela de rotas (`backend/src/server.js`), SQL direto em `backend/src/indicadores.js` e `db/conferencias.js`, e dois coletores (Betha e TCE-SC) disparados à mão por CLI. Cada coletor repete paginação, conferência, gravação e publicação do seu jeito. O projeto vai crescer para muitos indicadores, cada um com um importador que roda todo dia. Sem um contrato comum, cada importador novo é mais um jeito de falhar em silêncio.

O que sai daqui: um monorepo pnpm em TypeScript strict, com a API em Fastify, o banco tipado por Drizzle, um pacote de contratos Zod compartilhado entre API e tela, um contrato de importador com registro de execução e um worker que agenda os importadores pelo pg-boss. O dashboard continua mostrando exatamente o que mostra hoje: a API nova só substitui a antiga quando devolve as mesmas respostas, rota por rota. A única coisa nova na tela é o aviso de dado atrasado, nas fases finais.

Muita coisa do desenho já existe e é preservada: bruto imutável por coleta (`registros_brutos`), publicação por troca de ponteiro (`publicacoes`), coleta rejeitada gravada mas nunca publicada, totalizador da fonte conferido por centavo, exemplo fictício que não substitui dado real.

**O que a pesquisa mostrou**

- **Write-audit-publish:** o padrão consagrado para pipelines de dados é gravar o lote num lugar que o consumidor não lê, rodar as checagens (contagem contra a fonte, chaves distintas, nulos em campo crítico, reconciliação) e só então promover. Se falha, produção fica intacta e o lote fica para análise. É o que `gravar.js` já faz por consulta; o plano o transforma no contrato de todos os importadores. ([PyCon LT 2024](https://uncledata.github.io/talks/write-audit-publish-pycon-lt-2024), [Tim Mitchell](https://www.timmitchell.net/etl-staging-tables/), [stage-hash-merge](https://bc-website-psi.vercel.app/articles/stage-hash-merge-building-rerun-safe-etl-pipelines-on-bigquery))
- **pg-boss (v12):** a fila precisa existir (`createQueue`) antes de agendar; `schedule()` aceita cron com fuso e `singletonKey` para não duplicar em reinício; retry por fila ou por job (`retryLimit`, `retryDelay`, `retryBackoff`). Entrega é _at-least-once_: o handler precisa ser idempotente, e erro engolido no handler conta como sucesso (sem retry). Os nomes exatos das opções são conferidos na documentação oficial antes da fase 12. ([releases](https://www.github.com/timgit/pg-boss/releases), [pg-boss sem falha silenciosa](https://poorna-11ty.pages.dev/post/pg-boss-without-silent-failures/), [guia de uso](https://skills.sh/blink-new/claude/pg-boss))
- **Migração incremental com paridade:** o padrão _strangler fig_ troca a API rota por rota, com uma mesma suíte rodando contra a versão antiga e a nova e exigindo status, shape e cabeçalhos idênticos antes de cada troca. Caminho de erro sem teste precisa de teste antes da troca, senão não há base de comparação. ([express → fastify](https://claudskills.com/skills/express-to-fastify/SKILL.md), [SpecForge](https://specforge-mcp.vercel.app/en/recipes/migration.html), [JS → TS](https://skillselion.com/skills/pproenca/dot-skills/migrate-js-to-modern-typescript))

## Decisões tomadas

| Pergunta                   | Escolha                                                                              | Por quê                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linguagem do lado servidor | TypeScript (Go e Rust descartados)                                                   | Contrato Zod compartilhado com o React, normalização de dado bagunçado mais simples, reuso das skills do lorkarium; o gargalo é I/O e limite de requisições das fontes, não CPU |
| Onde roda em produção      | servidor/container sempre ligado                                                     | Permite o worker com pg-boss: agenda, retry e histórico no próprio Postgres, sem serviço extra                                                                                  |
| Gerenciador e layout       | pnpm + `apps/` e `packages/`                                                         | Igual ao lorkarium; o pnpm barra import de dependência não declarada; cada importador tem pacote próprio                                                                        |
| Ferramental                | TypeScript 6 strict, tsx, Vitest 5 (um projeto por workspace), ESLint + Prettier     | Mesma configuração dos outros projetos; o driver da skill `testar` lê TS 6                                                                                                      |
| Alerta de falha ou atraso  | rota `/api/importacoes` + selo "dado atrasado" na tela                               | Não depende de serviço externo e o cidadão vê o atraso; e-mail ou webhook se plugam depois no mesmo ponto                                                                       |
| Schema do banco            | schema Drizzle em TS + migração baseline marcada como aplicada nos bancos existentes | Daqui pra frente toda mudança sai do schema (`drizzle-kit generate`); um teste prova que o banco migrado do zero bate com o atual                                               |
| Normalização do bruto      | `normalizar()` pura em TS, dinheiro como string decimal (`"1234.56"`), nunca float   | Testável sem banco, é o contrato combinado; o Postgres grava `NUMERIC` a partir do texto sem perder precisão                                                                    |
| Frontend                   | conversão completa para TSX neste plano                                              | Escolha do usuário; fica nas fases finais, depois da API nova servir os mesmos dados                                                                                            |
| Garantia de paridade       | respostas gravadas da API atual (JSON e CSV), comparadas rota por rota               | Uma diferença de formato que nenhum teste previu aparece na comparação, não no dashboard                                                                                        |
| Testes de UI               | Testing Library + jsdom no `apps/web`                                                | Cada página ganha spec dos estados antes de ser convertida, com asserção pelo que o usuário vê                                                                                  |

## Fontes e conferência

Nenhum indicador novo entra neste plano. Os existentes mantêm fonte, conferência e selo de hoje (especificação §7.1–§7.2); a fase 13 passa a declará-los num registro único, sem mudar nenhum valor:

- Receita arrecadada e orçada atualizada — fonte preferida: Betha `57153`; conferido contra: totalizador da `57153` e TCE-SC receitas (`900001`); selo: `totalizador_conciliado` ou o da comparação externa.
- Empenhos individualizados — fonte preferida: Betha `57140`; conferido contra: totalizador da `57140` e TCE-SC empenhos (`900002`); selo: idem.
- Despesa empenhada líquida, liquidada e paga — fonte preferida: Betha `57170`; conferido contra: totalizador da `57170` e TCE-SC; selo: idem.
- Despesa da Câmara — fonte preferida: TCE-SC; sem conferência Betha (a Câmara não está no portal Betha).
- **Novo em todos:** "atualizado em" (data do último lote publicado) e o selo de atraso quando a publicação passa da periodicidade declarada.

Dado pessoal: as fixtures de teste são fictícias; credor pessoa física não entra em fixture, resposta gravada nem log.

## O que já existe e será reaproveitado

- `db/migrations/001_inicial.sql`, `002_despesas_e_tcesc.sql` — base do schema Drizzle e da migração baseline.
- `db/index.js` (`pool`, `transacao`, parser de `NUMERIC`) — vira o cliente Drizzle de `packages/db`; o comportamento de `NUMERIC` como `number` na leitura se mantém até a paridade da API acabar.
- `db/conferencias.js` (`conferencia`, `anotarNaturezas`, `anotarEmpenho`) — as consultas vão para o DAO da conferência; as duas funções puras viram a regra testável.
- `collectors/gravar.js` — o fluxo coleta → totalizadores → bruto → normalizado → publicação vira o núcleo do framework de importadores; as regras de publicação (só conciliado; exemplo não sobrescreve real) viram cenários de teste.
- `collectors/betha/auth.js`, `client.js`, `config.js`, `coletar.js` (paginação com 3 tentativas, conferência em centavos) — viram o importador Betha.
- `collectors/tcesc/qlik-client.js`, `config.js`, `coletar.js` (centavos a partir do double do Qlik, checagem de seleções e de recarga do app) — viram o importador TCE-SC.
- `collectors/conferir.js`, `importar-arquivo.js` — viram comandos da CLI de importadores.
- `backend/src/server.js` (8 rotas, CSV com BOM, `;` e vírgula decimal), `indicadores.js`, `dados.js` — referência de comportamento das respostas gravadas e das rotas Fastify.
- `examples/betha/*.json` — base das fixtures fictícias de receitas e empenhos.
- `frontend/src/*` (~2.600 linhas de JSX/JS) — convertidos para TSX sem mudar o que exibem.
- `.claude/skills/testar` e `.claude/commands/*` — passam de npm para pnpm na fase 1.

## O que será criado do zero

- `pnpm-workspace.yaml`, `tsconfig` base, `vitest.config.ts` com projetos, ESLint e Prettier — não há ferramental de TS nem runner.
- Suíte de paridade da API (`apps/api/test/paridade/`) e fixtures fictícias das cinco consultas — não existe teste nenhum hoje.
- `packages/contracts` — schemas Zod das respostas da API, valores do domínio (dinheiro, exercício, código de rubrica) e o registro de indicadores.
- `packages/importadores/nucleo` — contrato do importador e o executor (coletar → normalizar → validar → gravar lote → publicar só se válido).
- Tabela `execucoes` — registro de cada execução de importador (início, fim, status, linhas, erro, coletas geradas); hoje só existe o registro por consulta (`coletas`).
- `apps/worker` — agendamento com pg-boss.
- Rota `/api/importacoes` e o selo "dado atrasado".
- `AGENTS.md`, `CLAUDE.md` e `docs/context/` — não existem.

## Fases

Comandos citados com pnpm valem a partir da fase 1. Toda integração roda no Postgres descartável da skill `testar`, nunca no banco do `db:subir`.

### Fase 1 — Ferramental e o primeiro spec real

**Objetivo:** monorepo pnpm com TypeScript 6, Vitest 5, ESLint e Prettier, com um spec de verdade rodando sobre o código atual.

1. `/testar frontend/src/format.js "moeda e percentual em pt-BR"` → `frontend/test/format.spec.js` com os cenários: feliz: `moeda(1234.56)` → `"R$ 1.234,56"`; borda: `moeda(null)` e `moeda(undefined)` → `"—"`; borda: `moeda(-0.5)` → valor negativo com sinal; borda: `pct(1, 3)` → uma casa com vírgula; erro: `pct(1, 0)` → o que a função promete para total zero (cenário levantado da fonte) (camada: sem DOM)
2. Rodar o spec isolado e confirmar que falha pela asserção (antes do ajuste do esperado, nunca por `import`)
3. Implementar: `pnpm-workspace.yaml` listando as pastas atuais; `packageManager` e scripts `test`, `lint`, `typecheck`, `format` no `package.json` da raiz; `tsconfig` base strict; `vitest.config.ts` com um projeto por workspace; ESLint + Prettier na configuração do lorkarium; trocar `package-lock.json` por `pnpm-lock.yaml`; `typescript` da raiz para `^6`; npm → pnpm nos comandos de `.claude/commands/` e na skill `testar` (seção "Verificação por workspace" com os comandos agora verificados)
4. Rodar e confirmar que passa; `node .claude/skills/testar/autoteste.mjs` verde; driver do `/testar` em `frontend/src/format.js` sem achado novo; `pnpm test && pnpm lint`
5. `/atualizar-contexto`: criar `AGENTS.md` (stack, layout, tabela de áreas, seção "Testes") e `CLAUDE.md` apontando para ele; criar os hubs `docs/context/backend.md`, `frontend.md`, `collectors.md`, `db.md` com o que existe

### Fase 2 — Fixtures fictícias das cinco consultas

**Objetivo:** um banco de teste populado com dados fictícios de todas as consultas que o dashboard lê, reproduzível em qualquer máquina.

1. `/testar collectors/gravar.js "publica só coleta conciliada e exemplo não sobrescreve real"` → `collectors/test/integration/gravar.spec.js` com os cenários: feliz: coleta `totalizador_conciliado` de `57153` → publicada, `publicacoes` aponta para ela; erro: coleta `rejeitado` → gravada, publicação anterior intacta; borda: coleta `exemplo` com real já publicado → não publica; borda: coleta `exemplo` sem real → publica; borda: registro com id repetido → primeira ocorrência gravada, sem erro de chave; erro: consulta sem normalização → lança citando o id da consulta (camada: integração)
2. Rodar o spec isolado e confirmar que falha pela asserção
3. Implementar: fixtures fictícias de `57153`, `57140`, `57170`, `900001` e `900002` em `collectors/test/support/fixtures/` (sem pessoa física, com negativos, nulos, rubrica com zero à esquerda, empenho renumerado e cópia antiga, divergência Betha × TCE-SC); fábrica `popularBancoDeTeste()` em `collectors/test/support/`; `setup` do projeto de integração que exige `DATABASE_URL` do banco descartável antes de qualquer `import` de `db/`
4. Rodar e confirmar que passa; inversão proposital (publicar `rejeitado`) deixa o `it` vermelho; driver sem achado novo; `pnpm test`
5. Atualizar `docs/context/collectors.md` e `db.md`: fixtures e fábrica de teste, regras de publicação, armadilha do `URL_PADRAO`

### Fase 3 — Respostas gravadas da API atual

**Objetivo:** a resposta de cada rota atual (JSON e CSV) gravada sobre o banco fictício, e uma suíte que compara qualquer API com ela.

1. `/testar backend/src/server.js "cada rota responde igual às respostas gravadas"` → `backend/test/integration/paridade.spec.js` com os cenários (um `it.each` por rota × parâmetros): feliz: `/api/anos`, `/api/receitas?ano=2025`, `/api/receitas?ano=2025&entidade=319`, `/api/despesas/resumo`, `/api/despesas/empenhos/resumo`, `/api/despesas/empenhos` com busca, órgão e página, `/api/conferencias?ano=2025` → corpo e status idênticos ao gravado; feliz: `/api/receitas.csv` e `/api/despesas/empenhos.csv` → bytes idênticos (BOM, `;`, vírgula decimal, aspas escapadas) e mesmo `Content-Disposition`; erro: ano sem coleta → `404` com `{ erro: 'Sem dados de receitas para 2019' }`; erro: rota inexistente → `404` `{ erro: 'Rota não encontrada' }`; erro: `ano=abc` → `404` (camada: integração, servidor real em porta efêmera)
2. Rodar o spec isolado e confirmar que falha (sem respostas gravadas, a comparação falha pela asserção)
3. Implementar: `backend/test/paridade/gravar-respostas.ts` (sobe a API atual sobre o banco fictício e grava `backend/test/paridade/respostas/`); a suíte recebe a URL base da API a comparar, para rodar depois contra a nova; `server.js` passa a exportar a criação do servidor sem `listen` fixo (mudança mínima, sem alterar resposta)
4. Rodar e confirmar que passa; inversão (trocar um campo em `resumoReceitas`) deixa vermelho; driver sem achado novo; `pnpm test`
5. Atualizar `docs/context/backend.md`: as 8 rotas, parâmetros e shape; a suíte de paridade e como regravar as respostas (só com motivo no commit)

### Fase 4 — Layout `apps/` e `packages/`

**Objetivo:** o código atual nas pastas finais, ainda em JS, com tudo funcionando igual.

1. `/testar backend/test/integration/paridade.spec.js "paridade continua verde após a mudança de pastas"` → auditoria da suíte existente (nenhum `it` novo; o driver confirma que os specs seguem espelhando as fontes nos caminhos novos) (camada: integração)
2. Mover com `git mv` antes de qualquer ajuste e rodar a suíte: confirmar que falha pelos caminhos de import, não por resposta diferente
3. Implementar: `backend/` → `apps/api`, `frontend/` → `apps/web`, `db/` → `packages/db`, `collectors/` → `packages/importadores` (temporariamente um pacote só); nomes dos pacotes `@orleans-em-dados/*`; `pnpm-workspace.yaml`, scripts da raiz, `.claude/launch.json`, `README.md` e `docker-compose.yml` atualizados
4. Paridade, specs das fases 1–3 e `pnpm dev` verdes; autoteste da skill `testar` verde
5. `/atualizar-contexto`: hubs renomeados (`api.md`, `web.md`, `importadores.md`, `db.md`) e o layout do `AGENTS.md`

### Fase 5 — `packages/contracts`: valores do domínio

**Objetivo:** os valores que atravessam o sistema com tipo e validação próprios.

1. `/testar packages/contracts/src "dinheiro, exercício e código de rubrica"` → `packages/contracts/test/dinheiro.spec.ts`, `exercicio.spec.ts`, `rubrica.spec.ts` com os cenários: feliz: `dinheiro("1234.56")` → 123456 centavos e volta para `"1234.56"`; borda: `"-0.01"` preservado negativo; borda: `"0.1"` → `"0.10"`; erro: `"1234.567"` (três casas) e `"1e3"` → recusa citando o valor; erro: `number` com erro de ponto flutuante (`0.1 + 0.2`) → recusa; feliz: soma em centavos de mil parcelas de `"0.10"` → `"100.00"` exato; feliz: `exercicio(2025)`; erro: `exercicio(25)` e `exercicio(2025.5)` → recusa; borda: rubrica `"0123"` mantém o zero; erro: rubrica numérica → recusa (camada: unit)
2. Rodar e confirmar que falha pela asserção
3. Implementar em `packages/contracts/src/`: `dinheiro.ts`, `exercicio.ts`, `rubrica.ts` (construtores que recusam citando o valor, schemas Zod correspondentes)
4. Passa; inversão (aceitar três casas) deixa vermelho; driver sem achado novo; `pnpm test && pnpm lint && pnpm typecheck`
5. Criar `docs/context/contracts.md`: os valores, o que cada um recusa, a regra "dinheiro nunca é float"

### Fase 6 — `packages/contracts`: schemas das respostas da API

**Objetivo:** cada resposta da API descrita por um schema Zod estrito, validado contra as respostas gravadas.

1. `/testar packages/contracts/src/api "as respostas gravadas obedecem aos schemas"` → `packages/contracts/test/api/respostas.spec.ts` com os cenários: feliz: `it.each` sobre cada resposta gravada da fase 3 → `safeParse` ok; erro: resposta com campo a mais → recusa com o caminho do campo; erro: valor monetário como string onde a API devolve `number` → recusa; borda: `null` onde a fonte não informou (ex.: `valor_liquidado`) aceito e diferente de zero; erro: corpo de erro `{ erro }` só é aceito pelo schema de erro (camada: unit)
2. Rodar e confirmar que falha pela asserção
3. Implementar em `packages/contracts/src/api/`: um schema por rota (anos, receitas, despesas/resumo, empenhos/resumo, empenhos, conferências, erro), espelhando o JSON de hoje (valores em `number`, como o dashboard recebe)
4. Passa; inversão (remover um campo obrigatório do schema) deixa vermelho; driver sem achado novo; `pnpm test && pnpm typecheck`
5. Atualizar `docs/context/contracts.md`: a tabela rota → schema

### Fase 7 — `packages/db` em TypeScript com Drizzle

**Objetivo:** schema do banco em TS, migração baseline e o cliente tipado, sem mudar nenhuma tabela.

1. `/testar packages/db/src "banco migrado do zero bate com o atual e a baseline não reaplica"` → `packages/db/test/integration/migracoes.spec.ts` com os cenários: feliz: banco vazio migrado pelo Drizzle → `information_schema` (tabelas, colunas, tipos, chaves, índices, views) idêntico ao banco criado pelas `001`/`002`; borda: banco que já tem `001` e `002` na tabela `migracoes` → baseline registrada como aplicada, nenhuma DDL executada, dados intactos; borda: migrar duas vezes → segunda execução não faz nada; feliz: `transacao` desfaz tudo quando a função lança (camada: integração)
2. Rodar e confirmar que falha pela asserção
3. Implementar em `packages/db/src/`: `schema.ts` (PO de cada tabela e as views), `cliente.ts`, `transacao.ts`, `migrar.ts` (aplica a baseline sobre bancos legados e o `drizzle-kit migrate` depois); `drizzle.config.ts`; `db/migrations/*.sql` saem do caminho de execução e ficam como referência histórica
4. Passa; paridade da API verde (o backend antigo agora importa o `db` em TS, rodando com tsx); driver sem achado novo; `pnpm test && pnpm typecheck`
5. Atualizar `docs/context/db.md`: tabelas (o que cada uma guarda), migração baseline, como gerar migração nova, armadilhas (`NUMERIC` lido como `number`, `URL_PADRAO`)

### Fase 8 — Conferência Betha × TCE-SC em TypeScript

**Objetivo:** a regra da conferência separada do SQL e provada sem banco.

1. `/testar packages/db/src/conferencia "classificação das diferenças e cópias antigas fora da soma"` → `packages/db/test/conferencia/conferencia.bo.spec.ts` com os cenários levantados de `anotarNaturezas` e `anotarEmpenho` (natureza repetida, natureza incoerente, empenho renumerado com cópia antiga, diferença zero, diferença de centavo, diferença localizada por entidade), e `packages/db/test/integration/conferencia.spec.ts`: feliz: ano com as cinco coletas publicadas → resultado igual ao da resposta gravada de `/api/conferencias`; erro: ano sem coleta do TCE-SC → `disponivel: false` com a lista do que falta (camadas: unit para a regra, integração para as consultas)
2. Rodar e confirmar que falha pela asserção
3. Implementar em `packages/db/src/conferencia/`: `conferencia.bo.ts` (as funções puras), `conferencia.dao.ts` (as consultas com `sql` tipado do Drizzle), `conferencia.service.ts` (`conferencia(ano)`)
4. Passa; paridade verde; inversão (contar a cópia antiga no acumulado) deixa o unit vermelho; driver sem achado novo; `pnpm test && pnpm typecheck`
5. Criar `docs/context/conferencia.md` (ou seção em `db.md`): regras da conferência, o que sai da soma, o que é divergência e o que não é irregularidade

### Fase 9 — Contrato do importador e o executor

**Objetivo:** todo importador declara as mesmas peças e é executado pelo mesmo fluxo write-audit-publish, com registro de execução.

1. `/testar packages/importadores/nucleo/src "executor publica só lote válido e registra a execução"` → `packages/importadores/nucleo/test/executor.service.spec.ts` com os cenários: feliz: `coletar` → `normalizar` → `validar` ok → lote gravado e publicado, execução `sucesso` com linhas lidas e gravadas; erro: `validar` reprova (total não confere) → lote gravado como `rejeitado`, publicação anterior intacta, execução `rejeitada` com os motivos; erro: `coletar` lança → nada gravado, execução `falhou` com a mensagem e sem segredo (token) no texto; erro: `normalizar` recusa um registro → execução `rejeitada` citando o id externo; borda: ordem observada no fake = gravar antes de publicar; borda: o mesmo lote executado duas vezes (entrega at-least-once) → uma publicação só, sem duplicar linha (camada: unit, com `RepositorioDeLotesFake` e `RelogioFake` nomeados) — e `packages/importadores/nucleo/test/integration/lotes.spec.ts`: troca de publicação é transacional; exemplo não sobrescreve real (camada: integração)
2. Rodar e confirmar que falha pela asserção
3. Implementar em `packages/importadores/nucleo/src/`: `importador.ts` (o contrato: `id`, `fonte`, `consultas`, `agenda`, `coletar`, `normalizar`, `validar`), `executor.service.ts`, `lotes.dao.ts`, portas de relógio e repositório; migração nova da tabela `execucoes` pelo Drizzle
4. Passa; inversão (publicar antes de validar) deixa vermelho; driver sem achado novo; `pnpm test && pnpm typecheck`
5. Criar `docs/context/importadores.md`: o contrato, o fluxo, estados de execução, como escrever um importador novo

### Fase 10 — Importador Betha no contrato

**Objetivo:** as consultas `57153`, `57140` e `57170` importadas pelo contrato, com a normalização em TS.

1. `/testar packages/importadores/betha/src "cliente, paginação, normalização e validação da Betha"` → specs em `packages/importadores/betha/test/` com os cenários: cliente — token obtido e renovado antes de expirar; `401` → renova e repete uma vez só; `429`/`5xx` → backoff limitado; token nunca aparece em erro nem log; paginação — `totalHits` mudou no meio → erro; ids repetidos → repete a leitura até 3 vezes e rejeita se persistir; normalização — `57153` com mês tirado do sufixo `_N`, rubrica como texto com zero à esquerda, acumulado nunca somado entre meses; `57140` com credor, `valor_liquidado` nulo ≠ zero; `57170` com valores já líquidos; negativos preservados; validação — soma em centavos igual ao totalizador → ok; diferença de um centavo → reprova citando o campo; totalizador ausente → reprova (camada: unit, `TransporteHttpFake` com as fixtures) — e `test/integration/betha.spec.ts`: a normalização nova sobre as fixtures gera exatamente as mesmas linhas que o SQL antigo de `gravar.js` (camada: integração)
2. Rodar e confirmar que falha pela asserção
3. Implementar em `packages/importadores/betha/src/`: `auth.ts`, `cliente.ts`, `paginacao.ts`, `normalizar.ts`, `validar.ts`, `importador.ts` (a declaração); o SQL de normalização da Betha sai de `gravar.js`
4. Passa; paridade da API verde com o banco populado pelo importador novo; inversão (tratar nulo como zero) deixa vermelho; driver sem achado novo; `pnpm test && pnpm typecheck`
5. Criar `docs/context/betha.md`: consultas, filtros, campos somados, armadilhas (paginação instável no exercício corrente, `sortBy=null`)

### Fase 11 — Importador TCE-SC no contrato

**Objetivo:** receitas e empenhos do Farol TCE-SC importados pelo contrato.

1. `/testar packages/importadores/tcesc/src "sessão Qlik, centavos e validação do TCE-SC"` → specs em `packages/importadores/tcesc/test/` com os cenários: `qNum` 170915184.25000012 → `"170915184.25"`; `qNum` fora de um centavo inteiro → recusa; nulo do Qlik (`qIsNull`, `qText '-'`) → `null`; seleções diferentes das pedidas → reprova citando as seleções; app recarregado durante a coleta → reprova com as duas datas; soma das linhas igual ao total do motor → ok; mês `'mar'` → 3 (camada: unit, `SessaoQlikFake` com as mensagens gravadas) — e integração: normalização nova = linhas do SQL antigo
2. Rodar e confirmar que falha pela asserção
3. Implementar em `packages/importadores/tcesc/src/`: `sessao-qlik.ts`, `normalizar.ts`, `validar.ts`, `importador.ts`; `gravar.js` e os `coletar.js` antigos são removidos
4. Passa; paridade verde (inclusive `/api/conferencias`); inversão (aceitar app recarregado) deixa vermelho; driver sem achado novo; `pnpm test && pnpm typecheck`
5. Criar `docs/context/tcesc.md`: apps Qlik, dimensões e medidas, armadilhas (double do motor, vínculo de unidade por nome)

### Fase 12 — CLI e worker com pg-boss

**Objetivo:** cada importador roda pela CLI e é agendado pelo worker, com retry e sem duplicar.

1. `/testar apps/worker/src "agenda, retry e singleton dos importadores"` → specs em `apps/worker/test/` com os cenários: feliz: cada importador declarado vira uma fila e um agendamento com o cron e o fuso `America/Sao_Paulo` da declaração; borda: reiniciar o worker não duplica agendamento; erro: execução que falha relança o erro → pg-boss tenta de novo até o limite, e cada tentativa é uma linha em `execucoes`; borda: duas execuções do mesmo importador e ano ao mesmo tempo → uma só ativa; feliz: `pnpm importar betha --ano 2025` executa pelo mesmo executor da fase 9; feliz: `pnpm importar --arquivo <snapshot.json>` substitui o `importar-arquivo.js` (camadas: unit para a montagem das filas a partir das declarações; integração com pg-boss no Postgres descartável)
2. Conferir na documentação oficial do pg-boss v12 os nomes de `createQueue`, `schedule`, `retryLimit`, `retryBackoff` e da política de singleton; rodar e confirmar que falha pela asserção
3. Implementar `apps/worker/src/` (`index.ts`, montagem das filas a partir das declarações) e a CLI em `packages/importadores/nucleo/src/cli.ts`; scripts da raiz `importar`, `conferir`, `worker`
4. Passa; inversão (engolir o erro no handler) deixa o cenário de retry vermelho; driver sem achado novo; `pnpm test && pnpm typecheck`
5. Atualizar `docs/context/importadores.md` (agendamento, retry, como rodar à mão) e o `AGENTS.md` (processo do worker)

### Fase 13 — Registro de indicadores e "atualizado em"

**Objetivo:** cada indicador declarado num lugar só, com a regra de atraso provada.

1. `/testar packages/contracts/src/indicadores "registro de indicadores e regra de atraso"` → `packages/contracts/test/indicadores/*.spec.ts` com os cenários: feliz: todo indicador tem fonte preferida, conferência, periodicidade e selo; erro: indicador que aponta para consulta sem importador declarado → falha a validação do registro; feliz: publicação de hoje com periodicidade diária → `em dia`; borda: publicação de ontem às 23h59 com agora 06h → `em dia` (janela da periodicidade, não dia do calendário); erro: publicação de três dias atrás com periodicidade diária → `atrasado` com a data da última publicação; borda: exercício encerrado com revalidação mensal → não fica atrasado em dois dias (camada: unit, relógio por parâmetro)
2. Rodar e confirmar que falha pela asserção
3. Implementar em `packages/contracts/src/indicadores/`: `registro.ts` (os indicadores de hoje), `atraso.ts` (função pura)
4. Passa; inversão (comparar por dia do calendário) deixa vermelho; driver sem achado novo; `pnpm test && pnpm typecheck`
5. Atualizar `docs/context/contracts.md`: o registro, a regra de atraso, como declarar indicador novo

### Fase 14 — API em Fastify: anos e receitas

**Objetivo:** primeiras rotas na API nova, idênticas às antigas.

1. `/testar apps/api/src/modules/receitas "anos, receitas e CSV de receitas iguais às respostas gravadas"` → a suíte de paridade da fase 3 rodando contra a API nova para `/api/anos`, `/api/receitas`, `/api/receitas.csv`, mais `apps/api/test/modules/receitas/csv.spec.ts`: feliz: linha com `1234.56` → `1234,56`; borda: texto com `;`, aspas e quebra de linha → escapado entre aspas; borda: `null` → célula vazia; feliz: BOM no início e `\r\n` (camadas: integração para as rotas, unit para o CSV)
2. Rodar e confirmar que falha (rotas ainda não existem → `404` diferente do gravado)
3. Implementar em `apps/api/src/`: app Fastify com o type provider do Zod (validação da query e serialização pelos schemas de `packages/contracts`), módulos `anos` e `receitas` (DAO, service, routes), `lib/csv.ts`; a API antiga continua servindo as outras rotas
4. Passa; inversão (trocar a vírgula decimal) deixa vermelho; driver sem achado novo; `pnpm test && pnpm lint && pnpm typecheck`
5. Atualizar `docs/context/api.md`: estrutura dos módulos, como uma rota usa o schema do contracts

### Fase 15 — API em Fastify: despesas e empenhos

**Objetivo:** as rotas de despesa na API nova, idênticas às antigas.

1. `/testar apps/api/src/modules/despesas "despesas, empenhos, busca e CSV iguais às respostas gravadas"` → paridade de `/api/despesas/resumo`, `/api/despesas/empenhos/resumo`, `/api/despesas/empenhos` (busca, órgão, situação, `offset`/`limit`) e `/api/despesas/empenhos.csv`; cenário próprio: cópias antigas apontadas pela conferência ficam fora das somas (camada: integração)
2. Rodar e confirmar que falha
3. Implementar `apps/api/src/modules/despesas/` e `empenhos/`; o filtro de busca vira função pura com unit próprio
4. Passa; paridade completa dessas rotas; driver sem achado novo; `pnpm test && pnpm typecheck`
5. Atualizar `docs/context/api.md`

### Fase 16 — API em Fastify: conferências, importações e desligamento da antiga

**Objetivo:** API nova completa; `server.js` removido.

1. `/testar apps/api/src/modules "conferências e importações"` → paridade de `/api/conferencias`, `404` de rota inexistente e de ano sem dado; `apps/api/test/integration/importacoes.spec.ts`: feliz: `/api/importacoes` lista cada importador com última execução, status e "atualizado em"; borda: importador que nunca rodou → aparece com status `nunca executado`; erro: a resposta nunca inclui mensagem de erro com token ou URL com credencial (camada: integração)
2. Rodar e confirmar que falha
3. Implementar `apps/api/src/modules/conferencias/` e `importacoes/`; remover `apps/api/src/server.js`, `indicadores.js`, `dados.js`; `pnpm dev` sobe a API nova e o worker
4. Paridade inteira verde contra a API nova; driver sem achado novo; `pnpm test && pnpm lint && pnpm typecheck`
5. Atualizar `docs/context/api.md` e `AGENTS.md` (a API nova, a rota de importações)

### Fase 17 — Frontend: TypeScript, Testing Library e `api.ts`

**Objetivo:** `apps/web` compilando TSX, com ambiente de teste de componente e a camada de rede validando pelos contratos.

1. `/testar apps/web/src/api.ts "resposta validada pelo contrato e erro legível"` → `apps/web/test/api.spec.ts` com os cenários: feliz: resposta que obedece ao schema → dados tipados; erro: `404` com `{ erro }` → mensagem do servidor; erro: resposta fora do schema → erro citando a rota e o campo; erro: falha de rede → mensagem "HTTP …" de hoje; borda: troca de caminho antes da resposta antiga chegar → a resposta antiga é descartada (camada: sem DOM com `FetchFake`, e componente para o `useApi`)
2. Rodar e confirmar que falha pela asserção
3. Implementar: `tsconfig` do web, Vite em TS, `@testing-library/react`, `@testing-library/jest-dom` e `jsdom` com `apps/web/test/setup.ts`; `api.js` → `api.ts` usando os schemas de `packages/contracts`
4. Passa; o dashboard no navegador idêntico; driver sem achado novo; `pnpm test && pnpm typecheck`
5. Atualizar `docs/context/web.md`: camada de rede, ambiente de teste de componente

### Fase 18 — Frontend: formatação, referências e selos em TS

**Objetivo:** a lógica sem DOM do frontend tipada e provada.

1. `/testar apps/web/src "formatação, referências e regra dos selos"` → `format.spec.ts` (o spec da fase 1 convertido), `referencias.spec.ts` (`populacao(ano)`, `sujeito(entidade)`), `selos.spec.ts` (`seloReceita`, `seloEmpenhos`, `seloDespesa`, `seloRubrica`, `seloEmpenho`: conferência sem divergência → selo conciliado; com divergência → selo de divergência sem chamar de erro; sem coleta do TCE-SC → pendente) (camada: sem DOM)
2. Rodar e confirmar que falha pela asserção
3. Implementar: `format.ts`, `referencias.ts` e a regra dos selos extraída de `selos.jsx` para `selos.ts` (o componente `Selo` fica em `selos.tsx`)
4. Passa; inversão (selo conciliado com divergência) deixa vermelho; driver sem achado novo; `pnpm test && pnpm typecheck`
5. Atualizar `docs/context/web.md`

### Fase 19 — Frontend: componentes compartilhados em TSX

**Objetivo:** `components.jsx` e `App.jsx` em TSX, sem mudar o que exibem.

1. `/testar apps/web/src/components.tsx "estados e números dos componentes compartilhados"` → `apps/web/test/components.spec.tsx` com os cenários: `Estado` carregando e erro; `Numero` com rótulo, valor e selo; `Filtros` troca o ano e avisa só quando muda; `Alternador` marca a opção ativa; `escala(maximo)` (pura) gera as linhas da régua; `Fonte` mostra fonte, consulta e "atualizado em"; `App` navega pelas abas pelo hash (camada: componente, e sem DOM para `escala`)
2. Rodar e confirmar que falha
3. Implementar: `components.jsx` → `components.tsx`, `App.jsx` → `App.tsx`, `main.jsx` → `main.tsx`
4. Passa; o dashboard no navegador idêntico (claro, escuro e largura de celular); driver sem achado novo; `pnpm test && pnpm typecheck`
5. Atualizar `docs/context/web.md`: componentes e o que cada um recebe

### Fase 20 — Frontend: páginas em TSX

**Objetivo:** as cinco páginas em TSX, cada uma com spec dos seus estados.

1. `/testar apps/web/src/paginas "estados de cada página"` → um spec por página em `apps/web/test/paginas/` com os cenários: carregando; erro do servidor; ano sem coleta publicada; dados de exemplo marcados como fictícios; dado conferido com selo; em `Despesas`, busca de empenho e paginação; em `Conferencia`, divergência apresentada sem classificação de irregularidade (camada: componente, `ServidorApiFake` com as respostas gravadas da fase 3)
2. Rodar e confirmar que falha
3. Implementar: `VisaoGeral`, `Receitas`, `Despesas`, `Conferencia` e `Metodologia` em TSX (uma página por commit, cada uma com o spec verde antes da próxima)
4. Passa; o dashboard no navegador idêntico; driver sem achado novo; `pnpm test && pnpm lint && pnpm typecheck`
5. Atualizar `docs/context/web.md`: páginas, de qual rota cada uma lê

### Fase 21 — Selo "dado atrasado" na tela

**Objetivo:** a única mudança visível do plano: o cidadão vê quando um dado está atrasado.

1. `/testar apps/web/src/selos.tsx "selo de dado atrasado"` → cenários: indicador em dia → nenhum aviso; indicador atrasado → selo "dado atrasado" com a data da última atualização, ao lado do selo de conferência (não no lugar dele); `/api/importacoes` fora do ar → a página continua mostrando o dado, sem aviso falso (camada: componente)
2. Rodar e confirmar que falha
3. Implementar: o selo usando `atraso()` de `packages/contracts` e a rota `/api/importacoes`; o campo "atualizado em" já exibido pela `Fonte`
4. Passa; conferir no navegador; driver sem achado novo; `pnpm test && pnpm typecheck`
5. Atualizar `docs/context/web.md` e `docs/METODOLOGIA.md` (o que significa "dado atrasado")

## Fora do escopo

- **Indicadores novos** (saúde, educação, RCL, pessoal, IBGE): este plano entrega a plataforma; cada indicador novo é um plano próprio, com fonte, conferência e selo.
- **Skills `desenvolver-server` e `desenvolver-importador`**: a adaptação da primeira e a criação da segunda vêm depois deste plano, sobre a arquitetura que ele deixar pronta.
- **Deploy** (Dockerfile da API e do worker, compose de produção, backup do banco): depende do servidor escolhido; entra quando a hospedagem estiver definida.
- **Alerta por e-mail ou webhook**: o ponto de extensão fica pronto nas fases 9 e 16 (tabela `execucoes` e `/api/importacoes`); o canal é decisão posterior.
- **Pendências da especificação §11** que não são de código (legalidade do acesso à Betha, filtro exato da `57170`, conciliação das cinco rubricas): a migração preserva o comportamento atual e não as resolve.
- **Mudança de formato das respostas da API** (por exemplo, dinheiro como string no JSON): a paridade exige o JSON de hoje; trocar o formato é uma mudança de contrato separada, com o frontend junto.
