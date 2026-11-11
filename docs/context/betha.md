# Importador Betha

Portal da Transparência Betha de Orleans. Vive em `packages/importadores/betha/` (pacote `@orleans-em-dados/importador-betha`) e segue o contrato de [importadores.md](importadores.md). São endpoints internos do portal: estabilidade e autorização de uso automatizado contínuo não estão confirmadas.

## Contrato

| Chave      | Consulta | Filtro         | Campos conferidos com `/totalizadores`                                        | Tabela     |
| ---------- | -------- | -------------- | ----------------------------------------------------------------------------- | ---------- |
| `receitas` | `57153`  | `ano`          | `valorOrcadoAtualizado`, `valorArrecadadoNoMes`                               | `receitas` |
| `empenhos` | `57140`  | `anoExercicio` | `valorEmpenho`, `valorLiquidadoEmpenho`, `valorPagoEmpenho`                   | `empenhos` |
| `despesas` | `57170`  | `ano`          | `valorEmpenhadoAtualizado`, `valorLiquidadoAtualizado`, `valorPagoAtualizado` | `despesas` |

O id do registro é `<exercício>:<entidade>:<registro>`, com sufixo `_<mês>` na 57153. Em exercícios antigos (visto em 2015), a 57153 traz o mês no meio, com dois dígitos: `211:728:receita_orcamentaria_2015_01_728_411120201000000`; a rubrica da Betha (`idRubricaBetha`) é esse id sem o mês.

## Funções e utilitários

- `criarImportadorBetha({ cliente?, limite?, pausaMs?, esperar? })` (`src/importador.ts`) — declara as consultas; roda às 3h, sobre o exercício corrente e o anterior, que ainda aceita retificação. `BETHA_PAGE_SIZE` e `BETHA_PAUSA_MS` ajustam a paginação.
- `BethaAuthClient(transporte?, agora?)` (`src/auth.ts`) — token anônimo pelo fluxo implícito (HTTP 303), só em memória, renovado 60 s antes de expirar; confere o destino do redirecionamento.
- `BethaQueryClient(auth, transporte?, esperar?)` (`src/cliente.ts`) — `buscar` e `totalizadores`; em `401` renova o token uma vez, em `429`/`5xx`/erro de rede repete até 4 vezes com espera exponencial.
- `paginar(cliente, consulta, filtro, opções)` (`src/paginacao.ts`) — lê até o total e repete a leitura inteira até 3 vezes se vier inconsistente.
- `normalizarReceita`, `normalizarEmpenho`, `normalizarDespesa` (`src/normalizar.ts`) — bruto → linha, com dinheiro em texto decimal.
- `validarPorTotalizador(campos)`, `contarAusentes(registros, campos)` (`src/validar.ts`).

## Regras de negócio

- A soma em centavos tem de reproduzir o totalizador da própria consulta; qualquer diferença reprova o lote.
- Campo ausente é contado em `camposAusentes`, nunca somado como zero; liquidado nulo é "não informado", diferente de zero.
- Valor com mais de duas casas, mês fora de 1–12 no sufixo ou rubrica numérica recusam o registro, e o lote é rejeitado.

## Testes

- `test/support/transporte-fake.ts` — `TransporteHttpFake` (entrega respostas na ordem e guarda as requisições), com `json`, `status`, `tokenNoHash`, `hit`, `pagina`.
- Nenhum teste chega à Betha.

## Armadilhas

- Paginação sem ordenação é instável (em 2026 a 57153 devolveu 1.294 registros com 1.017 ids únicos): o cliente ordena por `id`, e mesmo assim o índice muda entre requisições no exercício corrente.
- Até 2017 a receita usa o plano de contas antigo: rubrica de 15 dígitos começando em `4` (corrente) ou `2`, com deduções em `9`, e não os 14 dígitos do plano de 2018 em diante. O painel agrupa pelo prefixo do plano novo, então o detalhamento desses anos não tem classificação própria. Os valores vêm líquidos da dedução do FUNDEB: em 2015, R$ 60,83 mi, contra R$ 60,94 mi líquidos no SICONFI.
- A despesa de 2015 na 57170 soma R$ 44,6 mi empenhados, contra R$ 60,8 mi no SICONFI: faltam órgãos no portal naquele ano.
- Na 57170, `anoExercicio` é ignorado e voltam todos os exercícios: o filtro dela é `ano`.
- Cópias antigas de empenho na 57140 vêm sem os campos de liquidação e com id menor (ver [conferencia.md](conferencia.md)).
- O totalizador vem como float e pode trazer resíduo (`170915184.25000012`): é arredondado ao centavo antes de comparar.
