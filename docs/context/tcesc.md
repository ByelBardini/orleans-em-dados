# Importador TCE-SC

Painéis municipais do Farol TCE-SC, publicados em Qlik Sense, lidos pela Qlik Engine JSON API (JSON-RPC sobre WebSocket) em sessão anônima. Vive em `packages/importadores/tcesc/` (pacote `@orleans-em-dados/importador-tcesc`) e segue o contrato de [importadores.md](importadores.md). Não é uma API documentada pelo Tribunal: ids de app e nomes de campo podem mudar. O passo a passo do protocolo está em `packages/importadores/tcesc/README.md`.

## Contrato

| Chave      | Consulta | App Qlik                    | Linha                                            | Tabela           |
| ---------- | -------- | --------------------------- | ------------------------------------------------ | ---------------- |
| `receitas` | `900001` | Receitas Municipais Externo | unidade × natureza × mês × tipo de dedução       | `tcesc_receitas` |
| `empenhos` | `900002` | Despesas Municipais Externo | um empenho (`ID Empenho`), com a Câmara incluída | `tcesc_empenhos` |

`900001` e `900002` são ids internos do projeto; o UUID do app fica em `consultas.identificador_externo`.

## Funções e utilitários

- `criarImportadorTcesc({ abrirSessao? })` (`src/importador.ts`) — roda às 4h, sobre o exercício corrente e o anterior.
- `QlikSessao.abrir(appId, criarSocket?, tempoLimite?)` (`src/sessao-qlik.ts`) — `selecionar`, `limparSelecoes`, `selecoes`, `hipercubo`, `infoApp`, `fechar`; o importador depende só da interface `SessaoQlik`.
- `centavosDoMotor(qNum)`, `textoDaCelula(celula)` (`src/celulas.ts`).
- `normalizarReceita`, `normalizarEmpenho` (`src/normalizar.ts`).

## Regras de negócio

- Um lote só é aprovado se a soma das linhas em centavos for igual ao total calculado pelo motor, os dois filtros (ente `ORLEANS` e ano) forem exatamente os pedidos e o app não tiver recarregado durante a coleta.
- O vínculo com a Betha é pela unidade: `codigo_ug` nos empenhos, o nome exato em `unidades_tce.nome` nas receitas.

## Testes

- `test/importador.spec.ts` traz `SessaoQlikFake`; `test/sessao-qlik.spec.ts` prova o protocolo com um socket falso que responde por roteiro de métodos. Nenhum teste chega ao TCE-SC.

## Armadilhas

- O Qlik devolve `double` (`170915184.25000012`): o valor é convertido para centavos, e o que não cai sobre um centavo inteiro é recusado. Nulo no Qlik é `qIsNull` ou `qText '-'` com `qNum 'NaN'`.
- Selecionar por texto não restringe o recorte neste servidor: a seleção é pelo `qElemNumber` lido na sessão.
- O TCE-SC recebe os dados do município com atraso: no exercício corrente, tem menos meses que a Betha (ver [conferencia.md](conferencia.md)).
