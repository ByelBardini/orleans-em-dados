# Fontes de dados

| Fonte | Papel | Status no projeto |
|---|---|---|
| [Portal da Transparência Betha — Orleans](https://transparencia.betha.cloud/#/mJRAZlfGu2RI9KNBWj49aw==) | Dados operacionais de Prefeitura, FMS, SAMAE e Fundação Ambiental | **Integrada**: consultas `57153`, `57140` e `57170` |
| [TCE-SC / Farol](https://servicos.tcesc.tc.br/farol_externo/) | Conferência e Câmara Municipal | **Coletor integrado** (receitas e empenhos); ver `collectors/tcesc/README.md` |
| [SICONFI](https://www.siconfi.tesouro.gov.br/) / [API](https://apidatalake.tesouro.gov.br/docs/siconfi/) | DCA, RREO e RGF | A fazer |
| [IBGE](https://servicodados.ibge.gov.br/api/docs) | Indicadores socioeconômicos | Futuro |

## Consultas Betha integradas

| ID | Nome | Filtro de exercício | Campos somados e conferidos |
|---|---|---|---|
| `57153` | Receitas Orçamentárias | `{"ano":["AAAA"]}` | `valorOrcadoAtualizado`, `valorArrecadadoNoMes` |
| `57140` | Execução Detalhada de Despesas | `{"anoExercicio":["AAAA"]}` | `valorEmpenho`, `valorLiquidadoEmpenho`, `valorPagoEmpenho` |
| `57170` | Despesas Orçamentárias | `{"ano":["AAAA"]}` (`anoExercicio` é ignorado e traz todos os anos) | `valorEmpenhadoAtualizado`, `valorLiquidadoAtualizado`, `valorPagoAtualizado` |

Cada consulta tem um esquema de filtro próprio. Ao acrescentar uma consulta, confirme o payload real no DevTools do
portal antes de implementar.

**Paginação:** sem ordenação explícita, a paginação por offset devolveu IDs repetidos no exercício corrente (2026), e
mesmo `sortBy=id` falhou em páginas de 1.000. O coletor ordena por `id` e pede até 10.000 registros por requisição
(uma página só nos volumes atuais); se houver repetição, relê tudo até 3 vezes antes de rejeitar a coleta.

## Acesso à API Betha

- O portal obtém um token anônimo por OAuth (fluxo implícito, HTTP 303). O coletor reproduz esse fluxo. O token
  fica só em memória, é renovado antes de expirar e, em caso de `401`, renovado uma única vez.
- O cabeçalho `app-context` identifica o portal de Orleans e não é uma credencial.
- São **endpoints internos observados**, sem contrato ou SLA. A autorização para uso automatizado contínuo ainda não
  foi confirmada com a Betha ou com o município. Se o acesso anônimo deixar de existir, o projeto **não** vai
  contorná-lo (nada de navegador headless nem de burlar autenticação).
- O coletor pausa entre páginas (`BETHA_PAUSA_MS`) e repete com espera exponencial em `429` e `5xx`.

## Identificação das entidades

O segmento intermediário do ID dos registros (`211:<código>:...`) identifica a entidade:

| Código | Entidade |
|---|---|
| `728` | Prefeitura Municipal |
| `319` | Fundo Municipal de Saúde |
| `2473` | SAMAE |
| `320` | Fundação Ambiental Municipal |

Status: **inferido**. Em 2025, a soma por código reproduziu, centavo a centavo, os totais obtidos com o filtro de
entidade do portal, e os órgãos dos empenhos são coerentes com cada entidade. Ainda falta a confirmação formal no
cadastro. Fica na tabela `entidades` (coluna `status_mapeamento`), definida em `db/migrations/001_inicial.sql`.
