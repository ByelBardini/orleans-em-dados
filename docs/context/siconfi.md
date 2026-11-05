# SICONFI

Importador da API do SICONFI para Orleans: despesa por função (DCA Anexo I-E, grava em `siconfi_funcoes`, [db.md](db.md)) e índices legais de educação (RREO Anexo 14, grava em `educacao_financas`, [educacao.md](educacao.md)). Vive em `packages/importadores/siconfi/` (pacote `@orleans-em-dados/importador-siconfi`), sobre o contrato de [importadores.md](importadores.md).

## Estrutura

- `src/config.ts` — `SICONFI` (URL da DCA, anexo, ente) e `SICONFI_RREO` (URL, demonstrativo, anexo, período).
- `src/cliente.ts` — `SiconfiClienteHttp.anexo(ano)` e `.rreo(ano)`; porta `ClienteSiconfi`. Segue a paginação ORDS (`hasMore`, `offset`) e repete `429`, `5xx` e erro de rede, até 4 tentativas.
- `src/normalizar.ts` — DCA: `registroDoItem(item)` (id `etapa:conta`) e `normalizarConta(registro)`. RREO: `registrosDosIndices(itens)` (id é a conta) e `normalizarIndice(registro)`.
- `src/importador.ts` — `criarImportadorSiconfi({ cliente? })`; consultas `siconfi_funcoes` (900201) e `siconfi_indices` (900202), que falham e publicam cada uma por si.

## Contrato

- `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?an_exercicio=<ano>&no_anexo=DCA-Anexo I-E&id_ente=4211702`. Sem autenticação.
- Formato de `conta`: `Despesas Exceto Intraorçamentárias` (`total`), `10 - Saúde` (`funcao`), `10.301 - Atenção Básica` (`subfuncao`), `FU12 - Demais Subfunções` (`subfuncao` da função 12, código `FU12`). Coluna e conta fora disso recusam o registro: o quadro já mudou, e formato novo não é adivinhado.
- `coluna` → `etapa`: `empenhado`, `liquidado`, `pago`, `rp_nao_processados`, `rp_processados`.

### RREO Anexo 14

- `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio=<ano>&nr_periodo=6&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo 14&id_ente=4211702`. O 6º bimestre fecha o exercício.
- O anexo é um demonstrativo simplificado, com um item por conta e coluna, e cerca de 50 itens por ano. Só as contas dos dois índices são guardadas, um registro por conta, com as colunas em `colunas`. O resto (fiscal, saúde, Complementação da União ao Fundeb) fica de fora, inclusive de `totalHits`.
- Contas aceitas, pelo texto exato: `Mínimo Anual de <18% / 25%> das Receitas de Impostos na Manutenção e Desenvolvimento do Ensino` → `indice_educacao`; `Mínimo Anual de 60% do FUNDEB na Remuneração do Magistério com Educação Infantil e Ensino Fundamental` (até 2020) e `Mínimo Anual de 70% do FUNDEB na Remuneração dos Profissionais da Educação Básica` (desde 2021) → `fundeb_remuneracao`.
- Colunas: `Valor Apurado Até o Bimestre` → `valor`; `% Aplicado Até o Bimestre` → `percentual`. `% Mínimo a Aplicar no Exercício` fica só no bruto.
- Linha: `lugar` `4211702`, `rede` `municipal`, `recorte` vazio, `periodo` o exercício; `id_externo` `4211702:municipal:::<indicador>:<ano>`.

## Regras de negócio

- `ano` é o exercício. `anosDaRodada`: até 30 de abril, os dois exercícios anteriores ao passado (`[2025, 2024]` em abril de 2027); de maio em diante, o passado e o anterior (`[2026, 2025]`). O prazo de entrega da DCA é 30 de abril. O RREO do 6º bimestre vence antes, em 30 de janeiro (LRF, art. 52), e segue a mesma rodada: os índices de um exercício chegam em maio, junto com a DCA. O caderno usa o SIOPE como principal e só exercício encerrado, então os três meses não pesam, e os anos da DCA não mudam.
- Carga inicial: `pnpm importar siconfi --ano <ano>`, um por exercício de 2018 a 2025.
- `validar`: soma das funções = linha de total, em cada uma das três etapas; item `total_<etapa>` em `totais_fonte`. As colunas de restos a pagar ficam guardadas e fora da validação. Resposta vazia não tem linha de total: rejeitada, publicação anterior intacta.
- A conferência com o TCE-SC é em [conferencia.md](conferencia.md). Só o total e a Legislativa são comparados; cada outra função é fonte única.
- `siconfi_indices`: `validar` exige exatamente uma linha de cada indicador. Anexo vazio ou sem a linha é lote rejeitado, não falha: nada é publicado e a rodada e a DCA do ano seguem. Conta que cita o assunto em redação nova, coluna ausente ou nula, ou coluna repetida também rejeitam; a publicação anterior fica. Não há total a conferir: `conferencia` vem vazia.
- Os índices não têm selo de conferido: a fonte preferida é o SIOPE, e a diferença entre os dois vai para Discrepâncias. Indicadores `indice-educacao-rreo` e `fundeb-remuneracao-rreo`, com `conferidoContra` nulo.

## Carga e limites conhecidos

- Cada exercício de 2018 a 2025 é publicado sem ajuste. Só 2024 e 2025 têm coleta do TCE-SC: de 2018 a 2023, o total sai em fonte única até o TCE-SC ser coletado.
- Da DCA, só o Anexo I-E. Do RREO, só os dois índices de educação. RCL, pessoal, dívida, restos a pagar e o índice de saúde exigem metodologia própria.
- RREO de Orleans: índices em 2017 e de 2020 a 2025. 2018 vem vazio e 2019 não traz as linhas. Carga inicial com `pnpm importar siconfi --ano <ano> --consulta siconfi_indices`, ou os snapshots em `data/siconfi/` (os de 2018 e 2019 são `.rejeitado.json`, sem nada a carregar).
- Conferido na API real em 04/11/2026, de 2017 a 2025, com `docs/educacao/extratos/indices-legais.json`: percentuais iguais em todos os anos, e as diferenças de valor em relação ao Anexo 8 do SIOPE batem ao centavo onde o extrato as tem.

## Testes

- `test/support/dca.ts` — `item`, `anexoCoerente`, `ClienteSiconfiFake` (o segundo argumento dá o Anexo 14 de cada ano). `test/support/rreo.ts` — `itemDoRreo`, `contaDoRreo`, `linhasDeOutrosAssuntos`, `anexo14Coerente`. Valores fictícios.
- Unit: `normalizar`, `cliente` (transporte falso), `importador`. `test/integration/importador.spec.ts`: gravação e publicação.

## Armadilhas

- O campo `populacao` da resposta não é usado: traz 23.531 em 2024 e 2025, diferente do IBGE.
- Função não é entidade: Saúde é igual ao FMS em 2024 e 2025, mas Saneamento 2024 difere do SAMAE no TCE-SC.
- A linha de total inclui a Câmara. O total do painel é a linha de total menos a função `01`.
- Despesa por função no ano em curso não vem daqui: a DCA só existe depois do exercício encerrado, e o RREO de 2025 não fecha com ela.
- O Fundeb na remuneração muda de regra em 2021: 60% do magistério até 2020, 70% dos profissionais da educação básica depois. O indicador é um só, e a comparação com o mínimo depende do ano.
- O percentual igual ao do SIOPE não confere o valor: em 2021 e 2022 o índice de educação tem o mesmo percentual e valores diferentes.
- A data de atualização em `/api/importacoes` é a da consulta mais antiga da fonte no ano. Se o RREO de um exercício já publicado passar a ser rejeitado, a data para de andar também para a DCA daquele ano.
