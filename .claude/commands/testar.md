---
description: Escreve, completa ou audita os testes de um alvo de qualquer workspace (backend/, frontend/, collectors/, db/) pela skill testar, somando a lente de cada um — no db, a conferência entre fontes e o SQL; nos collectors, cliente HTTP com transporte falso e a normalização do que a Betha e o TCE-SC devolvem; no backend, o indicador e a rota contra Postgres descartável; no frontend, formatação e selos sem DOM e componente com Testing Library. É o passo "escrever o teste primeiro" de cada fase do /planejamento. Driver → cenários do contrato → vermelho → verde → prova de que o teste morde.
argument-hint: [spec, pasta de test/ ou arquivo/pasta de produção — ex.: db/conferencias.js] [comportamento a provar, opcional — ex.: "empenho renumerado sai do acumulado"]
allowed-tools: Skill, Read, Grep, Glob, Edit, Write, AskUserQuestion, Bash(node:*), Bash(pnpm:*), Bash(cp:*), Bash(sed:*), Bash(docker:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(ls:*), Bash(find:*)
---

# /testar — Testes de um alvo de qualquer workspace

O fluxo é o da skill `testar`: driver → contexto da área → cenários do contrato → triagem → escrever/corrigir → vermelho → verde → prova de que o teste morde → driver de novo → docs. Este comando acrescenta o que a skill não sabe sozinha: **em qual camada de teste cada coisa é provada** em cada workspace. A lente entra no passo 3 (qual cenário vira unit e qual vira integração) e no passo 6 (quando cada nível roda).

## Regras invioláveis

1. **O alvo precisa estar dentro de um workspace.** Alvo vazio → pergunte antes de qualquer coisa. Alvo que atravessa workspaces (um número que nasce na coleta, é gravado, conferido e exibido) → uma rodada por workspace, na ordem collectors → db → backend → frontend, a ordem em que o dado anda.
2. **Tudo que a skill exige continua valendo**: todo `it` pode falhar; vermelho primeiro; cenário vem do contrato; fake nomeado; um cenário por `it`; nada muda em produção de passagem.
3. **Teste não corrige bug.** Cenário prometido e não cumprido vira `it` vermelho de regressão (com referência) e item separado. A correção é outra entrega; se veio de uma fase do `/planejamento`, é o passo 3 dela.
4. **Não há cobertura para perseguir.** A régua é a tabela de cenários. Nenhum `it` nasce para "pintar linha".
5. **Dependência de teste nova é pergunta.** O runner é o Vitest 5 (um projeto por workspace no `vitest.config.ts`); qualquer outra lib de teste (Testing Library, servidor HTTP falso, `testcontainers`) só entra depois de perguntar.

## Passo a passo

1. Invoque a skill com o alvo e o comportamento (se houver): `Skill(testar, args: "<alvo> <comportamento>")` e siga os sete passos dela.
2. Antes de abrir fonte, leia o doc da área que o cabeçalho do driver apontar (`leia antes:`) **e** a seção "Testes" do `AGENTS.md`. Sem eles, `docs/ESPECIFICACAO_TECNICA.md` §7 e `docs/METODOLOGIA.md`.
3. No passo 3 da skill (cenários do contrato), acrescente a coluna **camada** a cada cenário usando a lente abaixo.
4. Os comandos (spec isolado, prova de que morde por cópia no scratchpad, Postgres descartável) estão em "Verificação por workspace" da skill; a seção "Verificação" abaixo diz **quando** cada nível roda.

## Lente do db

| o que                                                                                      | camada     | onde                                       | fake                                                     |
| ------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------ | -------------------------------------------------------- |
| Regra da conferência Betha × TCE-SC (o que confere, o que é arredondamento, o que diverge) | unit       | `db/test/conferencias.spec.js`             | nenhum; linhas de entrada de fábrica → status            |
| Consulta SQL da conferência e das cópias antigas de empenhos/receitas                      | integração | `db/test/integration/conferencias.spec.js` | Postgres descartável migrado, linhas inseridas pelo `it` |
| Migrações (`db/migrations/*.sql`)                                                          | integração | `db/test/integration/migrar.spec.js`       | Postgres descartável vazio: migrar duas vezes não quebra |

- **Regra misturada com SQL** no mesmo arquivo: prove pela integração o que só existe na query, e registre a extração da regra pura como débito (refatoração é outra entrega).
- **Dinheiro é cenário de borda**: centavo de diferença, valor negativo (estorno, anulação), soma do ano com mês faltando.

## Lente dos collectors

| o que                                                                              | camada     | onde                                         | fake                                                                                   |
| ---------------------------------------------------------------------------------- | ---------- | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| Autenticação anônima e cliente de consulta da Betha (`betha/auth.js`, `client.js`) | unit       | `collectors/test/betha/<x>.spec.js`          | `fetch` falso nomeado (`class FetchFake`) que guarda as requisições e devolve fixtures |
| Cliente Qlik do TCE-SC (`tcesc/qlik-client.js`)                                    | unit       | `collectors/test/tcesc/qlik-client.spec.js`  | transporte falso nomeado com as mensagens gravadas                                     |
| Normalização do registro (o que vira linha, o que é descartado)                    | unit       | `collectors/test/<x>.spec.js`                | nenhum; resposta de fixture → registro esperado escrito à mão                          |
| `gravar.js` (coleta, snapshot, publicação)                                         | integração | `collectors/test/integration/gravar.spec.js` | Postgres descartável                                                                   |
| Pontos de entrada (`coletar.js`, `conferir.js`, `importar-arquivo.js`)             | —          | —                                            | o que vale provar é a regra que eles chamam; CLI em si não ganha unit                  |

- **Nunca a API real no teste.** A resposta vira fixture em `collectors/test/support/`, sem dado pessoal de credor.
- **Paginação e erro de rede são cenários**: página vazia, página repetida, `401` que pede novo token, resposta sem o campo esperado (erro citando consulta e campo, nada gravado).

## Lente do backend

| o que                                                                         | camada     | onde                                      | fake                                                                |
| ----------------------------------------------------------------------------- | ---------- | ----------------------------------------- | ------------------------------------------------------------------- |
| Indicadores e leitura de coletas (`indicadores.js`, `dados.js`)               | integração | `backend/test/integration/<x>.spec.js`    | Postgres descartável com uma coleta publicada inserida pelo `it`    |
| Rotas de `server.js`: status, shape do JSON, `404` de ano sem dado, CSV       | integração | `backend/test/integration/server.spec.js` | o servidor real em porta efêmera (`listen(0)`) + `fetch` de verdade |
| Função pura que sair de `server.js`/`indicadores.js` (formato do CSV, filtro) | unit       | `backend/test/<x>.spec.js`                | nenhum                                                              |

- **O CSV é contrato**: BOM, `;`, vírgula decimal e aspas escapadas são cenários, porque é o que faz o Excel em português abrir direto.
- **Integração é cara**: um cenário por regra de contrato (status, shape, exclusão de cópias antigas, filtro por entidade); a combinatória de valores fica no unit.

## Lente do frontend

| o que                                                          | camada               | onde                                 | fake                                                                  |
| -------------------------------------------------------------- | -------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| Formatação e referências (`format.js`, `referencias.js`)       | sem DOM              | `frontend/test/<x>.spec.js`          | nenhum                                                                |
| Regra dos selos (`seloReceita`, `seloDespesa`… em `selos.jsx`) | sem DOM              | `frontend/test/selos.spec.jsx`       | nenhum; conferência de fábrica → selo                                 |
| `api.js` (`getJSON`, `useApi`): erro do servidor vira mensagem | sem DOM / componente | `frontend/test/api.spec.js`          | `fetch` falso nomeado, nunca `vi.fn()` solto em `globalThis.fetch`    |
| Componentes e páginas (`components.jsx`, `paginas/`)           | componente           | `frontend/test/paginas/<X>.spec.jsx` | Testing Library + jsdom (não instalados: dependência nova é pergunta) |

- **`Intl` é sensível ao ambiente**: o separador do `pt-BR` é espaço não separável (`R$ 1.234,56`). O esperado escrito à mão usa o caractere certo, e o cenário diz qual formato prova.
- **Asserção pelo que o usuário vê**: `getByRole`/`getByText` + `toHaveTextContent`, não `container.querySelector` nem classe CSS.
- **Callback de UI** prova os dois lados: dispara com os argumentos certos no cenário certo **e** não dispara no oposto.

## Verificação

Os comandos exatos estão em "Verificação por workspace" da skill `testar`. Este comando decide **quando** cada nível roda:

1. **Sempre**: o spec isolado (vermelho, depois verde), a prova de que o teste morde e o driver no alvo com `--min aviso` sem achado novo.
2. **Antes de fechar a rodada**: a suíte inteira (`pnpm test`) e `pnpm lint`.
3. **Integração só quando a rodada tocou SQL, gravação, migração ou rota**, e sempre no Postgres descartável da receita — nunca no banco do `pnpm db:subir`.

Teste vermelho que não é o que você acabou de escrever é a seção "Teste quebrou: entender antes de corrigir" da skill: classifique (regressão, mudança de contrato, frágil, ambiental) antes de tocar no spec.

## Docs

- Fábrica ou fake compartilhado que mudou (`test/support/`) → seção "Testes" do doc da área.
- Padrão de teste ruim corrigido → a seção "Armadilhas" do doc da área (`docs/context/<área>/armadilhas*.md` ou a seção no `<área>.md`).

## Alvo

$ARGUMENTS
