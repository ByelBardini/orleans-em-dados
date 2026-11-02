---
description: Atualiza os arquivos de docs/context com o que foi entregue na fase atual e sincroniza o AGENTS.md (tabela de áreas, stack, layout); usado como último passo de cada fase do /planejamento ou quando o usuário pedir para atualizar o contexto.
argument-hint: [opcional: resumo do que foi feito na fase]
allowed-tools: Read, Grep, Glob, Write, Edit, Bash(ls:*), Bash(find:*), Bash(mkdir:*), Bash(wc:*), Bash(git diff:*), Bash(git log:*), Bash(git status:*)
---

# /atualizar-contexto — Registrar o que a fase entregou em docs/context

Os arquivos de `docs/context/` existem para que um agente de IA planeje e codifique **sem precisar explorar a codebase inteira**. Eles são a memória do projeto: enxutos, diretos, e sempre atualizados ao fim de cada fase. O `docs/ESPECIFICACAO_TECNICA.md` é o plano do produto e o registro da investigação das fontes (o que se quer construir e por quê); o `docs/context/` é o retrato do que **existe** no código. `docs/METODOLOGIA.md`, `docs/FONTES_DE_DADOS.md`, `docs/DICIONARIO_DE_DADOS.md` e `docs/CONFERENCIA_BETHA_TCE.md` são documentação pública do projeto e não são substituídos por `docs/context/`.

## Regras invioláveis

1. **Este comando só escreve em `docs/context/` e no `AGENTS.md`.** Nenhum código, teste ou config é alterado aqui.
2. **Registre o que EXISTE, não o que foi feito.** Os arquivos descrevem o estado atual do projeto, nunca histórico ("adicionamos X na fase 2" é proibido; "existe X em `<caminho>`" é o formato).
3. **Enxuto é requisito, não estilo.** Cada linha custa contexto do agente que vai ler. Se a informação é derivável em segundos abrindo o próprio arquivo de código, ela não entra.
4. **Confirme no código antes de escrever.** Nada entra no contexto sem você ter verificado (Read/Grep) que existe de fato e onde está.
5. **Teto de 200 linhas e 25 KB por arquivo.** Nenhum arquivo de `docs/context/` sai desta execução acima disso. Estourou, divide na subpasta da área e registra no índice do hub — arquivo gordo obriga o próximo agente a carregar o domínio inteiro para mexer numa tela.

## Nome dos arquivos (o driver depende disto)

O driver do `/testar` monta o `leia antes:` pelo caminho do alvo, sem tabela de apelidos:

- **Hub de workspace** = nome da pasta do workspace: `docs/context/backend.md`, `frontend.md`, `collectors.md`, `db.md`.
- **Área** = nome da pasta dela no código (`collectors/betha` → `docs/context/betha.md`; `collectors/tcesc` → `tcesc.md`). `src`, `test`, `paginas`, `integration` e `support` são pastas estruturais e não viram área. Área grande vira hub com subpasta (`betha.md` + `betha/`), e um assunto de um workspace pode morar em `docs/context/<workspace>/<área>.md`.
- Assunto que atravessa workspaces (a conferência Betha × TCE-SC vive em `db/`, `backend/` e `frontend/`) mora no hub do workspace onde está a regra (`db.md`) e é citado pelos outros com link.
- O **conteúdo** é em pt-BR. Nome fora dessa regra faz o driver não achar o doc e o agente abrir fonte sem contexto.

## O que entra nos arquivos

- **Funções e utilitários existentes** — nome, caminho, uma linha sobre o que faz (para não reimplementar). Formatação de moeda e data do frontend, o cliente da Betha e o do TCE-SC, a transação do `db/` são o mais valioso: é o que se reescreve sem querer.
- **Componentes/módulos existentes** — o que são e onde estão.
- **Contrato** — rotas da API (`GET /api/...`, parâmetros, shape da resposta, CSV), consultas da Betha usadas (id e o que trazem), tabelas e colunas que existem.
- **Regras de negócio** — decisões de produto que o código sozinho não explica (fonte preferida de cada indicador, quando um valor é "validado", o que sai da soma, o que é dado pessoal e não é exibido).
- **Regras de arquitetura** — padrões que todo código novo deve seguir (onde vai cada coisa, convenções do projeto).
- **Armadilhas** — pegadinhas que quebram silenciosamente ou de forma não óbvia (exceção à regra 3: armadilha vale a pena documentar mesmo que seja derivável do código, porque quem cai nela não sabia que precisava olhar). Ex.: paginação por offset instável na Betha no exercício corrente.

## O que NÃO entra

- Histórico de mudanças, datas, nomes de fases ou de branches.
- O que é óbvio lendo o próprio arquivo (assinaturas completas, corpo de função).
- Documentação de bibliotecas de terceiros.
- Planos e trabalho futuro (isso mora em `docs/plans/` e na especificação).
- Dado coletado (valores, credores) — o contexto descreve a forma, nunca o conteúdo.

## Passo a passo

### 1. Levantar o que foi feito na fase

Se o usuário passou um resumo em "Entrada" abaixo, parta dele. Senão, descubra pelo estado do repositório:

```bash
git status
git diff main --stat
git log main..HEAD --oneline
```

Se estiver na `main` (diff vazio), use os commits recentes (`git log --oneline -10`) e o que aconteceu nesta conversa como fonte.

Considere apenas o **delta desde a última atualização de `docs/context/`**: o que já está documentado lá não precisa ser re-levantado, só conferido no passo 3. Se `docs/context/` ainda não existe, o delta é o repositório inteiro: crie os quatro hubs a partir do código.

Liste concretamente: arquivos criados/alterados, funções e módulos novos, decisões tomadas.

### 2. Mapear os arquivos de contexto existentes

Leia o **índice** de cada área (`docs/context/<area>.md`) e abra só os sub-arquivos que a fase tocou — área grande é hub + subpasta, e carregar a pasta inteira desperdiça o contexto que estes arquivos existem para poupar. Para cada item do passo 1, decida:

- **Encaixa em um arquivo existente** → atualiza aquele arquivo (o sub-arquivo do assunto, não o hub).
- **Não encaixa em nenhum** → cria um arquivo novo, nomeado pela regra de "Nome dos arquivos" acima, nunca pelo nome da fase ou da feature pontual.

Um domínio = um hub. Crie **hub novo** apenas quando o domínio tem stack ou responsabilidade próprias (um workspace, uma fonte de dados nova) — uma feature dentro de um domínio existente entra no arquivo daquele domínio.

**Teto por arquivo: 200 linhas e 25 KB.** Estourou, divide: o assunto vira `docs/context/<area>/<assunto>.md`, o hub fica com a intro, o que vale para a área inteira e a **tabela de índice** apontando para os filhos. Linha é métrica enganosa aqui — um parágrafo denso pesa 3 KB sozinho, então confira os dois números (`wc -lc`).

### 3. Atualizar (não só acrescentar)

Ao editar um arquivo existente:

- Se algo documentado mudou ou foi removido no código, **corrija ou apague a entrada** — contexto desatualizado é pior que contexto ausente.
- Não duplique: se a função já está listada, atualize a linha dela.
- Mantenha o formato do arquivo (template abaixo).

### 4. Sincronizar o `AGENTS.md`

O `AGENTS.md` é o índice que aponta para `docs/context/` — desatualizado, ele esconde contexto que existe. Se ele ainda não existe, crie com: stack, layout do repositório, a tabela de áreas e a seção "Testes" (runner, onde moram os specs, como roda a integração). Depois de mexer nos arquivos de contexto, confira:

- **Tabela de áreas**: uma linha por **hub** (não por sub-arquivo — quem lista os filhos é o índice do hub). Criou hub → adiciona linha; renomeou/removeu → corrige/apaga; a descrição ainda bate com o conteúdo. A descrição é **uma linha curta**: o detalhe mora no arquivo, e repeti-lo aqui custa contexto em toda sessão.
- **Stack e layout**: se a fase mudou o que essas seções descrevem (dependência nova relevante, pasta nova, runner de teste instalado), atualize-as também.

### 5. Conferir e reportar

Releia cada arquivo tocado perguntando: "um agente que só leu isto consegue codificar nesse domínio sem explorar a codebase?" Corte o que não ajuda nessa pergunta. Em área com subpasta, some a pergunta do hub: "quem só leu o índice sabe qual filho abrir?"

Confira o teto antes de reportar — tem de sair vazio:

```bash
find docs/context -name '*.md' | while read f; do
  l=$(wc -l < "$f"); c=$(wc -c < "$f")
  [ "$l" -gt 200 ] || [ "$c" -gt 25600 ] && echo "ESTOUROU: $f ($l linhas, $c bytes)"
done
```

Termine mostrando ao usuário: quais arquivos foram criados/atualizados e um resumo de uma linha por arquivo do que mudou.

## Template de arquivo de contexto

```markdown
# <Domínio> (ex.: Coleta da Betha)

<1–2 frases: o que este domínio cobre e onde vive no repositório.>

## Estrutura

- `<caminho>` — <o que fica aqui>

## Contrato

- `<GET /api/rota?param>` ou `<consulta Betha 57153>` ou `<tabela>` — <entrada, saída, quem consome>

## Funções e utilitários

- `<nome>` (`<caminho>`) — <o que faz, em uma linha>

## Componentes/Módulos

- `<nome>` (`<caminho>`) — <o que é>

## Regras de negócio

- <regra, direta ao ponto>

## Regras de arquitetura

- <padrão que código novo deve seguir>

## Testes

- <fábricas e fakes de test/support/, o que é unit e o que é integração nesta área>

## Armadilhas

- <pegadinha real e como evitar>
```

Seções vazias são removidas, não deixadas em branco.

## Template de hub (área com subpasta)

Quando a área passa do teto, o `docs/context/<area>.md` deixa de ser o conteúdo e vira o índice. Ele **mantém o nome do arquivo** — é o que faz os links cruzados de outras áreas continuarem resolvendo e o `leia antes:` do driver seguir achando o doc.

```markdown
# <Domínio>

<a mesma 1–2 frases de sempre: o que cobre e onde vive.>

> **Detalhe por assunto em [`<area>/`](<area>/) — abra só o arquivo da tarefa.** Este hub guarda <o que ficou aqui>.

| Assunto                       | Arquivo                               |
| ----------------------------- | ------------------------------------- |
| <do que trata, em meia linha> | [`<assunto>.md`](<area>/<assunto>.md) |

<as seções cross-cutting que valem para a área inteira>
```

Ao dividir:

- **Corte por assunto, não por tamanho.** Um filho é o que um agente abriria para uma tarefa: uma página, uma fonte de dados, a conferência. Cortar no meio de uma seção para bater o número gera dois arquivos que só servem juntos.
- **É recorte, não reescrita.** Nada de reescrever a prosa ao mover — a única linha nova é a do índice.
- **Armadilhas viram `<area>/armadilhas.md`**, mesmo pequeno: destino previsível vale mais que economizar arquivo. Passou do teto, quebra por tema (`armadilhas-da-paginacao.md`, `armadilhas-de-testes.md`).
- **Link de filho para outra área leva `../`** (`](../db.md)`). Confira que todo link resolve antes de reportar.
- Link que cita seção pelo nome aponta direto para o filho, não para o hub.

## Entrada

$ARGUMENTS
