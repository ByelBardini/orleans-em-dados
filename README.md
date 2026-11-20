# Orleans em Dados

[![Testes](https://github.com/ByelBardini/orleans-em-dados/actions/workflows/testes.yml/badge.svg)](https://github.com/ByelBardini/orleans-em-dados/actions/workflows/testes.yml)
[![Código: MIT](https://img.shields.io/badge/c%C3%B3digo-MIT-blue.svg)](LICENSE)
[![Conteúdo: CC BY 4.0](https://img.shields.io/badge/conte%C3%BAdo-CC%20BY%204.0-lightgrey.svg)](LICENCA-DO-CONTEUDO.md)

Plataforma open source para centralização, visualização e análise de dados públicos do município de Orleans/SC.

> Projeto independente, sem vínculo institucional com a Prefeitura Municipal de Orleans ou com os órgãos de controle.
> Os dados são obtidos de fontes públicas identificadas e apresentados com suas respectivas metodologias e limitações.

## Fontes

| Fonte                                                                                                                                                                                                                    | O que traz                                               | Como entra          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------- |
| [Portal da Transparência de Orleans (Betha)](https://transparencia.betha.cloud/#/mJRAZlfGu2RI9KNBWj49aw==)                                                                                                               | receitas, empenhos e despesa orçamentária                | coleta diária       |
| [Farol do TCE-SC](https://servicos.tcesc.tc.br/farol_externo/)                                                                                                                                                           | receitas e empenhos, para a conferência; a Câmara        | coleta diária       |
| [SICONFI](https://www.siconfi.tesouro.gov.br/)                                                                                                                                                                           | despesa por função (DCA Anexo I-E) e índices de educação | coleta              |
| [IBGE](https://servicodados.ibge.gov.br/api/docs)                                                                                                                                                                        | população, Censo 2022, PIB, rendimento                   | coleta              |
| [INEP](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos), [SIOPE](https://www.gov.br/fnde/pt-br/assuntos/sistemas/siope), [MEC](https://www.gov.br/mec/pt-br/pnei/retrato-da-educacao-infantil-no-brasil) | o caderno de Educação                                    | snapshot versionado |

O painel só mostra como número principal o que confere entre duas fontes ou o que tem uma fonte só, rotulada assim. O que não fecha vai para a página Discrepâncias, com a conta; diferença entre fontes não indica irregularidade. Detalhes em [docs/METODOLOGIA.md](docs/METODOLOGIA.md).

## O que já existe

- **Importadores** (`packages/importadores`): um por fonte, sobre o mesmo contrato: Portal da Transparência Betha (receitas, empenhos e despesa orçamentária), Farol TCE-SC, SICONFI (despesa por função, DCA Anexo I-E) e IBGE (população, Censo 2022 e PIB). Cada coleta é validada contra o total da própria fonte antes de publicar.
- **Worker** (`apps/worker`): agenda os importadores com pg-boss e registra cada execução.
- **Banco PostgreSQL** (`packages/db`): guarda cada coleta (bruta e normalizada) com seus totalizadores. Só coletas conciliadas são publicadas no dashboard; coletas rejeitadas ficam registradas para análise.
- **API** (`apps/api`): Node.js, somente leitura sobre as coletas publicadas.
- **Dashboard** (`apps/web`): React + Vite, com a capa, Conheça Orleans, finanças, para onde vai o dinheiro, receitas, despesas/empenhos com busca, conferência entre fontes, e fontes e metodologia.

## Como rodar

Requer Node.js 22.9 ou superior, pnpm (`corepack enable` instala a versão do `packageManager`) e Docker (para o PostgreSQL).

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
pnpm importar betha --ano 2025
```

```bash
pnpm dev
```

Depois, acesse http://localhost:5173.

Outros comandos:

- `pnpm importar betha --ano 2025 --consulta receitas` (ou `empenhos`, `despesas`) coleta só uma consulta. Com `--json`, também salva o snapshot em `data/betha/`.
- `pnpm importar tcesc --ano 2025` coleta receitas e empenhos do Farol TCE-SC (inclui a Câmara). Com `--json`, salva em `data/tcesc/`.
- `pnpm importar ibge --ano 2026` coleta população, Censo 2022 e PIB. O lote traz a série inteira, e `--ano` é o ano da coleta.
- `pnpm importar siconfi --ano 2025` coleta a despesa por função do exercício (dá para carregar de 2018 em diante).
- `pnpm conferir --ano 2025` compara as coletas publicadas das duas fontes (ver [`docs/CONFERENCIA_BETHA_TCE.md`](docs/CONFERENCIA_BETHA_TCE.md)).
- `pnpm importar --arquivo data/betha/receitas-2025.json` importa no banco um snapshot JSON já existente.
- `pnpm worker` sobe o agendador: Betha às 3h e TCE-SC às 4h, no exercício corrente e no anterior; IBGE e SICONFI uma vez por mês.
- `pnpm db:exemplos` carrega os **dados fictícios** de `examples/`. Eles só são publicados se ainda não houver dado real para o ano.

O banco roda na porta **5433** (veja `docker-compose.yml` e `.env.example`).

## Estrutura

```
apps/
  api/        API REST que lê as coletas publicadas
  web/        dashboard React + Vite
  worker/     agendador e CLI dos importadores
packages/
  contracts/  valores do domínio e schemas compartilhados
  db/         esquema, migrações e conexão
  importadores/
    nucleo/   contrato do importador e executor
    betha/    Portal da Transparência Betha (OAuth anônimo, paginação, validação)
    tcesc/    Farol TCE-SC (Qlik Engine API, sessão anônima)
    ibge/     agregados do IBGE (população, Censo 2022 e PIB)
    siconfi/  DCA Anexo I-E do SICONFI (despesa por função)
    fixtures/ dados fictícios dos testes
docs/         especificação, dicionário de dados, fontes e metodologia
examples/     snapshots fictícios no mesmo formato dos reais
data/         snapshots JSON opcionais (fora do git)
```

## Banco de dados

| Tabela                             | Conteúdo                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `fontes`, `consultas`, `entidades` | Catálogo: origens, consultas Betha e mapeamento de entidades                   |
| `coletas`                          | Cada execução: filtro, datas, contagens, campos ausentes, erros, status e hash |
| `totais_fonte`                     | Totalizador da fonte × soma calculada, por campo                               |
| `registros_brutos`                 | Registro original (`sourceAsMap`) em JSONB, imutável por coleta                |
| `receitas`, `empenhos`             | Dados normalizados (`NUMERIC(18,2)`, rubricas como texto, nulos preservados)   |
| `siconfi_funcoes`, `ibge_valores`  | Despesa por função e agregados do IBGE, por coleta, com símbolo sem virar zero |
| `publicacoes`                      | Qual coleta o dashboard exibe para cada consulta e ano                         |

Views `receitas_publicadas`, `empenhos_publicados`, `siconfi_funcoes_publicadas` e `ibge_valores_publicados` dão acesso direto ao conjunto exibido. Os campos estão
descritos em [docs/DICIONARIO_DE_DADOS.md](docs/DICIONARIO_DE_DADOS.md).

## Dados e privacidade

O código é aberto, mas os dados coletados **não são versionados**: ficam no banco local e, opcionalmente, em
`data/`, que está no `.gitignore`, porque os empenhos trazem nomes de credores, que podem ser pessoas físicas. Também não são versionados tokens, arquivos `.env`, HAR ou
planilhas baixadas.

O coletor usa endpoints internos observados no portal Betha. A estabilidade e a autorização para uso automatizado
contínuo ainda não foram confirmadas. Veja [docs/FONTES_DE_DADOS.md](docs/FONTES_DE_DADOS.md).

## Documentação

- [Especificação técnica](docs/ESPECIFICACAO_TECNICA.md)
- [Dicionário de dados](docs/DICIONARIO_DE_DADOS.md)
- [Fontes de dados](docs/FONTES_DE_DADOS.md)
- [Metodologia](docs/METODOLOGIA.md)

## Como contribuir

Dá para ajudar avisando de um número que não bate com a fonte (modelo de issue **Dado divergente**), sugerindo uma página ou mexendo no código. O passo a passo, as convenções e as regras que não se quebram estão no [CONTRIBUTING.md](CONTRIBUTING.md). Quem participa segue o [Código de Conduta](CODE_OF_CONDUCT.md). Falha de segurança ou dado pessoal exposto: [SECURITY.md](SECURITY.md), nunca em issue pública.

## Apoie

O projeto é mantido por uma pessoa, sem vínculo com a Prefeitura nem com órgão nenhum. Com o Pix configurado no servidor, o site tem a página **Apoiar** (`/apoiar`), com o QR e o copia e cola; o apoio paga a hospedagem e o domínio.

## Licença

O código está sob a licença [MIT](LICENSE). Os textos e os dados que o painel, a API e os CSV entregam estão sob [CC BY 4.0](LICENCA-DO-CONTEUDO.md): podem ser reusados com crédito. Os dados de origem seguem as condições de cada fonte.
