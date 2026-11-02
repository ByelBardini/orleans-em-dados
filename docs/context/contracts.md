# Contratos

Valores do domínio e formas que atravessam o sistema, compartilhados por API, importadores e tela. Vive em `packages/contracts/src/` (pacote `@orleans-em-dados/contracts`).

## Funções e utilitários

- `dinheiro(valor)`, `centavos(d)`, `deCentavos(c)`, `somar(lista)`, `dinheiroSchema` (`dinheiro.ts`) — texto decimal com duas casas; conta em `bigint`. Aceita o `number` que a fonte devolve só com até duas casas.
- `exercicio(valor)`, `exercicioSchema` (`exercicio.ts`) — ano inteiro de quatro dígitos; aceita texto (`'2025'`).
- `codigoRubrica(valor)`, `rubricaSchema` (`rubrica.ts`) — texto com dígitos e pontos, mantendo zeros à esquerda; `number` é recusado.

## Contrato

Um schema Zod estrito por rota da API (`src/api/`), espelhando o JSON de hoje (dinheiro como `number | null`):

| Rota                                | Schema                 |
| ----------------------------------- | ---------------------- |
| `GET /api/anos`                     | `anosSchema`           |
| `GET /api/receitas`                 | `receitasSchema`       |
| `GET /api/despesas/resumo`          | `despesasResumoSchema` |
| `GET /api/despesas/empenhos/resumo` | `empenhosResumoSchema` |
| `GET /api/despesas/empenhos`        | `empenhosBuscaSchema`  |
| `GET /api/conferencias`             | `conferenciaSchema`    |
| qualquer `4xx`/`5xx`                | `erroSchema`           |

## Testes

- `test/api/respostas.spec.ts` valida as respostas gravadas de `apps/api/test/paridade/respostas/` contra os schemas.

## Regras de arquitetura

- Campo só é não nulo quando a coluna é obrigatória ou o SQL garante: soma sobre recorte vazio é `NULL`, e os `FULL JOIN` da conferência deixam um lado nulo. A fixture não mostra todos esses casos.

- Dinheiro nunca é somado como `number`: `dinheiro()` recusa `0.1 + 0.2` citando o valor.
- Construtor recusa citando o valor recebido e a forma esperada; o schema Zod repete a mesma mensagem.
