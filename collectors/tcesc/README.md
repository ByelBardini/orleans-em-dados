# Coletor TCE-SC (Farol)

Lê os painéis municipais do Farol TCE-SC, publicados em Qlik Sense, pela
[Qlik Engine JSON API](https://qlik.dev/apis/json-rpc/qix/) (JSON-RPC sobre WebSocket),
em sessão anônima. Não usa navegador, cookies persistidos nem a exportação CSV do painel.

```bash
npm run coletar:tcesc -- --ano 2025                      # receitas e empenhos
npm run coletar:tcesc -- --ano 2025 --consulta empenhos --json
```

| Consulta | App Qlik | Granularidade | Medidas |
|---|---|---|---|
| `receitas` (`900001`) | Receitas Municipais Externo | unidade × natureza (`codigoreceita`) × mês × tipo de dedução | `Sum(valorarrecadado)` |
| `empenhos` (`900002`) | Despesas Municipais Externo | um empenho (`ID Empenho`) | `Sum(LiquidoEmpenho/LiquidoLiquidacao/LiquidoPagamento)`, valor original, reforço, estorno |

`900001`/`900002` são IDs internos do projeto; o UUID do app fica em `consultas.identificador_externo`.

## Como funciona

1. Abre o app (`OpenDoc`) com `Origin` do próprio painel.
2. Seleciona município e exercício pelo `qElemNumber` lido na própria sessão
   (selecionar por texto não restringe o recorte neste servidor).
3. Confere no `SelectionObject` que só esses dois filtros estão ativos, com um valor cada.
4. Cria um **hipercubo de sessão** com dimensões e medidas próprias, lido por páginas
   (`GetHyperCubeData`). As medidas reproduzem as expressões dos objetos publicados
   (`czJXw`, `BEq` → `Sum(LiquidoEmpenho)`; `Ztufrs` → `Sum(valorarrecadado)`), mas a
   estrutura não depende de gráficos do painel nem de dimensões de navegação.
5. Soma as linhas em centavos e compara com o total geral calculado pelo motor;
   compara o horário de recarga do app antes e depois.

Qualquer divergência rejeita a coleta (gravada, não publicada), como na Betha.

## Unidades gestoras de Orleans

| `identificadorUG` | Unidade | Entidade Betha |
|---|---|---|
| 204 | Prefeitura Municipal | 728 |
| 486 | Fundo Municipal de Saúde | 319 |
| 524 | SAMAE | 2473 |
| 1839078 | Fundação Ambiental | 320 |
| 1864 | **Câmara Municipal** | — (só no TCE) |

O vínculo está em `unidades_tce`. O app de receitas só expõe o nome da unidade; o vínculo é
pelo nome exato. A Câmara não tem receitas próprias no app de receitas.

## Limites

- Não é API documentada pelo TCE-SC: IDs de app e nomes de campo podem mudar.
- Os dados chegam ao Tribunal pelo e-Sfinge; em 01/11/2026 os empenhos de 2026 iam até
  30/09 (Câmara até 29/10). Use para exercícios encerrados e conferência, não como dado do dia.
- `NOME_CREDOR` às vezes traz o CPF junto ao nome de pessoa física: tratar como dado pessoal.
- O campo `Tipo de Empenho` é uma ilha no modelo (não filtra): não usar.

Resultados da conferência com a Betha: [`docs/CONFERENCIA_BETHA_TCE.md`](../../docs/CONFERENCIA_BETHA_TCE.md).
