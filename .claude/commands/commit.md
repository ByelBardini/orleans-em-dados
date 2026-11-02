---
description: Separa as mudanças em commits atômicos com mensagens semânticas; cria branch se estiver na main; nunca faz push.
argument-hint: [contexto opcional sobre as mudanças]
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git switch:*), Bash(git checkout:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git add:*), Bash(git restore:*), Bash(git commit:*), Read, Grep, Glob, AskUserQuestion
---

# /commit — Commits atômicos com padrão semântico

Organize as mudanças atuais do repositório em commits atômicos, seguindo as regras abaixo à risca.

## Regras invioláveis

1. **NUNCA execute `git push`** — em nenhuma variação (`push`, `push -u`, `push --force`, etc.). O push é sempre decisão manual do usuário. Repare que `git push` não está na lista de comandos permitidos deste comando: isso é intencional.
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
- dumps de banco e artefatos gerados (`*.sql` de dump — as migrações de `db/migrations/` são versionadas —, `node_modules/`, `dist/`, `coverage/`)
- fixture de teste com CPF, CNPJ de pessoa física ou nome de credor pessoa física

Se encontrar algum: **avise o usuário via AskUserQuestion e NÃO adicione sem confirmação explícita.** Os demais commits seguem normalmente sem esses arquivos. Se não puder perguntar, deixe o arquivo de fora e liste-o no resumo final.

### 4. Separar em commits atômicos

- Um commit = um propósito. Agrupe por unidade lógica, não por conveniência.
- Nunca misture assuntos diferentes no mesmo commit (feature + formatação, refactor + fix, código + docs não relacionados).
- Prefira commits pequenos: se der para dividir de forma coerente, divida.
- Para cada grupo: `git add <arquivos específicos>` → commit → próximo grupo.
- Ordem natural: dependências primeiro (a migração do `db/` vem antes ou junto do coletor que grava na tabela nova, e do backend que lê dela — nunca um commit que deixa a aplicação quebrada).

### 5. Mensagem no padrão de commits semânticos

Formato: `tipo(escopo): descrição` — minúsculas, sem ponto final, primeira linha com no máximo 72 caracteres, em pt-BR. Escopo = o workspace ou a área (`backend`, `frontend`, `collectors`, `db`, `betha`, `tcesc`, `conferencia`, `docs`, `claude`).

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

### 6. Finalizar

Mostre o resultado com `git log --oneline` dos commits criados e liste qualquer arquivo sensível deixado de fora. Termine aí: **o push é responsabilidade do usuário.**

## Contexto adicional do usuário

$ARGUMENTS
