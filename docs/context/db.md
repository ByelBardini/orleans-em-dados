# Banco de dados e conferência

Esquema PostgreSQL, conexão e a conferência Betha × TCE-SC. Vive em `db/` (pacote `@orleans-em-dados/db`, sem `src/`: fontes na raiz).

## Estrutura

- `db/index.js` — `pool` (`pg.Pool`, máx. 5) e `transacao(fn)` (BEGIN/COMMIT/ROLLBACK).
- `db/migrar.js` — aplica em ordem os `.sql` de `db/migrations/` ainda não registrados na tabela `migracoes`.
- `db/migrations/001_inicial.sql`, `002_despesas_e_tcesc.sql` — esquema e catálogo inicial (fontes, consultas, entidades, unidades do TCE).
- `db/conferencias.js` — `conferencia(ano)`, usada pela API (`/api/conferencias`) e pelo `pnpm conferir`. Exportado como `@orleans-em-dados/db/conferencias`.

## Contrato (tabelas)

- `fontes`, `consultas` — catálogo. `consultas.id` é o id da consulta Betha (`57153`, `57140`, `57170`) ou um id interno ≥ `900001` para o TCE-SC (o UUID do app Qlik fica em `identificador_externo`). `consultas.chave` (`receitas`, `empenhos`, `despesas`, `tcesc_receitas`, `tcesc_empenhos`) é como o código se refere a cada uma.
- `entidades` — chave `codigo_betha` (segmento do meio do id Betha: `728` Prefeitura, `319` FMS, `2473` SAMAE, `320` Fundação Ambiental), com `status_mapeamento` `inferido`/`confirmado`.
- `unidades_tce` — UG do TCE-SC → `entidade_betha`; a Câmara (`1864`) não tem entidade Betha.
- `coletas` — uma por execução de coleta (consulta × ano), com `status` `totalizador_conciliado` | `rejeitado` | `exemplo`, contagens, `erros` e `hash_payload`.
- `totais_fonte` — totalizador da fonte × soma calculada, por campo.
- `registros_brutos` — payload original de cada registro (`JSONB`), por coleta.
- `publicacoes` — ponteiro (consulta, ano) → coleta exibida. Trocar o ponteiro é publicar.
- Normalizadas, por coleta: `receitas` (57153), `empenhos` (57140), `despesas` (57170), `tcesc_receitas` (900001), `tcesc_empenhos` (900002). Views `*_publicadas` juntam com `publicacoes`.

## Funções e utilitários

- `transacao(fn)` (`db/index.js`) — passa o cliente da transação para `fn`; desfaz tudo se `fn` lançar.
- `conferencia(ano)` (`db/conferencias.js`) — `{ disponivel: false, faltando }` sem as cinco coletas publicadas; senão despesa/receita por entidade, receita por mês e natureza (com nota do padrão encontrado), empenhos casados e sem par, Câmara e um `resumo`.
- `anotarNaturezas`, `anotarEmpenho` (`db/conferencias.js`, não exportadas) — a regra pura da conferência: classificam cada diferença (duplicidade, reclassificação, incoerência mês × acumulado, renumeração, registro repetido).

## Regras de negócio

- Só coleta `totalizador_conciliado` é publicada; `rejeitado` fica gravada para análise. `exemplo` só é publicada se não houver dado real para o ano (regra em `collectors/gravar.js`).
- Valor monetário é `NUMERIC(18,2)`; rubrica e natureza são texto (zeros à esquerda).
- Conferência compara só conceitos iguais, no nível comum às duas fontes: natureza da receita em 8 dígitos (Betha `17135011000000` ↔ TCE `1.7.1.3.50.1.1`).
- No exercício corrente o TCE-SC está atrasado: a conferência corta no último mês de receita e na última data de empenho que o TCE já tem (`parcial: true`). Isso é pendência, não divergência.
- Empenhos casam 1:1 por entidade, número, data e valor original. Entre repetidos na Betha, o que tem execução e id maior é o válido; as cópias antigas da 57140 ficam "só na Betha" e a API as tira das somas.
- Diferença entre fontes é informação, nunca rotulada como irregularidade; as notas dizem "provável"/"possível".

## Armadilhas

- `URL_PADRAO` em `db/index.js`: sem `DATABASE_URL`, conecta no banco de desenvolvimento (porta 5433, coletas reais). Teste define `DATABASE_URL` antes do primeiro `import` do pacote.
- `NUMERIC` é lido como `number` (`setTypeParser`): somas exatas se fazem no SQL ou em centavos inteiros, nunca somando os `number` em JS.
- `conferencia(ano)` devolve `geradoEm: new Date()`: duas chamadas nunca são iguais. Comparação de resposta ignora ou fixa esse campo.
- `receitas.valor_arrecadado_ate_mes` é acumulado: nunca somar entre meses. `receitas.mes` é inferido do sufixo `_N` do id (semântica não confirmada).
- `empenhos.numero` não é único (repete entre entidades e, em 2025, dentro do SAMAE). `valor_liquidado` `NULL` é "não informado", diferente de zero.
