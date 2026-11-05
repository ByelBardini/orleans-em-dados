# Contratos

Valores do domínio e formas que atravessam o sistema, compartilhados por API, importadores e tela. Vive em `packages/contracts/src/` (pacote `@orleans-em-dados/contracts`).

## Funções e utilitários

- `dinheiro(valor)`, `centavos(d)`, `deCentavos(c)`, `somar(lista)`, `dinheiroSchema` (`dinheiro.ts`) — texto decimal com duas casas; conta em `bigint`. Aceita o `number` que a fonte devolve só com até duas casas.
- `exercicio(valor)`, `exercicioSchema` (`exercicio.ts`) — ano inteiro de quatro dígitos; aceita texto (`'2025'`).
- `codigoRubrica(valor)`, `rubricaSchema` (`rubrica.ts`) — texto com dígitos e pontos, mantendo zeros à esquerda; `number` é recusado.
- `populacaoDoAno(serie, ano)` (`populacao.ts`) — o número do próprio ano, senão o anterior mais próximo; nulo antes da série. A regra do divisor de API e tela.

## Contrato

Um schema Zod estrito por rota da API (`src/api/`), espelhando o JSON de hoje (dinheiro como `number | null`):

| Rota                                | Schema                        |
| ----------------------------------- | ----------------------------- |
| `GET /api/anos`                     | `anosSchema`                  |
| `GET /api/receitas`                 | `receitasSchema`              |
| `GET /api/despesas/resumo`          | `despesasResumoSchema`        |
| `GET /api/despesas/empenhos/resumo` | `empenhosResumoSchema`        |
| `GET /api/despesas/empenhos`        | `empenhosBuscaSchema`         |
| `GET /api/discrepancias`            | `discrepanciasSchema`         |
| `GET /api/conferencias`             | `conferenciaSchema`           |
| `GET /api/municipio`                | `municipioSchema`             |
| `GET /api/funcoes`                  | `funcoesSchema`               |
| `GET /api/funcoes/serie`            | `funcoesSerieSchema`          |
| `GET /api/educacao/acesso`          | `educacaoAcessoSchema`        |
| `GET /api/educacao/dinheiro`        | `educacaoDinheiroSchema`      |
| `GET /api/educacao/aprendizado`     | `educacaoAprendizadoSchema`   |
| `GET /api/educacao/discrepancias`   | `educacaoDiscrepanciasSchema` |
| `GET /api/educacao/permanencia`     | `educacaoPermanenciaSchema`   |
| `GET /api/educacao/professores`     | `educacaoProfessoresSchema`   |
| `GET /api/educacao/cidade`          | `educacaoCidadeSchema`        |
| `GET /api/educacao/resumo`          | `educacaoResumoSchema`        |
| qualquer `4xx`/`5xx`                | `erroSchema`                  |

- Bloco `conferencia` em `/api/receitas` (`disponivel`, `parcial`, `limites`, `conferido`, `diferencaBetha`, `diferencaTce`, `aguardandoTce`, `totalBetha`, `totalTce`), em `/api/despesas/resumo` (`disponivel`, `parcial`, `limites`, `aguardandoTce`, `diferencaBetha`, `totalBetha`, `entidadesConferidas`, `entidadesFora`) e em `/api/despesas/empenhos/resumo` (`disponivel`, `parcial`, `dataCorte`). Indisponível: campos nulos, e `faltando` diz o que falta. A conta: `conferido + diferencaBetha + aguardandoTce = totalBetha`; `conferido + diferencaTce = totalTce`. Na despesa encerrada, `totais.empenhado + diferencaBetha = totalBetha`; no ano em curso, os dois são nulos. `/api/despesas/empenhos/resumo` separa `totais.excluidos` em `aguardandoTce` e `emDiscrepancia`.
- `fonteUnica` lista os campos que só a Betha tem e que nunca são conferidos: `orcadoAtualizado` e `orcadoDeducoes` em receitas, `orcadoAtualizado` em despesas.
- `funcoesSchema` e os `anos[]` de `funcoesSerieSchema` trazem `conferenciaEducacao` (`conferido`, `diferenca`, `sem_betha`), ao lado de `conferencia`. Só `funcoesSchema` tem `diferencaEducacao`: nula, ou as três etapas com `dca`, `betha`, `diferenca` (DCA − Betha) e `maior` (`dca`, `betha` ou nulo).
- `naturezas[].nivel` é 8 ou 14; `rubrica` tem esse número de dígitos.
- `comparacaoSchema`, `redeSchema`, `fonteDoBlocoSchema` (`api/educacao.ts`): o bloco que compara Orleans, Santa Catarina e o Brasil, rede com rede. O que não abre rede, como o Censo, fica em `todas`. Rede sem dado pode faltar em `porRede`; na rede presente, os três lugares são obrigatórios e falta é nulo. `unidade` é `%`, `alunos`, `horas`, `indice`, `nota` ou `anos`; `anos` entrou na aba Cidade (fase 16). O tipo é `ComparacaoDeEducacao`, porque `Comparacao` já é a forma de `/api/municipio`; também `Rede`, `FonteDoBloco`, `ValoresDaRede`.
- Abas do caderno: um arquivo por aba, `api/educacao/<aba>.ts`, com `educacao<Aba>Schema` e o tipo `Educacao<Aba>`, e uma linha `export * from './educacao/<aba>'` em `api/index.ts`. O prefixo evita colisão, e o que é de uma aba não fica exportado sem ele. Toda aba abre com `...camposDaAba` (`disponivel`, `faltando`, em `api/educacao.ts`), e cada bloco é `.nullable()`: sem coleta é nulo, não some da resposta. Também `valoresDaRedeSchema`, e `NivelDeGestao` na aba Acesso. Em Permanência, `evasao.ano` é o período `2021-2022`, e `series[].matriculas` é de Orleans, no ano da taxa, com a `publica` somando municipal, estadual e federal.
- `limitesDaConferenciaSchema` (`comuns.ts`): `{ mesReceita, dataEmpenho }`.
- `discrepanciasSchema`: `{ ano, disponivel, parcial, limites, faltando?, grupos: [{ tipo, area, rotulo, explicacao, total, itens }], aguardando: { rotulo, explicacao, receita: { total, itens }, despesa: { total, quantidade, itens } }, resumo: { casos, porSituacao, porArea } }`. O schema é estrito, então credor, histórico e `avisos` são recusados. Item da área `funcao` traz `dca` e `maior`, opcionais nas outras áreas.

## Testes

- `test/api/respostas.spec.ts` valida as respostas gravadas de `apps/api/test/paridade/respostas/` contra os schemas.

## Indicadores

- `INDICADORES`, `validarRegistro(indicadores, conhecidas)` (`src/indicadores/registro.ts`) — cada indicador num lugar só: importador, consulta preferida, conferência e periodicidade. Indicador novo é uma entrada aqui; `apps/worker/test/indicadores.spec.ts` confere o registro contra os importadores reais.
- `situacaoDaAtualizacao(periodicidade, ano, ultimaExtracao, agora)` (`src/indicadores/atraso.ts`) — `em_dia`, `atrasado`, `historico` (exercício mais antigo que o anterior, sem rodada agendada) ou `sem_dado`. Atrasado só depois de duas janelas: uma rodada perdida de madrugada não acende o aviso.

## Regras de arquitetura

- Campo só é não nulo quando a coluna é obrigatória ou o SQL garante: soma sobre recorte vazio é `NULL`, e os `FULL JOIN` da conferência deixam um lado nulo. A fixture não mostra todos esses casos.

- Dinheiro nunca é somado como `number`: `dinheiro()` recusa `0.1 + 0.2` citando o valor.
- Construtor recusa citando o valor recebido e a forma esperada; o schema Zod repete a mesma mensagem.
