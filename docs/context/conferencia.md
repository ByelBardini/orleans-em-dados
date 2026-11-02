# Conferência Betha × TCE-SC

Compara as coletas publicadas das duas fontes num exercício. A regra mora em `packages/db/src/conferencia/`; a API (`/api/conferencias`) e o `pnpm conferir` só chamam. A metodologia pública está em `docs/CONFERENCIA_BETHA_TCE.md`.

## Estrutura

- `conferencia.bo.ts` — regra pura e os tipos de cada linha.
- `conferencia.dao.ts` — as consultas, em SQL com o tipo da linha declarado (CTEs e `FULL JOIN` que reaproveitam `$1`/`$2`; a soma é do Postgres em `NUMERIC`).
- `conferencia.service.ts` — `conferencia(ano, agora?)`; exportado como `@orleans-em-dados/db/conferencias`, junto com `empenhosForaDaSoma`.

## Funções e utilitários

- `anotarNaturezas(linhas, repetidas, incoerentes)` — classifica cada natureza divergente (`valor`, `soBetha`, `soTce`) e escreve a nota. Ordem das explicações: incoerência mês × acumulado, duplicidade, compensação entre rubricas, tipo.
- `anotarEmpenho(e)` — nota do empenho sem par: repetido, renumerado ou sem correspondente.
- `empenhosForaDaSoma(semPar)` — ids Betha repetidos ou renumerados, que a API tira das somas.
- `ehParcial(limites)` — o TCE-SC ainda não tem dezembro de receita.
- `montarConferencia(ano, dados, agora)` — junta tudo e calcula o `resumo` em centavos.

## Regras de negócio

- Compara só conceitos iguais, no nível comum às duas fontes: natureza da receita em 8 dígitos (Betha `17135011000000` ↔ TCE `1.7.1.3.50.1.1`).
- Sem as cinco coletas publicadas (status diferente de `exemplo`), devolve `{ disponivel: false, faltando }`.
- No exercício parcial, receita e empenhos são comparados só até onde o TCE-SC já recebeu, e a despesa por entidade não é comparável (a 57170 não tem data). Atraso do TCE-SC é pendência, não divergência.
- Empenhos casam 1:1 por entidade, número, data e valor original. Entre repetidos na Betha, o que tem execução e id maior é o válido; as cópias antigas da 57140 ficam "só na Betha".
- Diferença entre fontes é informação, nunca rotulada como irregularidade; as notas dizem "provável"/"possível".

## Testes

- Unit em `packages/db/test/conferencia/conferencia.bo.spec.ts`; integração em `packages/db/test/integration/conferencia.spec.ts`, sobre as fixtures de `popularBancoDeTeste()`.

## Armadilhas

- `geradoEm` é a hora da chamada: duas respostas nunca são iguais. A paridade fixa esse campo.
