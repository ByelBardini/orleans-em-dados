---
name: testar
description: Escreve, completa ou audita os testes de um alvo (spec, pasta de test/ ou arquivo/pasta de produção) de qualquer workspace — apps/api/, apps/web/, packages/importadores/ ou packages/db/. Roda o driver de auditoria de testes do projeto (lugar do spec, espelho fonte ↔ test, se cada it prova alguma coisa, se o nome descreve um cenário), levanta os cenários que a fonte promete antes de escrever qualquer it e só dá o teste por pronto quando ele falha pela razão certa com o comportamento errado. Use quando o usuário pedir para testar, cobrir, escrever spec, revisar testes, corrigir um bug (regressão), investigar um teste quebrado ou falhando, ou quando uma fase do /planejamento pedir teste.
argument-hint: [spec, pasta de test/ ou arquivo/pasta de produção, relativo à raiz do repo — ex.: packages/db/conferencias.js] [comportamento a provar, opcional]
allowed-tools: Read, Grep, Glob, Edit, Write, AskUserQuestion, Bash(node:*), Bash(pnpm:*), Bash(cp:*), Bash(sed:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(ls:*), Bash(find:*)
---

# /testar — Testes que provam comportamento

O alvo chega em `$ARGUMENTS`: um spec, uma pasta de `test/` ou um arquivo/pasta de produção, mais (opcional) o comportamento que a fase quer provar. A auditoria é de `.claude/skills/testar/driver.mjs` (Node puro sobre o `typescript` da raiz, usado só como parser de JS/JSX): ele monta o espelho `fonte ↔ test`, lê cada `it` e diz onde o spec mora, se ele prova alguma coisa e se o nome descreve um cenário. O julgamento é seu: o relatório é hipótese, o contrato da fonte é a régua. Todo caminho abaixo é relativo à **raiz do repositório**.

O objetivo não é "ter teste": é ter **um teste que quebra quando o comportamento quebra**. Teste que passa com a implementação apagada, que confere o que o mock devolveu ou que existe para subir o número da cobertura não conta — sai ou vira teste de verdade.

## Regras invioláveis

1. **Todo `it` precisa poder falhar.** Antes de dar um teste por pronto, responda: _qual mudança no código de produção faz este `it` ficar vermelho?_ Se a resposta é "nenhuma", "só apagar a função" ou "só se o mock mudar", o teste não prova nada e não entra.
2. **Vermelho primeiro.** Teste de comportamento novo roda e **falha pela razão certa** antes da implementação (é o TDD do `/planejamento`). Teste de bug **reproduz o bug** antes da correção e cita de onde veio (`// Regressão: <o que quebrava> (#issue, SHA, data ou armadilha)`). Teste que já nasce verde precisa da prova de que falharia: quebre a regra de propósito, veja falhar, desfaça.
3. **Cenário vem do contrato, não da linha.** Os `it` nascem da lista "o que esta fonte promete" (passo 3): entradas válidas, bordas, erros, o que ela recusa. Nunca de "esta linha ainda não está coberta". Cobertura é consequência, não alvo.
4. **Lugar e import fixos**: spec em `<workspace>/test/` espelhando a raiz das fontes — `src/` no `apps/api/` e no `apps/web/`, a própria raiz do workspace no `packages/db/` e no `packages/importadores/` (`packages/db/conferencias.js` → `packages/db/test/conferencias.spec.js`; `packages/importadores/betha/client.js` → `packages/importadores/test/betha/client.spec.js`). Integração (Postgres real, servidor HTTP real) em `<workspace>/test/integration/`. Import relativo com extensão (`../src/format.js`), porque nenhum workspace tem alias.
5. **A unidade roda de verdade; só as bordas são falsas.** I/O externo (API da Betha, Qlik do TCE-SC, `pg`, sistema de arquivos, relógio) entra por **fake nomeado** (`class BethaClientFake` com os mesmos métodos do cliente real, guardando o que recebeu), nunca `vi.fn()` solto num objeto inline, e nunca `vi.mock` do próprio arquivo que o spec espelha.
6. **Um cenário por `it`, nome = situação + resultado**, em pt-BR como o código: "empenho renumerado sai da soma do ano", não "funciona" nem "erro". Tabela de casos é `it.each` com placeholder no nome.
7. **Nada muda em produção "de passagem".** Bug achado enquanto se testa vira teste de regressão vermelho e item separado; a correção é outra entrega (ou a fase seguinte do plano). Nenhum `.only` sobrevive; `.skip` só com o porquê na mensagem do commit.

## Pré-requisitos

Node `>=22.9` (o `engines` do `package.json`), pnpm (`packageManager` do `package.json`) e `pnpm install` feito na raiz. O driver carrega o `typescript` da raiz (devDependency, `^6`: o TypeScript 7 nativo não expõe a API de parser que o driver usa); não instala nada.

O runner é o **Vitest 5**, na raiz, com um projeto por workspace (`vitest.config.ts`): `describe`/`it`/`expect` importados de `vitest`, sem globals. `jsdom` + `@testing-library/react` entram no `apps/web` quando o primeiro spec de componente aparecer (fase 17 do plano de `docs/plans/`).

## Passo a passo

### 1. Fixar o alvo e o modo

Se `$ARGUMENTS` estiver vazio, pergunte o alvo. Ele define o modo:

| alvo                                                                            | modo          | produto                                                                                  |
| ------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| arquivo/pasta de produção sem spec, ou comportamento novo descrito no argumento | **cobrir**    | specs novos com os cenários do contrato (vermelhos primeiro se a fonte ainda não existe) |
| arquivo/pasta de produção com spec                                              | **completar** | os cenários que faltam + correção dos `it` que não provam nada                           |
| spec ou pasta de `test/`                                                        | **auditar**   | diagnóstico dos `it` + correção dos achados confirmados                                  |

O comando `/testar` acrescenta a lente de cada workspace (em qual camada cada cenário é provado); se esta skill foi invocada direto, leia a seção "Testes" do `AGENTS.md` (quando existir) antes de escrever.

### 2. Rodar o driver e ler o contexto da área

```bash
node .claude/skills/testar/driver.mjs packages/db/conferencias.js
```

O cabeçalho traz `leia antes:` com o hub do workspace e o doc da área (derivados do caminho: `packages/importadores/betha` → `docs/context/importadores.md` e `docs/context/betha.md`). **Abra esses docs antes de qualquer fonte** — é onde estão as regras que os cenários precisam provar. Enquanto `docs/context/` não existir, as regras estão em `docs/ESPECIFICACAO_TECNICA.md` (§7 regras de negócio, §11 critérios de aceite), `docs/METODOLOGIA.md`, `docs/CONFERENCIA_BETHA_TCE.md` e `docs/DICIONARIO_DE_DADOS.md`.

Variações verificadas:

```bash
node .claude/skills/testar/driver.mjs packages/importadores --min aviso
node .claude/skills/testar/driver.mjs apps/web/src --so prova,cenarios --limite 0
node .claude/skills/testar/driver.mjs apps/api --json
node .claude/skills/testar/driver.mjs --ajuda
```

| opção                     | efeito                                                                    |
| ------------------------- | ------------------------------------------------------------------------- |
| `--json`                  | espelho + resumo + achados em JSON (para guardar no scratchpad e filtrar) |
| `--min erro\|aviso\|info` | severidade mínima (padrão `info`)                                         |
| `--so a,b`                | só estas categorias                                                       |
| `--limite N`              | achados por categoria no texto (padrão 30; `0` = todos)                   |

Exit code `0` com achados, `1` erro de execução, `2` sem alvo. Uma rodada leva menos de 1 s.

**Categorias e o que cada regra significa**

| categoria  | regras                                                                                                                                                                                                                                               | o que olhar                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lugar`    | `teste-fora-de-test` (erro), `spec-importa-src-relativo` (só em workspace com alias), `mock-da-unidade-sob-teste` (erro), `spec-sem-espelho` (info)                                                                                                  | o spec está em `test/` espelhando as fontes e não mocka a própria unidade?                                                                                       |
| `espelho`  | `fonte-sem-spec`                                                                                                                                                                                                                                     | a seção `## espelho src ↔ test` lista cada fonte do alvo e quem a espelha (pelo nome ou por importar o arquivo); a sugestão traz o caminho canônico do spec novo |
| `prova`    | `teste-sem-assercao` (erro), `assercao-tautologica` (erro; aviso quando é chamada dos dois lados), `eco-do-mock`, `so-verifica-chamada`, `so-snapshot`, `assercao-fraca`, `teste-pulado`, `teste-exclusivo` (erro), `dependencia-fake-inline` (info) | o `it` observa um resultado que a unidade produziu, ou só confere que algo existe, foi chamado ou voltou o que o mock deu?                                       |
| `cenarios` | `nome-sem-cenario`, `nome-repetido`, `describe-sem-teste`, `cenario-longo` (info), `regressao-sem-referencia` (info)                                                                                                                                 | o nome diz situação + resultado? cada `it` é um cenário? a regressão diz de onde veio?                                                                           |

### 3. Levantar os cenários do contrato

Antes de escrever ou julgar qualquer `it`, abra a fonte e liste **o que ela promete**, em tabela, no scratchpad ou na própria resposta:

| cenário                                 | entrada                                    | resultado observável                                    | tipo  |
| --------------------------------------- | ------------------------------------------ | ------------------------------------------------------- | ----- |
| valores iguais nas duas fontes conferem | Betha `1.234,56`, TCE-SC `1.234,56`        | status `confere`                                        | feliz |
| diferença de centavo é arredondamento   | Betha `100,00`, TCE-SC `100,01`            | status de arredondamento, não de divergência            | borda |
| empenho renumerado não soma duas vezes  | empenho antigo e a cópia nova no mesmo ano | só a cópia nova entra no acumulado                      | borda |
| ano sem coleta publicada                | `GET /api/receitas?ano=2019` sem snapshot  | `404` com `{ erro: 'Sem dados de receitas para 2019' }` | erro  |
| resposta da Betha sem o campo esperado  | página sem `content`                       | erro citando a consulta e o campo, nada gravado         | erro  |

Fontes dos cenários, nesta ordem: o doc da área e a especificação (regra de negócio: o que é fonte preferida, quando um valor é "validado", o que sai da soma), a assinatura (o que entra, o que sai), os `throw` e os `if` da fonte (bordas e recusas), o spec existente (o que já está provado). Todo cenário de **erro** e de **borda** entra na lista; o feliz sozinho não é contrato. Cenário que a fonte promete e não cumpre é **bug**: regra 7.

Em modo **completar/auditar**, cruze a tabela com os `it` existentes: cenário sem `it` é o que falta; `it` sem cenário na tabela é candidato a sair (ou a virar cenário nomeado).

### 4. Triagem dos achados

Para cada `erro` e `aviso` do driver: abra o trecho com `Read` (offset/limit), confirme e classifique — confirmado, falso positivo (com o motivo) ou fora do escopo. Critérios que o driver não tem:

- **`eco-do-mock`** é aceitável quando a unidade só repassa e o nome do `it` diz isso ("devolve as linhas do banco sem mexer"). Se ela filtra, soma, ordena ou converte, o teste tem que conferir a transformação.
- **`so-verifica-chamada`** vira `toHaveBeenCalledWith(argumentos)` ou asserção do efeito. Callback de UI ("trocar o ano avisa a página") pode ficar em `toHaveBeenCalledTimes(1)` **se** o `it` também prova que o callback **não** dispara no cenário oposto.
- **`assercao-fraca`** em `not.toBeNull()` sobre `screen.getByText('x')` já é forte (a query carrega o esperado); o driver sabe disso. `toBeDefined()` sobre retorno de função nunca é.
- **`assercao-tautologica`** com chamada dos dois lados (`expect(f()).toEqual(f())`) só prova determinismo; se é isso que o cenário quer, o nome diz.
- **`fonte-sem-spec`** em ponto de entrada de CLI (`packages/importadores/*/coletar.js`, `packages/db/migrar.js`) e no roteamento de `apps/api/src/server.js`: o que vale provar ali é a regra que eles chamam. Se a regra está misturada com I/O no mesmo arquivo, registre como débito (a extração é refatoração, outra entrega) e prove o que der pela integração. O driver já dispensa `index.js`, `main.jsx`, `*.config.js` e `migrations/`.
- **`spec-sem-espelho`** é válido para cenário transversal; se espelha um arquivo, renomeie para o nome dele.

### 5. Escrever ou corrigir os specs

Anatomia de um `it` que vale:

```js
import { describe, expect, it } from 'vitest';
import { classificarDiferenca } from '../conferencias.js';

describe('classificarDiferenca', () => {
  it('diferença de um centavo entre Betha e TCE-SC é arredondamento', () => {
    expect(classificarDiferenca(100, 100.01)).toBe('arredondamento');
  });
});
```

- **Arrange** com fábrica (`<workspace>/test/support/`) ou fake nomeado; linha de banco ou resposta da Betha inteira escrita no spec não entra — a fábrica preenche o resto e o `it` mostra só o campo que importa.
- **Act** uma vez; **assert** o resultado observável: retorno, exceção com a mensagem citando o valor, DOM (`toHaveTextContent`), chamada **com argumentos**, linha gravada depois.
- O valor esperado é **escrito à mão** (`1234.56`), nunca calculado com a mesma função ou copiado do mock. Dinheiro: o esperado é o número exato, e o cenário de arredondamento existe à parte.
- Mesma regra, várias entradas: `it.each` com o cenário no placeholder (`'rubrica %s é receita corrente'`).
- Preparação repetida vai para `beforeEach` ou fábrica; `it` acima de 40 linhas úteis é dois cenários.

Anti-padrões que saem (o "testa por testar"):

| cheiro                                                                         | por que não prova                     | o que fazer                                  |
| ------------------------------------------------------------------------------ | ------------------------------------- | -------------------------------------------- |
| sem `expect`                                                                   | passa sempre                          | asserir o resultado ou apagar                |
| `expect(x).toBe(x)`                                                            | compara a coisa com ela mesma         | esperado à mão                               |
| confere o que o mock devolveu                                                  | prova só que a chamada passou adiante | asserir a transformação                      |
| só `toHaveBeenCalled()`                                                        | qualquer argumento passa              | `toHaveBeenCalledWith` ou o efeito           |
| só `toBeDefined`/`toBeTruthy`                                                  | `{}` e `'x'` passam igual             | `toBe`/`toEqual` do valor                    |
| só snapshot                                                                    | não diz qual comportamento importa    | asserir o texto/valor prometido              |
| testa a lib (`pg` devolve linha, `Intl.NumberFormat` formata, React renderiza) | prova a lib, não o projeto            | testar o que o projeto acrescenta            |
| testa detalhe interno (ordem de funções privadas, nome de variável de estado)  | quebra em refatoração sem bug         | testar o comportamento pela porta pública    |
| só o caminho feliz                                                             | o bug mora na borda e no erro         | um `it` por recusa e por limite              |
| `it` criado para "cobrir a linha"                                              | não corresponde a cenário nenhum      | achar o cenário; sem cenário, é código morto |

### 6. Verificar

Rode da raiz, nesta ordem:

1. **O spec novo/alterado sozinho** (comandos em "Verificação por workspace"). Em modo cobrir de comportamento novo, ele **falha** aqui; confirme que a mensagem é a da asserção, não `import` quebrado ou `TypeError`.
2. **A prova de que o teste morde** (regra 1): para cada regra nova provada, uma inversão proposital na fonte (`>` por `>=`, trocar o status) deixa o `it` vermelho. Desfaça a inversão.
3. **Driver de novo no alvo com `--min aviso`**: os achados tratados sumiram e nenhum novo apareceu.
4. **A suíte inteira** antes de fechar a rodada.

Se uma correção falhar duas vezes, pare, releia a fonte e o doc da área inteiros e diga qual premissa estava errada.

### 7. Fechamento

Entregue: a tabela cenário → `it` (o que ficou provado, o que ficou pendente e por quê); os achados descartados com o motivo em uma linha; bugs encontrados como itens separados com o teste de regressão vermelho que os prova. Padrão de teste ruim corrigido vai para a seção "Armadilhas" da área (`docs/context/<área>/armadilhas*.md` ou a seção no `<área>.md`). Fábrica ou fake compartilhado que mudou (`test/support/`) entra no doc da área.

## Teste quebrou: entender antes de corrigir

Teste vermelho pode ser a regressão que ele existe para pegar. Antes de tocar no spec:

1. **Rode o spec isolado** (comandos abaixo). Falha só na suíte inteira é ordem ou carga, não regressão.
2. **Leia a asserção que falhou e o `git diff`.** A linha do `expect` diz qual cenário quebrou; o diff diz se a mudança toca a regra.
3. **Classifique** e só então aja:

| o que aconteceu                 | sinal                                                                                 | ação                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Regressão no código             | a mudança toca a regra e o cenário do `it` continua desejado                          | corrigir o código; o teste fica como está                                                                 |
| Mudança de contrato intencional | o cenário antigo deixou de ser o comportamento pedido                                 | atualizar a asserção **e** dizer na mensagem do commit qual comportamento mudou; `docs/context` acompanha |
| Teste frágil                    | quebra por rename, ordem de chamada, `mock.calls[0]`, texto de UI que não é o cenário | reescrever a asserção sobre o resultado observável; armadilha se for padrão                               |
| Ambiental                       | passa isolado; timeout de hook; integração sem Postgres de pé                         | ver Gotchas; reproduza num spec **não tocado** para provar                                                |

Spec que muda só por rename é ajuste; spec que muda de **asserção** é mudança de comportamento e precisa de justificativa explícita. Nunca "arrume" o teste para passar sem saber qual linha da tabela é.

## Verificação por workspace

> Verificados em 01/11/2026. O nome do projeto é o `name` do `package.json` do workspace, não a pasta. O `pnpm test` não roda a integração: ela é o projeto `integracao`.

```bash
pnpm exec vitest run packages/db/test/conferencias.spec.js     # spec isolado
pnpm exec vitest run --project @orleans-em-dados/db   # um workspace (o nome do projeto é o name do package.json)
pnpm test                                        # todos os workspaces
```

Prova de que o teste morde (regra 1). O repo pode ter arquivo ainda não commitado, então a restauração é por cópia no scratchpad, nunca `git stash` nem `git checkout --` em arquivo que o git não conhece:

```bash
cp packages/db/conferencias.js "$SCRATCHPAD/conferencias.js.bak"
sed -i 's/<= 0.01/< 0.01/' packages/db/conferencias.js
pnpm exec vitest run packages/db/test/conferencias.spec.js     # 1 failed: o cenário da borda
cp "$SCRATCHPAD/conferencias.js.bak" packages/db/conferencias.js
```

Integração (tudo que passa pelo `pg`): nunca contra o banco do `pnpm db:subir`, que é o de desenvolvimento e guarda as coletas reais. Postgres descartável na porta 5434, em memória; o `globalSetup` do projeto `integracao` espera ele subir e recria o esquema pelas migrações a cada rodada:

```bash
pnpm db:teste                                                  # sobe (uma vez por sessão)
pnpm test:integracao                                           # todos os specs de */test/integration/
pnpm exec vitest run --project=integracao <caminho do spec>    # um spec
pnpm db:teste:parar                                            # derruba
```

Banco com as cinco coletas fictícias publicadas: `popularBancoDeTeste()` de `packages/importadores/test/support/banco-de-teste.js`.

## Autoteste do driver

```bash
node .claude/skills/testar/autoteste.mjs
# -> autoteste ok: 29 achados na fixture, 19 regras distintas, todos onde deviam
```

Ele roda o driver em duas fixtures: `fixtures/monorepo/` (o monorepo pnpm em TypeScript de onde a skill veio, com specs propositalmente ruins e limpos — cobre as regras de prova e de cenário) e `fixtures/npm/` (npm workspaces no layout atual deste repo: `packages/db/` sem `src/` com as fontes na raiz, `web/` com `src/` e `.jsx`, `vite.config.js`, `migrations/`). Confere regra por regra o que dispara, o que cala e quantas vezes, e falha se alguma regra disparar sem expectativa declarada. **Regra nova ou ajuste de limiar entra com uma linha na fixture e uma expectativa aqui.**

## Como o driver funciona

- `lib/base/` é o chão comum: `ambiente.mjs` (workspace do alvo, raiz das fontes — `src` ou `''` —, tipo, aliases de `tsconfig.json`/`jsconfig.json`, `typescript`; lê os workspaces do `pnpm-workspace.yaml` ou, na fixture npm, do campo `workspaces` do `package.json` da raiz), `contextos.mjs` (o `leia antes:`), `achados.mjs` (formato do achado) e `ast.mjs`.
- `lib/espelho.mjs` decide quem espelha quem: `test/` espelha a raiz das fontes; `a-sem-dono.spec.js` espelha `a.js` (prefixo mais longo ganha); sem nome parecido, vale o primeiro import que aponte para a mesma pasta. `test/integration/`, `test/support/` e `test/setup.*` não têm espelho por desenho. Fontes que dispensam spec: `index.*`, `main.*`, `*.config.*`, `migrations/`, arquivo só de tipos (e, herdados da origem, `*.plugin.*`, `*.po.*`, DTO sem `refine`).
- `lib/leitura-de-specs.mjs` lê cada spec com o parser sintático (`.js`, `.jsx`, `.mjs`, `.ts`, `.tsx`): `it`/`test` (com `skip`/`only`/`todo`/`each` e os prefixos `xit`/`fit`), `describe`, ganchos, a cadeia de cada `expect` (matcher, `not`, alvo, argumento), os valores devolvidos por `mockResolvedValue`/`mockReturnValue`/`mockImplementation`, `vi.mock`, e `new X({ f: vi.fn() })`.
- Uma categoria por arquivo: `regras-de-lugar.mjs`, `regras-de-prova.mjs`, `regras-de-cenario.mjs`; o espelho é montado no `driver.mjs`. `relatorio.mjs` imprime texto ou JSON.

## Gotchas

- **`packages/db/index.js` cai no banco de desenvolvimento** quando `DATABASE_URL` não está definida (`URL_PADRAO` na porta 5433). O spec de integração roda sempre no projeto `integracao`, que define a URL descartável e recusa a 5433 (`packages/db/test/support/setup-integracao.js`); fora dele, grava no banco das coletas reais.
- **Inversão que tira um parâmetro `$n` do SQL falha pelo motivo errado**: o Postgres recusa parâmetro sem uso e todos os `it` do arquivo ficam vermelhos. Inverta mantendo o parâmetro (`($4 OR true)`).
- **`NUMERIC` chega como `number`** (o `setTypeParser` de `packages/db/index.js`): o esperado de valor monetário em integração é `number`, e soma de centavos se confere no banco, não em JS.
- **Função asseguradora não é "sem asserção".** Função local ou importada de arquivo relativo cujo nome começa com `espera`, `assert`, `confere`, `verifica`, `garante` ou `expect` e que contém `expect` por dentro conta como asserção para quem a chama. `expect.assertions(n)` também.
- **`it.each` com `%s`/`$campo` no nome não é `nome-sem-cenario`**: o placeholder carrega o cenário. `it.each` sem placeholder e com nome curto dispara.
- **`eco-do-mock` olha os ganchos também.** Valor devolvido em `beforeEach` e conferido no `it` conta; primitivos (`null`, `true`, `1`, `''`, `[]`, `{}`) não contam, senão todo `toBe(true)` viraria eco.
- **`mock-da-unidade-sob-teste` resolve alias e relativo.** `vi.mock('../conferencias.js')` em `packages/db/test/conferencias.spec.js` é o próprio arquivo; `vi.mock` do cliente da Betha num spec de `coletar.js` é dependência e passa.
- **`regressao-sem-referencia` procura no nome e nos comentários do `it`** por `#123`, SHA de 7+ hex, data (`2026-10-14` ou `14/10/2026`), `§7.2`, `issue`, `PR` ou `armadilha`. Comentário acima do `it` conta.
- **`cenario-longo` mede linhas úteis** (sem vazias nem comentários), teto 40. A saída é fábrica ou `beforeEach`, não apagar asserção.
- **`vi.mock` é içado**: a fake mora dentro da fábrica do mock.
- **Coletor nunca chama a Betha nem o TCE-SC de verdade no teste.** A resposta real (sem dado pessoal de credor: CPF, nome de pessoa física) vira fixture em `packages/importadores/test/support/`; `data/` não é versionado e não serve de fixture.
- **Caminho no Windows**: alvo relativo com barra normal; o relatório imprime `arquivo:linha` clicável. Saída piped some se o runner pendura: redirecione para arquivo no scratchpad e leia depois.

## Troubleshooting

- **`typescript não encontrado a partir de …`**: `pnpm install` na raiz. O driver não instala nada.
- **`Nenhum workspace acima de …`**: o alvo está fora de um workspace. Aponte para dentro de `apps/api/`, `apps/web/`, `packages/importadores/` ou `packages/db/`.
- **`Alvo X não existe`**: o caminho é relativo à raiz do repo (`packages/importadores/betha`, não `betha`).
- **`categoria "x" inválida`**: os nomes válidos são `lugar`, `espelho`, `prova`, `cenarios` (sem acento).
- **O espelho aponta spec errado**: o pareamento é por prefixo do nome; spec `gravar-receitas.spec.js` espelha `gravar.js` se `gravar-receitas.js` não existe. Renomeie o spec para o nome da fonte ou aceite o pareamento por import.
