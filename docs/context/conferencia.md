# Conferência Betha × TCE-SC

Compara as coletas publicadas das duas fontes num exercício. A regra mora em `packages/db/src/conferencia/`; a API (`/api/conferencias`) e o `pnpm conferir` só chamam. A metodologia pública está em `docs/METODOLOGIA.md`; o que foi achado e o que foi conferido à mão, em `docs/CONFERENCIA_BETHA_TCE.md`.

## Estrutura

- `conferencia.bo.ts` — regra pura e os tipos de cada linha.
- `conferencias-manuais.ts` — os casos conferidos à mão (`CONFERENCIAS_MANUAIS`), a validação e o cruzamento com as discrepâncias.
- `conferencia.dao.ts` — as consultas, em SQL com o tipo da linha declarado (CTEs e `FULL JOIN` que reaproveitam `$1`/`$2`; a soma é do Postgres em `NUMERIC`).
- `conferencia.service.ts` — `conferencia(ano, agora?)` (a comparação), `dadosConferidos(ano)` (só o que as fontes sustentam) e `empenhosConferidos(ano)` (o conjunto casado, para a lista); exportado como `@orleans-em-dados/db/conferencias`, junto com os tipos `Discrepancia`, `EmpenhoConferido` e `TipoDiscrepancia`.

## Funções e utilitários

- `anotarNaturezas(linhas, repetidas, incoerentes, repetidasMeses)` — classifica cada natureza divergente (`valor`, `soBetha`, `soTce`) e escreve `nota`, `causa` e `explicada`. Ordem das explicações: incoerência mês × acumulado (só é causa se explica toda a diferença), duplicidade em duas rubricas, duplicidade em dois meses, compensação entre rubricas, soma zero no grupo de 6 dígitos, tipo.
- `completarRubricas(rubricas, parcelas, outrosAnos, ano)` — em rubrica sem causa, cita os meses da diferença e marca `conhecida` quando ela se repete do mesmo lado em outro exercício; conhecida não vira `explicada`.
- `listarSemExplicacao(despesas, rubricas, empenhos)` — o que sobra em aberto: despesa divergente, rubrica nem explicada nem conhecida, empenho sem causa.
- `anotarEmpenho(e)` — nota, `causa` e `explicada` do empenho sem par: repetido, renumerado ou sem correspondente.
- `classificarEmpenho(e, { parcial, corte })` — o tipo de um empenho sem par. `discrepanciasDeEmpenhos(semPar, exercicio)` — uma discrepância por empenho, copiando só os campos permitidos.
- `ehParcial(limites)` — o TCE-SC ainda não tem dezembro de receita.
- `montarConferencia(ano, dados, agora)` — junta tudo e calcula o `resumo` em centavos.
- `conferirDespesaEncerrada(linha, modalidade71)` — o valor conferido de uma entidade em exercício completo, ou a discrepância que a tira da soma.
- `montarDespesaConferida(parcial, limites, dados)` — aplica a regra do exercício (encerrado ou em curso) por entidade, deixa a Câmara à parte e soma só as conferidas.
- `cruzarConferenciasManuais(ano, discrepancias, registros?)` — dá a cada discrepância `situacao`, e `data`, `evidencia` e `protocolo` quando há registro, e devolve os `avisos`. `validarConferenciaManual(registro)` — recusa o que não pode ser versionado; o erro nunca repete o valor.
- `ordenarDiscrepancias(lista)` — por tipo, com `aguardando_tce` por último; dentro do tipo, o maior valor primeiro.
- `separarValores(betha, tce)` — a parte comum a um cruzamento e o que sobra de cada lado, em centavos.
- `montarReceitaConferida(ano, mesLimite, dados)` — agrega a separação em `porMes`, `porEntidade`, `porOrigem` (chave `origem`, os dois primeiros dígitos; o nome da origem é da API), `recortes` (`porMes` e `porOrigem` de cada entidade, que não dá para derivar do total), a tabela mista `naturezas` e os `totais`, e lista as `discrepancias`.
- `separarReceita(cruzamentos, pistas, mesLimite)` — separa cada entidade × natureza de 8 dígitos × mês em conferido + diferença com `TipoDiscrepancia`, e devolve à parte os meses depois de `mesLimite`. `pistas.linhasRepetidas` vem da consulta linha a linha, e `pistas.repetidas` antiga (`>= 1000`, soma igual à diferença) fica só para as notas de `conferencia(ano)`.

## Regras de negócio

- Compara só conceitos iguais, no nível comum às duas fontes: natureza da receita em 8 dígitos (Betha `17135011000000` ↔ TCE `1.7.1.3.50.1.1`).
- Sem as cinco coletas publicadas (status diferente de `exemplo`), devolve `{ disponivel: false, faltando }`.
- No exercício parcial, receita e empenhos são comparados só até onde o TCE-SC já recebeu, e a despesa por entidade não é comparável (a 57170 não tem data). Atraso do TCE-SC é pendência, não divergência.
- Empenhos casam 1:1 por entidade, número, data e valor original. Entre repetidos na Betha, o que tem execução e id maior é o válido; as cópias antigas da 57140 ficam "só na Betha".
- Cada mês de `receitaPorMes` traz `parcelas`: a diferença decomposta por rubrica. O total do mês nunca é a causa.
- Separação da receita: se as fontes têm o mesmo sinal, o conferido é o valor de menor módulo; se os sinais são opostos ou uma fonte não tem a linha, é zero. Sempre vale conferido + diferença do lado = valor da fonte.
- O tipo é da natureza no ano, nesta ordem (a de `anotarNaturezas`): `mes_diferente` (soma zero no ano, com meses opostos), `fora_do_acumulado` (a incoerência explica a diferença), `duas_rubricas` (linhas iguais em outra rubrica do mês cobrem a diferença), `mes_repetido` (mesmo valor em dois meses da rubrica), `reclassificacao` (compensa outra rubrica ou soma zero no grupo de 6 dígitos), `duas_rubricas` parcial, `so_tce` (a Betha não tem a natureza no ano), `sem_causa`. `sem_causa` significa "sem padrão conhecido".
- Natureza explicada só em parte pelo acumulado vira duas discrepâncias, `fora_do_acumulado` com o excesso e `sem_causa` com o resto, as duas com `diferencaDaNatureza` e com `betha` e `tce` da natureza. Só divide se excesso e resto têm o sinal da diferença; senão, um único `sem_causa` com a nota. As partes somam a natureza em centavos, em `diferenca`, `diferencaBetha` e `diferencaTce`. Em `linhas` e em `naturezas[]`, a natureza dividida tem tipo `sem_causa`, porque há resto em aberto.
- `duas_rubricas` é linha a linha: casa 1:1, por entidade, mês e valor, linhas de naturezas diferentes, de R$ 1,00 para cima, e nenhuma linha é usada duas vezes. Só a natureza com a Betha maior reclama uma linha, e a linha precisa caber no que sobra da natureza no mês e no ano: a parte nunca passa da diferença. Par em natureza que bate com o TCE-SC é o preferido. Soma de duas linhas não casa. Se as linhas cobrem a natureza, um `duas_rubricas`; se só parte, e nenhuma explicação cobre a natureza inteira (`mes_repetido`, `reclassificacao`), `duas_rubricas` + `sem_causa` com o resto, como na divisão do acumulado. Só linha positiva entra: estorno não é repetição.
- Conta da receita, sempre: `conferido + diferencaBetha + aguardandoTce = totalBetha` e `conferido + diferencaTce = totalTce`. Os totais vêm de uma soma à parte no banco, não da separação.
- Tabela mista: natureza com todos os meses iguais sai nas rubricas de 14 dígitos da Betha até o corte (`nivel: 14`, `tce: null`, porque o TCE só desce a 8); com um mês divergente, uma linha de 8 dígitos, sem rateio. Rubrica com soma zero não aparece.
- Discrepância de receita: uma por natureza, com `meses` (onde as fontes diferem) e `mes` quando é um só. O mês em que o acumulado desencontra fica só na nota, que não o afirma como o da linha sobrando. Em `mes_diferente`, `diferenca` é zero: a conta usa `diferencaBetha` e `diferencaTce`.
- Sem as cinco coletas reais, `dadosConferidos` devolve `{ ano, disponivel: false, faltando, exemplo }`, sem número; `exemplo` diz se há publicação fictícia no ano.
- A Câmara não entra na separação da receita: não tem par na Betha.
- Mês depois do último que o TCE-SC recebeu é pendência (`aguardando_tce`), fora da separação; linha sem mês na Betha é sempre comparada.
- Despesa encerrada (fonte `betha_57170`): igual ao TCE nas três etapas, fica o valor da 57170, mesmo com linhas de modalidade 71 (dígitos 3-4 da natureza). Diferença igual à soma dessas linhas nas três etapas: valor sem elas, `despesa_duplicada`, conferida. Qualquer outro caso, inclusive fechar em só uma etapa: valores `null`, `conferida: false`, `sem_causa`, e as outras entidades seguem.
- Despesa no ano em curso (fonte `tce`, com `dataCorte`): soma de `valor_empenhado` (líquido de estorno), liquidado e pago do TCE-SC nos empenhos casados com a 57140 até o corte. Empenho sem par até o corte fica fora, e sai um a um na área `empenho`. Empenho da Betha depois do corte é `aguardando_tce`, agregado por entidade, com `quantidade`.
- A Câmara fica em `despesa.camara` (`fonte: 'tce'`, `conferida: false`), fora de `porEntidade` e dos totais.
- Empenho sem par (área `empenho`, o nome interno `empenho_fantasma` não sai na API pública), nesta ordem: depois do corte do ano em curso, `aguardando_tce` (fica só na pendência por entidade); `empenho_repetido` (ocorrência > 1, a mesma chave de outro); `empenho_renumerado` (`numeroNaOutra` confirmado); do TCE-SC, `empenho_ausente` se o número não existe na Betha, senão `sem_causa`; da Betha, `empenho_fantasma` se o ano está encerrado e liquidado, pago e saldo são nulos, senão `sem_causa`. Repetido e renumerado vêm antes de fantasma porque as cópias antigas da 57140 também não têm execução.
- `OUTRO_NUMERO` exige data, valor e credor ou histórico iguais, comparados por `CHAVE_DE_TEXTO` (maiúsculas, sem acento, só letras e dígitos). Texto vazio não confirma nada.
- Discrepância de empenho só leva entidade, número, data, valor, fonte, id e nota. Credor e histórico ficam no SQL, para comparar, e nunca saem de `empenhosParaClassificar`: a seção é pública, e credor pode ser pessoa física.
- `empenhosConferidos(ano)` devolve `{ ano, disponivel: false, faltando, exemplo }` ou `{ ano, disponivel: true, parcial, dataCorte, empenhos }`, com `empenhos[]` do tipo `EmpenhoConferido`: `id` (`id_externo` da Betha), `idTce`, `codigoEntidade`, e `empenhado` (líquido), `liquidado` e `pago` do TCE-SC.
- Diferença entre fontes é informação, nunca rotulada como irregularidade; as notas dizem "provável"/"possível".

## Retorno de `dadosConferidos(ano)`

- `{ ano, disponivel: false, faltando, exemplo }`, ou
- `{ ano, disponivel: true, parcial, limites, receita, despesa, discrepancias, avisos }`:
  - `receita`: `recortes` por `codigoEntidade`, `porMes[]` (`mes`, `betha`, `tce`, `conferido`, `diferencaBetha`, `diferencaTce`, `aguardandoTce`), `porEntidade[]` (`codigoEntidade`, `entidade`, partes, `aguardandoTce`, `totalBetha`, `totalTce`), `porOrigem[]` (`origem`, partes, `aguardandoTce`), `naturezas[]` (tipo `LinhaNaturezaConferida`), `totais` (partes, `aguardandoTce`, `totalBetha`, `totalTce`);
  - `despesa`: `porEntidade[]` (tipo `DespesaConferida`), `camara`, `totais` (`empenhado`, `liquidado`, `pago`, `aguardandoTce`, `entidadesConferidas`, `entidadesFora`);
  - `avisos[]`: interno, para quem mantém os registros manuais. A rota pública não devolve;
  - `discrepancias[]`: tipo `DiscrepanciaConferida` (`Discrepancia` + `situacao`, `data`, `evidencia`, `protocolo`), com `area` (`receita`, `despesa` ou `empenho`). Na despesa, `betha`, `tce` e `diferenca` são do empenhado; as três etapas ficam em `etapas`. No empenho, `fonte`, `numero`, `dataEmpenho` e `id`, com o valor no lado da fonte; `data` é sempre a da conferência manual. A área `empenho` é outra visão da mesma execução: não some com `despesa`.

## Como registrar um caso conferido à mão

1. Acrescente um item em `CONFERENCIAS_MANUAIS` (`conferencias-manuais.ts`), com `{ ano, entidade, tipo, chave, valor, evidencia }`. `situacao` e `data` vêm de `NO_PORTAL`; caso de outra data leva a própria `data`.
2. `chave` é a natureza ou o número do empenho. `null` cobre todas as discrepâncias do tipo na entidade, pela soma: é o caso de `despesa_duplicada` e de um grupo de empenhos. `valor` é em módulo; `null` confirma sem total, como uma conferência parcial.
3. `protocolo` é só o número (`e-SIC 000/0000`). Código de acompanhamento nunca: a validação recusa, e o import do módulo falha. Nada de nome de pessoa ou de credor na `evidencia`: ela sai na seção pública. A validação também recusa termo que afirma causa ("fantasma", "erro", "irregular", "fraude").
4. Rode o spec, e confira em `dadosConferidos(ano).avisos` que o registro achou a discrepância.
5. Acrescente o caso à tabela "Conferido à mão" de `docs/CONFERENCIA_BETHA_TCE.md`, com o que o portal mostra e o que não foi provado.

- Com registro e o mesmo valor: `confirmada_no_portal`. Registro com `situacao: 'confirmada_em_parte'` (só um exemplo foi conferido, citado na evidência, com `valor: null`): fica assim, e nunca confirma o valor inteiro. Sem registro: `calculada`. Com registro e valor diferente, ou a soma do grupo: `rever`, com aviso. Registro sem discrepância do mesmo ano, entidade, tipo e chave: só um aviso.

## Testes

- Unit em `packages/db/test/conferencia/conferencia.bo.spec.ts` e `conferencias-manuais.spec.ts`; integração em `packages/db/test/integration/conferencia.spec.ts`, sobre as fixtures de `popularBancoDeTeste()`. `popularCenario({ receitas, despesas, ... })` troca só os lotes que o cenário informa.

## Armadilhas

- `receitaIncoerente` aponta o mês em que o acumulado desencontra, que pode não ser o da linha sobrando (a linha é de maio, o desencontro aparece em junho). Por isso a classificação é por natureza, e `mes` vem do cruzamento com o TCE, nunca da incoerência.
- Credor diverge muito entre as fontes: no SAMAE 2024, dos 32 empenhos sem par com a mesma data e valor em outro número, 12 têm o credor igual e 32 têm o histórico igual, mesmo com a chave sem acento. Sem o histórico, 20 deles perderiam a pista.
- O número repete entre os empenhos sem par (nº 336 é repetido e renumerado no SAMAE 2024, com ids diferentes): a chave de um registro manual pode cobrir mais de uma linha.
- Os registros manuais são reais e valem nas fixtures: um cenário de teste com o mesmo ano, entidade, tipo e chave recebe `situacao` de um deles.
- Regravar a paridade pode reordenar chaves em `api_despesas_empenhos_*`, sem mudar conteúdo: revise o diff e restaure os arquivos que só mudaram a ordem.
- `geradoEm` é a hora da chamada: duas respostas nunca são iguais. A paridade fixa esse campo.
