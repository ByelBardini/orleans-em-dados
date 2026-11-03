# SICONFI

Importador da despesa por função: DCA Anexo I-E de Orleans, na API do SICONFI. Vive em `packages/importadores/siconfi/` (pacote `@orleans-em-dados/importador-siconfi`), sobre o contrato de [importadores.md](importadores.md), e grava em `siconfi_funcoes` ([db.md](db.md)).

## Estrutura

- `src/config.ts` — `SICONFI` (URL, anexo, ente).
- `src/cliente.ts` — `SiconfiClienteHttp.anexo(ano)`; porta `ClienteSiconfi`. Segue a paginação ORDS (`hasMore`, `offset`) e repete `429`, `5xx` e erro de rede, até 4 tentativas.
- `src/normalizar.ts` — `registroDoItem(item)` (id `etapa:conta`) e `normalizarConta(registro)`.
- `src/importador.ts` — `criarImportadorSiconfi({ cliente? })`; consulta `siconfi_funcoes` (900201).

## Contrato

- `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?an_exercicio=<ano>&no_anexo=DCA-Anexo I-E&id_ente=4211702`. Sem autenticação.
- Formato de `conta`: `Despesas Exceto Intraorçamentárias` (`total`), `10 - Saúde` (`funcao`), `10.301 - Atenção Básica` (`subfuncao`), `FU12 - Demais Subfunções` (`subfuncao` da função 12, código `FU12`). Coluna e conta fora disso recusam o registro: o quadro já mudou, e formato novo não é adivinhado.
- `coluna` → `etapa`: `empenhado`, `liquidado`, `pago`, `rp_nao_processados`, `rp_processados`.

## Regras de negócio

- `ano` é o exercício. `anosDaRodada`: até 30 de abril, os dois exercícios anteriores ao passado (`[2025, 2024]` em abril de 2027); de maio em diante, o passado e o anterior (`[2026, 2025]`). O prazo de entrega da DCA é 30 de abril.
- Carga inicial: `pnpm importar siconfi --ano <ano>`, um por exercício de 2018 a 2025.
- `validar`: soma das funções = linha de total, em cada uma das três etapas; item `total_<etapa>` em `totais_fonte`. As colunas de restos a pagar ficam guardadas e fora da validação. Resposta vazia não tem linha de total: rejeitada, publicação anterior intacta.
- A conferência com o TCE-SC é em [conferencia.md](conferencia.md). Só o total e a Legislativa são comparados; cada outra função é fonte única.

## Carga e limites conhecidos

- Cada exercício de 2018 a 2025 é publicado sem ajuste. Só 2024 e 2025 têm coleta do TCE-SC: de 2018 a 2023, o total sai em fonte única até o TCE-SC ser coletado.
- Só o Anexo I-E. Índices legais, RCL, pessoal, dívida e restos a pagar exigem metodologia própria.

## Testes

- `test/support/dca.ts` — `item`, `anexoCoerente`, `ClienteSiconfiFake`, com valores fictícios.
- Unit: `normalizar`, `cliente` (transporte falso), `importador`. `test/integration/importador.spec.ts`: gravação e publicação.

## Armadilhas

- O campo `populacao` da resposta não é usado: traz 23.531 em 2024 e 2025, diferente do IBGE.
- Função não é entidade: Saúde é igual ao FMS em 2024 e 2025, mas Saneamento 2024 difere do SAMAE no TCE-SC.
- A linha de total inclui a Câmara. O total do painel é a linha de total menos a função `01`.
- Despesa por função no ano em curso não vem daqui: a DCA só existe depois do exercício encerrado, e o RREO de 2025 não fecha com ela.
