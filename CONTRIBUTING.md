# Como contribuir

Obrigado pelo interesse. O Orleans em Dados publica os dados públicos de Orleans/SC (receitas, despesas, educação e a cidade) com a fonte de cada número e a conferência entre as fontes. É um projeto independente, sem vínculo com a Prefeitura de Orleans nem com os órgãos de controle.

Dá para ajudar sem programar: avisar de um número que não bate com a fonte, sugerir uma página, revisar um texto. E dá para ajudar com código: um importador novo, uma página, um teste.

## Antes de começar

- Leia o [`AGENTS.md`](AGENTS.md): stack, layout do repositório, comandos e as regras que valem para tudo.
- Antes de mexer numa área, leia o hub dela em [`docs/context/`](docs/context/) (banco, conferência, importadores, API, dashboard…). Se o código contradiz o doc, o doc é corrigido junto.
- A especificação do produto está em [`docs/ESPECIFICACAO_TECNICA.md`](docs/ESPECIFICACAO_TECNICA.md), e a metodologia pública em [`docs/METODOLOGIA.md`](docs/METODOLOGIA.md).

## Como rodar

Requer Node.js 22.9 ou superior, pnpm (`corepack enable` instala a versão do `packageManager`) e Docker.

```bash
pnpm install
```

```bash
pnpm db:subir
```

```bash
pnpm db:migrar
```

```bash
pnpm db:exemplos
```

```bash
pnpm dev
```

O `db:exemplos` carrega dados **fictícios** de `examples/`, suficientes para ver todas as páginas. Para os dados reais, `pnpm importar betha --ano 2025` (e `tcesc`, `ibge`, `siconfi`). O painel abre em http://localhost:5173, e a API em http://localhost:3000.

## Testes

- `pnpm test && pnpm lint` antes de abrir o PR. O `pnpm test` roda os testes de unidade de todos os workspaces, sem banco.
- Integração (o que passa pelo PostgreSQL): `pnpm db:teste` sobe um Postgres descartável na porta 5434, e `pnpm test:integracao` roda os specs de `*/test/integration/`. Nunca contra o banco do `pnpm db:subir`, que guarda as coletas.
- Todo teste nasce de um cenário que a fonte promete (feliz, borda, erro) e falha antes de a implementação existir. Teste que passa com o código apagado não entra.
- Os specs ficam em `<workspace>/test/`, espelhando `src/`.

## Convenções

- Tudo em português do Brasil: código, nomes de arquivo, docs e commits.
- Commits semânticos (`feat(web): …`, `fix(api): …`, `docs(context): …`), um propósito por commit, e uma branch por mudança (`feature/…`, `fix/…`).
- Prettier com largura 120 (`pnpm format`) e ESLint (`pnpm lint`).
- Dinheiro é `NUMERIC(18,2)` no banco e soma em centavos inteiros no JS, nunca `number` de ponto flutuante.
- Rubrica e natureza são texto, com os zeros à esquerda.

## Regras que não se quebram

- **Diferença entre fontes não é irregularidade.** Nenhum texto, rótulo ou commit trata uma diferença entre a Betha e o TCE-SC (ou entre outras fontes) como fraude, erro do município ou coisa parecida. O que difere vai para a página Discrepâncias, com a conta.
- **Número público é conferido ou de fonte única rotulada.** O painel só mostra como número principal o que confere entre duas fontes ou o que tem uma fonte só, com o selo dizendo isso. Na interface, "conferido com…", nunca "validado".
- **Nada de dado de pessoa física** em fixture, log, issue, PR ou commit: nome de credor pessoa física, CPF, descrição de empenho de pessoa física. `data/`, `.env`, `*.har` e planilhas baixadas ficam fora do git.

## Relatar um dado divergente

Achou um número no painel diferente do que a fonte publica? Abra uma issue com o modelo **Dado divergente**: a página, o exercício, o valor no painel, o valor na fonte e o link da fonte. Uma diferença entre fontes não é, sozinha, sinal de problema; e não cole nome de pessoa física na issue.

Falha de segurança (inclusive exposição de dado pessoal) não vai em issue pública: veja o [`SECURITY.md`](SECURITY.md).

## Pull requests

1. Faça um fork e crie uma branch a partir da `main`.
2. Faça a mudança com o teste junto, e atualize o `docs/context/` da área se o comportamento mudou.
3. Rode `pnpm test && pnpm lint`.
4. Abra o PR e preencha o modelo: o que muda, por quê e a checklist.

A CI roda lint, formato, tipos, os testes de unidade, a integração e a imagem Docker, cada parte só quando o que ela cobre mudou.

## Conduta e licença

Quem participa segue o [Código de Conduta](CODE_OF_CONDUCT.md). O código é [MIT](LICENSE); os textos e os dados que o painel entrega são [CC BY 4.0](LICENCA-DO-CONTEUDO.md). Ao contribuir, você concorda em licenciar sua contribuição nesses termos.
