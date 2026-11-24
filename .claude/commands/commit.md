---
description: Separa as mudanças em commits atômicos com mensagens semânticas; cria branch se estiver na main; deixa a descrição do PR pronta no modelo do repositório; nunca faz push nem abre PR.
argument-hint: [contexto opcional sobre as mudanças]
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git switch:*), Bash(git checkout:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git add:*), Bash(git restore:*), Bash(git commit:*), Bash(pnpm test:*), Bash(pnpm lint:*), Bash(gh pr view:*), Read, Write, Grep, Glob, AskUserQuestion
---

# /commit — Commits atômicos com padrão semântico

Organize as mudanças atuais do repositório em commits atômicos, seguindo as regras abaixo à risca.

## Regras invioláveis

1. **NUNCA execute `git push`** — em nenhuma variação (`push`, `push -u`, `push --force`, etc.). O push é sempre decisão manual do usuário. Repare que `git push` não está na lista de comandos permitidos deste comando: isso é intencional. Pelo mesmo motivo, nunca rode `gh pr create` nem `gh pr edit`: a descrição do PR fica pronta num arquivo, e quem abre o PR é o usuário.
2. **Se estiver na `main`/`master`/`desenvolvimento`, SEMPRE crie uma branch nova antes de qualquer commit.** Nunca commite direto na main ou branch de desenvolvimento.
3. **Se já estiver em outra branch, permaneça nela.** Não crie outra branch, não faça checkout/switch para trocar.
4. **Arquivo sensível nunca entra em commit sem confirmação explícita do usuário.**
5. **Nunca use `git add .`, `git add -A` ou `git commit -a`.** Adicione arquivos explicitamente, grupo por grupo.

## Passo a passo

### 1. Levantar o estado

```bash
git branch --show-current
git status
git diff HEAD          # tudo que mudou (staged + unstaged)
git log --oneline -10  # estilo recente de mensagens do repo
```

Se não houver nenhuma mudança para commitar, informe e pare.

### 2. Criar branch (apenas se estiver na main/master)

Derive o nome do conteúdo das mudanças, em kebab-case, com prefixo padrão de mercado:

| Prefixo     | Quando usar                              |
| ----------- | ---------------------------------------- |
| `feature/`  | nova funcionalidade                      |
| `fix/`      | correção de bug                          |
| `hotfix/`   | correção urgente de produção             |
| `refactor/` | refatoração sem mudança de comportamento |
| `chore/`    | manutenção, dependências, configs        |
| `docs/`     | apenas documentação                      |

Exemplos: `feature/coleta-de-receitas-do-tce`, `fix/empenho-renumerado-somado-duas-vezes`, `refactor/regra-da-conferencia-fora-do-sql`, `chore/vitest-nos-workspaces`.

### 3. Barreira de arquivos sensíveis

Antes de qualquer `git add`, verifique se as mudanças incluem arquivos que não deveriam ser versionados:

- `.env` e variantes (`.env.local`, `.env.production`, ...) — o `.env.example` é versionado de propósito
- **dados coletados** (`data/`, snapshots JSON de coleta, exportações) — podem conter dados pessoais de credores
- **HAR e logs** (`*.har`, `*.log`) — o HAR guarda cabeçalhos `Authorization`
- planilhas e demonstrativos baixados (`*.xls`, `*.xlsx`)
- chaves e certificados (`*.pem`, `*.key`, `id_rsa*`), credenciais e tokens hardcoded
- dumps de banco e artefatos gerados (`*.sql` de dump — as migrações de `packages/db/migrations/` são versionadas —, `node_modules/`, `dist/`, `coverage/`)
- fixture de teste com CPF, CNPJ de pessoa física ou nome de credor pessoa física

Se encontrar algum: **avise o usuário via AskUserQuestion e NÃO adicione sem confirmação explícita.** Os demais commits seguem normalmente sem esses arquivos. Se não puder perguntar, deixe o arquivo de fora e liste-o no resumo final.

### 4. Separar em commits atômicos

- Um commit = um propósito. Agrupe por unidade lógica, não por conveniência.
- Nunca misture assuntos diferentes no mesmo commit (feature + formatação, refactor + fix, código + docs não relacionados).
- Prefira commits pequenos: se der para dividir de forma coerente, divida.
- Para cada grupo: `git add <arquivos específicos>` → commit → próximo grupo.
- Ordem natural: dependências primeiro (a migração do `packages/db/` vem antes ou junto do coletor que grava na tabela nova, e do api que lê dela — nunca um commit que deixa a aplicação quebrada).

### 5. Mensagem no padrão de commits semânticos

Formato: `tipo(escopo): descrição` — minúsculas, sem ponto final, primeira linha com no máximo 72 caracteres, em pt-BR. Escopo = o workspace ou a área (`api`, `web`, `importadores`, `db`, `betha`, `tcesc`, `conferencia`, `docs`, `claude`).

Tipos: `feat`, `fix`, `hotfix`, `refactor`, `test`, `docs`, `style`, `chore`, `perf`, `build`, `ci`.

Corpo opcional: use quando o motivo da mudança não for óbvio pela descrição.

**Sem assinaturas ou autoria na mensagem** — nada de `Co-Authored-By`, "Generated with Claude Code" ou emojis de assinatura.

Exemplos:

```
feat(tcesc): coleta receitas por rubrica do painel do TCE-SC
fix(conferencia): cópias antigas de empenhos fora do acumulado
refactor(db): regra de classificação sai do SQL da conferência
test(conferencia): cobre diferença de centavo como arredondamento
docs(context): atualiza contexto da conferência
chore(claude): porta comandos e skills do lorkarium
```

### 6. Descrição do PR

Preencha `.github/pull_request_template.md` e grave em `.git/descricao-do-pr.md`: fica dentro da pasta, nunca é versionado e é sobrescrito a cada execução. A descrição cobre a branch inteira (`git log main..HEAD`, `git diff main...HEAD --stat`), não só os commits desta execução. Se `gh pr view` achar um PR da branch, a descrição serve para o `gh pr edit`.

- **O que muda:** uma ou duas frases, e depois uma linha por área tocada (`db`, `api`, `web`, ...), dizendo o que existe de novo.
- **Por quê:** o problema, tirado do plano (`docs/plans/`) ou da conversa, e o link da issue, se houver. Não linke `docs/plans/`: está no `.gitignore` e não abre no GitHub. Copie o motivo para o texto.
- **Checklist:** marque `[x]` só o que foi conferido nesta execução e deixe `[ ]` no resto.
  - `pnpm test && pnpm lint`: rode os dois. Se algum falhar, deixe desmarcado e diga qual teste falhou.
  - Teste escrito antes: marque só se a conversa mostra o `/testar` daquela mudança.
  - `docs/context/`: confira no diff.
  - Dado pessoal: confira na barreira do passo 3.
  - Texto proibido: busque `validad|irregular|fraude|fantasma` nas linhas novas de `apps/web/src`.
- **Depois do deploy:** acrescente só se o plano tiver essa seção (migração, conferência em produção).
- Sem número coletado de pessoa física, sem protocolo de e-SIC e sem assinatura de autoria.

### 7. Finalizar

Mostre o resultado com `git log --oneline` dos commits criados e liste qualquer arquivo sensível deixado de fora. Depois, entregue os comandos para o usuário rodar, cada um no seu bloco, com o nome real da branch e um título no padrão semântico:

```powershell
git push -u origin <branch>
```

```powershell
gh pr create --base main --title "<tipo>: <descrição>" --body-file .git/descricao-do-pr.md
```

Se o PR já existe, entregue `gh pr edit --body-file .git/descricao-do-pr.md` no lugar do `create`. Termine aí: **o push e o PR são responsabilidade do usuário.**

## Contexto adicional do usuário

$ARGUMENTS
