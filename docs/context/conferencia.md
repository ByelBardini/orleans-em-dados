# Conferência Betha × TCE-SC

Compara as coletas publicadas das duas fontes num exercício. A regra mora em `packages/db/src/conferencia/`; a API (`/api/conferencias`) e o `pnpm conferir` só chamam. A metodologia pública está em `docs/CONFERENCIA_BETHA_TCE.md`.

## Estrutura

- `conferencia.bo.ts` — regra pura e os tipos de cada linha.
- `conferencia.dao.ts` — as consultas, em SQL com o tipo da linha declarado (CTEs e `FULL JOIN` que reaproveitam `$1`/`$2`; a soma é do Postgres em `NUMERIC`).
- `conferencia.service.ts` — `conferencia(ano, agora?)` (a comparação) e `dadosConferidos(ano)` (só o que as fontes sustentam); exportado como `@orleans-em-dados/db/conferencias`, junto com `empenhosForaDaSoma` e os tipos `Discrepancia` e `TipoDiscrepancia`.

## Funções e utilitários

- `anotarNaturezas(linhas, repetidas, incoerentes, repetidasMeses)` — classifica cada natureza divergente (`valor`, `soBetha`, `soTce`) e escreve `nota`, `causa` e `explicada`. Ordem das explicações: incoerência mês × acumulado (só é causa se explica toda a diferença), duplicidade em duas rubricas, duplicidade em dois meses, compensação entre rubricas, soma zero no grupo de 6 dígitos, tipo.
- `completarRubricas(rubricas, parcelas, outrosAnos, ano)` — em rubrica sem causa, cita os meses da diferença e marca `conhecida` quando ela se repete do mesmo lado em outro exercício; conhecida não vira `explicada`.
- `listarSemExplicacao(despesas, rubricas, empenhos)` — o que sobra em aberto: despesa divergente, rubrica nem explicada nem conhecida, empenho sem causa.
- `anotarEmpenho(e)` — nota, `causa` e `explicada` do empenho sem par: repetido, renumerado ou sem correspondente.
- `empenhosForaDaSoma(semPar)` — ids Betha repetidos ou renumerados, que a API tira das somas.
- `ehParcial(limites)` — o TCE-SC ainda não tem dezembro de receita.
- `montarConferencia(ano, dados, agora)` — junta tudo e calcula o `resumo` em centavos.
- `separarValores(betha, tce)` — a parte comum a um cruzamento e o que sobra de cada lado, em centavos.
- `montarReceitaConferida(ano, mesLimite, dados)` — agrega a separação em `porMes`, `porEntidade`, `porOrigem` (chave `origem`, os dois primeiros dígitos; o nome da origem é da API), a tabela mista `naturezas` e os `totais`, e lista as `discrepancias`.
- `separarReceita(cruzamentos, pistas, mesLimite)` — separa cada entidade × natureza de 8 dígitos × mês em conferido + diferença com `TipoDiscrepancia`, e devolve à parte os meses depois de `mesLimite`.

## Regras de negócio

- Compara só conceitos iguais, no nível comum às duas fontes: natureza da receita em 8 dígitos (Betha `17135011000000` ↔ TCE `1.7.1.3.50.1.1`).
- Sem as cinco coletas publicadas (status diferente de `exemplo`), devolve `{ disponivel: false, faltando }`.
- No exercício parcial, receita e empenhos são comparados só até onde o TCE-SC já recebeu, e a despesa por entidade não é comparável (a 57170 não tem data). Atraso do TCE-SC é pendência, não divergência.
- Empenhos casam 1:1 por entidade, número, data e valor original. Entre repetidos na Betha, o que tem execução e id maior é o válido; as cópias antigas da 57140 ficam "só na Betha".
- Cada mês de `receitaPorMes` traz `parcelas`: a diferença decomposta por rubrica. O total do mês nunca é a causa.
- Separação da receita: se as fontes têm o mesmo sinal, o conferido é o valor de menor módulo; se os sinais são opostos ou uma fonte não tem a linha, é zero. Sempre vale conferido + diferença do lado = valor da fonte.
- O tipo é da natureza no ano, nesta ordem: `mes_diferente` (soma zero no ano, com meses opostos), `fora_do_acumulado` (a incoerência explica toda a diferença; se explica parte, fica `sem_causa`), `duas_rubricas` (mesmo valor em outra rubrica do mês, igual à diferença do ano), `so_tce` (a Betha não tem a natureza no ano), `sem_causa`. Reclassificação provável e duplicidade em dois meses não têm tipo próprio: ficam `sem_causa`, e a nota diz o padrão.
- Conta da receita, sempre: `conferido + diferencaBetha + aguardandoTce = totalBetha` e `conferido + diferencaTce = totalTce`. Os totais vêm de uma soma à parte no banco, não da separação.
- Tabela mista: natureza com todos os meses iguais sai nas rubricas de 14 dígitos da Betha até o corte (`nivel: 14`, `tce: null`, porque o TCE só desce a 8); com um mês divergente, uma linha de 8 dígitos, sem rateio. Rubrica com soma zero não aparece.
- Discrepância de receita: uma por natureza, com `meses` (onde as fontes diferem) e `mes` quando é um só. O mês em que o acumulado desencontra fica só na nota, que não o afirma como o da linha sobrando. Em `mes_diferente`, `diferenca` é zero: a conta usa `diferencaBetha` e `diferencaTce`.
- Sem as cinco coletas não reais, `dadosConferidos` devolve `{ ano, disponivel: false, faltando, exemplo }`, sem número; `exemplo` diz se há publicação fictícia no ano.
- A Câmara não entra na separação da receita: não tem par na Betha.
- Mês depois do último que o TCE-SC recebeu é pendência (`aguardando_tce`), fora da separação; linha sem mês na Betha é sempre comparada.
- Diferença entre fontes é informação, nunca rotulada como irregularidade; as notas dizem "provável"/"possível".

## Testes

- Unit em `packages/db/test/conferencia/conferencia.bo.spec.ts`; integração em `packages/db/test/integration/conferencia.spec.ts`, sobre as fixtures de `popularBancoDeTeste()`. `popularCenario({ receitas, despesas, ... })` troca só os lotes que o cenário informa.

## Armadilhas

- `receitaIncoerente` aponta o mês em que o acumulado desencontra, que pode não ser o da linha sobrando (a linha é de maio, o desencontro aparece em junho). Por isso a classificação é por natureza, e `mes` vem do cruzamento com o TCE, nunca da incoerência.
- Regravar a paridade pode reordenar chaves em `api_despesas_empenhos_*`, sem mudar conteúdo: revise o diff e restaure os arquivos que só mudaram a ordem.
- `geradoEm` é a hora da chamada: duas respostas nunca são iguais. A paridade fixa esse campo.
