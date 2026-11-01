# Orleans em Dados

Plataforma open source para centralização, visualização e análise de dados públicos do município de Orleans/SC.

> Projeto independente, sem vínculo institucional com a Prefeitura Municipal de Orleans ou com os órgãos de controle.
> Os dados são obtidos de fontes públicas identificadas e apresentados com suas respectivas metodologias e limitações.

## O que já existe

- **Coletor Betha** (`collectors/betha`): baixa as consultas de receitas (`57153`) e empenhos (`57140`) do Portal da
  Transparência, pagina até o fim, verifica IDs e confere as somas com os totalizadores da própria consulta.
- **Banco PostgreSQL** (`db`): guarda cada coleta (bruta e normalizada) com seus totalizadores. Só coletas
  conciliadas são publicadas no dashboard; coletas rejeitadas ficam registradas para análise.
- **API** (`backend`): Node.js, somente leitura sobre as coletas publicadas.
- **Dashboard** (`frontend`): React + Vite, com visão geral, receitas, despesas/empenhos com busca, e fontes e metodologia.

## Como rodar

Requer Node.js 22.9 ou superior e Docker (para o PostgreSQL).

```bash
npm install
```

```bash
npm run db:subir
```

```bash
npm run db:migrar
```

```bash
npm run coletar -- --ano 2025
```

```bash
npm run dev
```

Depois, acesse http://localhost:5173.

Outros comandos:

- `npm run coletar -- --ano 2025 --consulta receitas` (ou `empenhos`, `despesas`) coleta só uma consulta. Com `--json`, também salva o snapshot em `data/betha/`.
- `npm run coletar:tcesc -- --ano 2025` coleta receitas e empenhos do Farol TCE-SC (inclui a Câmara). Com `--json`, salva em `data/tcesc/`.
- `npm run conferir -- --ano 2025` compara as coletas publicadas das duas fontes (ver [`docs/CONFERENCIA_BETHA_TCE.md`](docs/CONFERENCIA_BETHA_TCE.md)).
- `npm run importar -- data/betha/receitas-2025.json` importa no banco um snapshot JSON já existente.
- `npm run db:exemplos` carrega os **dados fictícios** de `examples/`. Eles só são publicados se ainda não houver dado real para o ano.

O banco roda na porta **5433** (veja `docker-compose.yml` e `.env.example`).

## Estrutura

```
collectors/
  betha/      coletor do Portal da Transparência Betha (OAuth anônimo, paginação, validação)
  tcesc/      coletor do Farol TCE-SC (Qlik Engine API, sessão anônima)
  conferir.js conferência Betha × TCE-SC sobre as coletas publicadas
  gravar.js   grava uma coleta no banco (bruto → normalizado → publicação)
db/           conexão, migrações SQL e esquema
backend/      API REST que lê as coletas publicadas
frontend/     dashboard React + Vite
docs/         especificação, dicionário de dados, fontes e metodologia
examples/     snapshots fictícios no mesmo formato dos reais
data/         snapshots JSON opcionais (fora do git)
```

## Banco de dados

| Tabela | Conteúdo |
|---|---|
| `fontes`, `consultas`, `entidades` | Catálogo: origens, consultas Betha e mapeamento de entidades |
| `coletas` | Cada execução: filtro, datas, contagens, campos ausentes, erros, status e hash |
| `totais_fonte` | Totalizador da fonte × soma calculada, por campo |
| `registros_brutos` | Registro original (`sourceAsMap`) em JSONB, imutável por coleta |
| `receitas`, `empenhos` | Dados normalizados (`NUMERIC(18,2)`, rubricas como texto, nulos preservados) |
| `publicacoes` | Qual coleta o dashboard exibe para cada consulta e ano |

Views `receitas_publicadas` e `empenhos_publicados` dão acesso direto ao conjunto exibido. Os campos estão
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

## Licença

[MIT](LICENSE)
