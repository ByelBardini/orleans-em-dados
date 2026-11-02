# AGENTS.md — Orleans em Dados

Dashboard público, rastreável, com dados de receitas e despesas do município de Orleans/SC, coletados do Portal da Transparência Betha e conferidos contra o Farol TCE-SC. A especificação do produto e das fontes é `docs/ESPECIFICACAO_TECNICA.md`; a metodologia pública, `docs/METODOLOGIA.md`.

## Stack

- Node.js ≥ 22.9, pnpm (versão no `packageManager`), PostgreSQL 17 (`docker-compose.yml`, porta 5433).
- Migração em andamento de JavaScript (ESM) para TypeScript 6 strict (`tsconfig.base.json`, tsx); código novo é TypeScript, e `packages/contracts` já está.
- `apps/api`: `node:http` sem framework, SQL direto pelo `pg`.
- `apps/web`: React 19 + Vite 6, JSX, CSS próprio em `styles.css`.
- Qualidade: Vitest 5 (`vitest.config.ts`, um projeto por workspace), ESLint flat (`eslint.config.js`), Prettier (`.prettierrc.json`, largura 120).

## Layout do repositório

- `packages/db/` — esquema Drizzle, migrações (`drizzle/`), conexão e a conferência Betha × TCE-SC.
- `packages/contracts/` — valores do domínio e schemas Zod compartilhados.
- `packages/importadores/nucleo`, `betha/`, `tcesc/` — contrato e executor dos importadores, e um importador por fonte.
- `packages/importadores/` — coletores Betha e TCE-SC, gravação e publicação das coletas, CLIs.
- `apps/api/src/` — API REST que lê só as coletas publicadas.
- `apps/web/src/` — dashboard.
- `docs/` — especificação, metodologia, fontes, dicionário de dados; `docs/context/` (contexto para agentes), `docs/plans/` (planos), `docs/screens/` (mockups HTML).
- `examples/` — snapshots fictícios no formato dos reais. `data/` — snapshots reais opcionais, fora do git.
- `packages/importadores/` ainda não tem `src/`: as fontes ficam na raiz do workspace.

## Contexto por área (`docs/context/`)

Leia o hub da área antes de abrir fonte. O driver do `/testar` indica qual (`leia antes:`).

| Área         | Arquivo                                           | Cobre                                                 |
| ------------ | ------------------------------------------------- | ----------------------------------------------------- |
| Banco        | [`db.md`](docs/context/db.md)                     | tabelas, migrações, publicação por ponteiro           |
| Conferência  | [`conferencia.md`](docs/context/conferencia.md)   | regras da conferência Betha × TCE-SC                  |
| Importadores | [`importadores.md`](docs/context/importadores.md) | contrato do importador, executor, execuções           |
| Betha        | [`betha.md`](docs/context/betha.md)               | consultas, cliente, paginação e normalização da Betha |
| TCE-SC       | [`tcesc.md`](docs/context/tcesc.md)               | sessão Qlik, cubos e normalização do Farol TCE-SC     |
| Contratos    | [`contracts.md`](docs/context/contracts.md)       | dinheiro, exercício, rubrica e schemas das respostas  |
| API          | [`api.md`](docs/context/api.md)                   | rotas, parâmetros, CSV                                |
| Dashboard    | [`web.md`](docs/context/web.md)                   | páginas, componentes, formatação, selos               |

## Testes

- Specs em `<workspace>/test/` espelhando a raiz das fontes (`src/`, ou a raiz em `packages/importadores/`); integração em `<workspace>/test/integration/`.
- `describe`/`it`/`expect` importados de `vitest` (sem globals); import relativo com extensão.
- `pnpm test` roda os unit de todos os workspaces, sem banco; `pnpm exec vitest run <spec>` isola um spec; `--project @orleans-em-dados/<workspace>` filtra pelo `name` do pacote.
- `pnpm test:integracao` roda `*/test/integration/` no projeto `integracao`, contra o Postgres descartável (`pnpm db:teste` sobe na porta 5434, `pnpm db:teste:parar` derruba). O esquema é recriado a cada rodada; a porta 5433 (`pnpm db:subir`, coletas reais) é recusada.
- Antes de fechar: `pnpm test && pnpm lint`. Todo teste nasce pelo `/testar`.

## Comandos

- `pnpm db:subir`, `pnpm db:migrar`, `pnpm db:exemplos`, `pnpm dev` (API em 3000, web em 5173).
- `pnpm coletar --ano 2025 [--consulta receitas|empenhos|despesas] [--json]`, `pnpm coletar:tcesc --ano 2025`, `pnpm conferir --ano 2025`, `pnpm importar <arquivo.json>`.
- Argumento vai direto depois do script: `pnpm coletar --ano 2025`. O pnpm repassa `--` literalmente e o `parseArgs` dos coletores trataria o resto como posicional.

## Regras que valem para tudo

- Dinheiro é `NUMERIC(18,2)` no banco e soma em centavos inteiros no JS; nunca somar `number` de ponto flutuante.
- Rubrica e natureza são texto (zeros à esquerda).
- Não somar visões diferentes da mesma execução (57140 × 57170, receita × despesa).
- Diferença entre fontes nunca é rotulada como irregularidade.
- Credor pessoa física: nada de dado real em fixture, log ou commit; `data/`, `.env`, `*.har` e planilhas ficam fora do git.
