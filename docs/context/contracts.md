# Contratos

Valores do domínio e formas que atravessam o sistema, compartilhados por API, importadores e tela. Vive em `packages/contracts/src/` (pacote `@orleans-em-dados/contracts`).

## Funções e utilitários

- `dinheiro(valor)`, `centavos(d)`, `deCentavos(c)`, `somar(lista)`, `dinheiroSchema` (`dinheiro.ts`) — texto decimal com duas casas; conta em `bigint`. Aceita o `number` que a fonte devolve só com até duas casas.
- `exercicio(valor)`, `exercicioSchema` (`exercicio.ts`) — ano inteiro de quatro dígitos; aceita texto (`'2025'`).
- `codigoRubrica(valor)`, `rubricaSchema` (`rubrica.ts`) — texto com dígitos e pontos, mantendo zeros à esquerda; `number` é recusado.

## Regras de arquitetura

- Dinheiro nunca é somado como `number`: `dinheiro()` recusa `0.1 + 0.2` citando o valor.
- Construtor recusa citando o valor recebido e a forma esperada; o schema Zod repete a mesma mensagem.
