# CLAUDE.md

**Carregue @AGENTS.md no início de toda tarefa**, antes de explorar ou editar o repositório. Ele define stack, layout, a tabela de áreas de `docs/context/`, onde os testes rodam e as regras que valem para tudo. Este arquivo só acrescenta comportamento.

## Idioma

- Código, nomes de arquivo, docs, commits, planos e comandos de `.claude/`: pt-BR, como o código existente.

## Como trabalhar

- Planejamento só quando pedido (`/planejamento`); nada de código antes da aprovação do plano.
- Plano aprovado em `docs/plans/` é executado fase a fase, na ordem, com o teste escrito primeiro pelo `/testar`.
- Ao fim de cada fase, `/atualizar-contexto`. Commits pelo `/commit`; push é sempre do usuário.
- Antes de tocar numa área, leia o hub dela em `docs/context/`; se o código contradiz o doc, corrija o doc.
