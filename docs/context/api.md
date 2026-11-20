# API

API REST somente leitura sobre as coletas publicadas, em Fastify. Vive em `apps/api/src/` (pacote `@orleans-em-dados/api`) e nunca consulta as fontes externas.

> **Detalhe por assunto em [`api/`](api/) — abra só o arquivo da tarefa.** Este hub guarda a estrutura, as rotas de finanças, IBGE e SICONFI e as regras gerais.

| Assunto                                       | Arquivo                              |
| --------------------------------------------- | ------------------------------------ |
| rotas `/api/educacao/*` e o módulo do caderno | [`educacao.md`](api/educacao.md)     |
| armadilhas                                    | [`armadilhas.md`](api/armadilhas.md) |

## Estrutura

- `src/app.ts` — `criarApp(opcoes?, { site, siteUrl, verificacaoGoogle, apoioAtivo, checarBanco })`: monta o Fastify, registra os módulos e traduz 404 e erro. Toda resposta de `/api` sai com `X-Robots-Tag: noindex, nofollow` (gancho `onSend`, `ehDaApi`); o site, não. Com `site` (o `index.ts` passa `WEB_DIST`) e o `index.html` na pasta, chama `registrarSite` (seção Site); sem, só a API responde, e todo 404 é JSON. `checarBanco` troca a checagem da saúde no teste. `src/index.ts` sobe a porta (`PORT`, padrão 3000) e lê `SITE_URL` (por `normalizarSiteUrl`, que tira a barra do fim e recusa o que não é `http(s)://`) e `GOOGLE_SITE_VERIFICATION`.
- `src/site/` — o painel servido pela API. `site.ts`: `registrarSite(app, { pasta, siteUrl, verificacaoGoogle, apoioAtivo })`, `normalizarSiteUrl`, `ehDaApi`. `head.ts`: `montarHead(pagina | null, { siteUrl, verificacaoGoogle, jsonLd })`, `escaparHtml`, `urlDoSite`.
- `src/modules/<área>/` — `<área>.dao.ts` (SQL), `<área>.service.ts` (composição com a conferência), `<área>.routes.ts` (borda). Áreas: `coletas`, `receitas`, `despesas`, `empenhos`, `discrepancias`, `conferencias`, `importacoes`, `municipio`, `funcoes`, `educacao` (estrutura própria, em "Caderno de Educação").
- `src/lib/borda.ts` — `parametro`, `texto`, `responder`, `responderCsv`.
- `src/lib/consultas.ts` — `consultar`, `ENTIDADE`, `chaveTexto`. `src/lib/csv.ts` — `gerarCsv`.

## Contrato

Todas as rotas de dados recebem `ano` e respondem `404 { erro }` quando o ano não tem coleta publicada daquela consulta. O schema de cada resposta está em [contracts.md](contracts.md).

- `GET /api/anos` — exercícios publicados de receitas ou empenhos, entidades e `atualizadoEm` por ano.
- `GET /api/receitas?ano&entidade` — a receita conferida (`conferenciaPorArea().receita`, sem esperar as coletas da despesa): `arrecadadoNoMes` é sempre o conferido, em totais, por mês, por entidade, por origem e nas naturezas (mistas, com `nivel` 8 ou 14). O bloco `conferencia` traz a conta com o total da fonte. O orçado continua, declarado em `fonteUnica`.
- `GET /api/receitas.csv?ano&entidade` — as naturezas da rota JSON, com a coluna `Arrecadado conferido`.
- `GET /api/despesas/resumo?ano&entidade` — `conferenciaPorArea().despesa`, cada entidade com `fonte`, `conferida` e `dataCorte`. Entidade não conferida sai sem número e fora de `totais`. Sem `entidade`, a Câmara à parte (`camara`, `conferida: false`). `conferencia.diferencaBetha` e `totalBetha` são a conta do empenhado no exercício encerrado (conferido + linhas retiradas + entidade fora inteira = total da 57170); nulos no ano em curso, porque o aguardando é valor original da Betha e o conferido é líquido do TCE-SC.
- `GET /api/despesas/empenhos/resumo?ano&entidade` — só o conjunto casado, por mês, entidade, órgão, credor e maiores; `totais.excluidos` é o número de registros da 57140 fora da lista, separado em `aguardandoTce` (depois do corte) e `emDiscrepancia` (sem par até o corte). Sem conferência, os dois ficam em zero.
- `GET /api/despesas/empenhos?ano&q&entidade&orgao&situacao&offset&limit` — busca paginada no conjunto casado (`limit` 1–200, padrão 50); `situacao` `pago` (liquidado do TCE-SC > 0 e saldo zero) | `apagar` (liquidado > 0 e saldo > 0) | `sem` (sem liquidação: liquidado do TCE-SC nulo ou zero), qualquer outra é ignorada. Saldo nulo não é zero: não entra em `pago`.
- `GET /api/despesas/empenhos.csv` — mesma busca, todas as linhas.
- `GET /api/discrepancias?ano` junta em um caso de `reclassificacao` (`compensacao`) duas rubricas inteiras da mesma entidade, situação e meses com valores exatamente opostos: pesam uma vez no grupo, e a conta do conferido não muda.
- `GET /api/discrepancias?ano` — a seção pública: `grupos` por área e tipo, com `rotulo`, `explicacao`, `total` e `itens`, `aguardando` à parte e `resumo`. Com uma área só conferida (de 2018 a 2022, a receita), `semConferencia` lista a outra (`area`, `faltando`, `foraDaFonte`) e os grupos são os da área conferida. Sem `avisos`, credor nem histórico. `404 { erro }` em ano inválido ou sem a coleta de receitas.
- `GET /api/conferencias?ano` — saída de `conferencia(ano)` (ver [conferencia.md](conferencia.md)); `404 { erro, faltando }` sem as cinco coletas.
- `GET /api/municipio` — sem `ano`. `comparacao` traz `orleans`, `santaCatarina` e `brasil` com os mesmos indicadores e a mesma conta, e `anoDoPib`, o último ano com PIB nos três; nula sem a coleta de `ibge_comparacao`, que não entra em `faltando` nem no retrato. O retrato da cidade pelo IBGE, do lote publicado de maior `ano` em cada consulta: `populacao.serie` (`ano`, `populacao`, `tipo` `censo`|`estimativa`), `territorio`, `situacao`, `piramide` (faixas de 5 anos, com `80 anos ou mais` somada das faixas abertas), `rendimento`, `pib.serie` (`pib` em mil reais, `perCapita`, `divisor`, `composicao`, nula sem virar zero) e `pib.ultimoAnoDaComposicao`. Cada bloco traz o próprio ano. Falta de coleta é `200 { disponivel: false, faltando }`, nunca 404.
- `GET /api/funcoes?ano` — a DCA Anexo I-E: `total` (sem a Câmara, igual à soma das funções), `funcoes[]` (três etapas, `participacao` em % sobre o total sem a Câmara da mesma etapa, `porMorador`, `subfuncoes`), `camara` (a função Legislativa, sempre à parte), `divisor` (`populacaoDoAno`, nulo sem o IBGE), `conferencia` (`conferido`, `diferenca`, `sem_tce`), `diferenca` (só com `diferenca`), `conferenciaEducacao` (`conferido`, `diferenca`, `sem_betha`, a função 12 × ações da Betha), `diferencaEducacao` (as três etapas, só com `diferenca`). `404 { erro }` em ano inválido ou sem DCA.
- `GET /api/funcoes/serie` — todos os exercícios publicados, com `valores: 'nominais'`: `anos[]` com `conferencia`, `conferenciaEducacao`, `total`, `funcoes` (com `participacao`) e `camara`. Sem coleta, `anos` vazio.
- `GET /api/saude` — `{ ok: true }` com o banco respondendo (`SELECT 1`), `503 { ok: false }` sem ele, sem a mensagem do erro. É o healthcheck do Coolify.
- `GET /api/importacoes` — por importador do registro: última execução (sem a mensagem de erro, que fica só no banco) e, por exercício, a data da consulta publicada mais antiga da fonte. Exemplo não conta.
- Rota desconhecida ou método diferente de `GET`: `404 { erro: 'Rota não encontrada' }`; exceção: `500 { erro: 'Erro interno' }`.

## Site

- Os arquivos do build saem pelo `@fastify/static` (`wildcard: false`, raiz por `path.resolve`, `index: false`): `assets/` com `Cache-Control` longo e imutável, o resto `no-cache`. O `index.html` não sai pelo nome (`allowedPath`): só pelas rotas das páginas, com o head certo.
- Uma rota `GET` por página do catálogo (`PAGINAS`, em [contracts.md](contracts.md)): o `index.html`, lido uma vez na subida, com o bloco `<!--head:inicio-->…<!--head:fim-->` trocado por `montarHead(pagina)`, `text/html; charset=utf-8`, `no-cache`. O head traz `<title>`, description, canonical e `og:url` (só com `siteUrl`), Open Graph (`og:image` = `/og.png` absoluto, só com `siteUrl`), Twitter e, com `verificacaoGoogle`, a meta do Search Console. Todo texto passa por `escaparHtml`. A query não muda a página nem o canonical.
- JSON-LD (`jsonld.ts`: `jsonLdDaPagina(pagina, { siteUrl, anos })`, `serializarJsonLd`), só com `siteUrl`, porque pede URL absoluta: a capa é `WebSite` (sobre a `City` Orleans, em Santa Catarina; `publisher` é o projeto, nunca a Prefeitura); as páginas com `dataset` no catálogo são `Dataset` (nome = título sem o sufixo, a descrição do catálogo, `license` CC BY 4.0, `isAccessibleForFree`, `creator`, `spatialCoverage`, `isBasedOn` com as fontes do catálogo); as de segundo nível, `BreadcrumbList` Início › área › página. Nenhum número do painel entra.
- `temporalCoverage` (`primeiro/último`) só em Receitas e Despesas: os exercícios de `/api/anos` são os das coletas da Betha e não dizem o período do IBGE, do SICONFI nem da Educação. `distribution` só em Receitas, o CSV do último exercício; o CSV de empenhos nunca é distribuição, porque traz nome de credor que pode ser pessoa física.
- Os exercícios vêm de `lerExercicios` (padrão `anosDisponiveis`), guardados por 5 minutos (`relogio` troca o tempo no teste): o index não consulta o banco a cada acesso. Banco fora do ar não derruba a página: o head sai sem o período, e a falha não fica em cache. `serializarJsonLd` troca `</` por `<\/` e `<!--` por `<!--`, para um texto não fechar o `<script>`.
- `/apoiar` só existe com `apoioAtivo`; sem ele, é 404 como qualquer caminho desconhecido.
- O que sobra (`setNotFoundHandler`): `GET` com barra no fim de uma página → `301` para o caminho sem ela, com a query; outro `GET` fora de `/api` → `404` com o index e o head de "Página não encontrada" (`meta robots noindex`); `/api` ou método diferente de `GET` → `404 { erro }` em JSON. Nada de 200 para endereço inexistente (soft 404).

## Regras de negócio

- Cada visão Betha é agregada à parte: nada soma receitas com despesas nem empenhos (57140) com despesa orçamentária (57170).
- As rotas de dados têm três estados: conferido; coleta de exemplo (os números fictícios de sempre, `meta.fonte` `DADOS FICTÍCIOS — exemplo` e `conferencia.disponivel: false`); ano real sem as cinco coletas (`conferencia.disponivel: false`, com `faltando`, arrecadação e execução nulas, listas vazias, e só o orçado, que é fonte única). Nos dois últimos, `/api/discrepancias` responde `disponivel: false`, sem grupos.
- Empenho: `empenhado` é o valor original da Betha (conceito da 57140); `empenhadoLiquido`, `liquidado` e `pago` são do TCE-SC, e `saldoAPagar` é liquidado − pago. Órgão, credor e histórico são da Betha.
- Histórico de credor que pode ser pessoa física sai nulo: `COLUNAS_DA_BETHA` (`empenhos.dao.ts`) mascara a coluna na relação `e` com `pareceOrganizacaoSql(coluna)`, o `PADRAO_DE_ORGANIZACAO` de [contracts.md](contracts.md) sobre `upper(unaccent(...))`. Lista, maiores, CSV e busca leem essa coluna, então nenhum vê nem procura no texto. O nome continua (LC 131). Fora da relação `e` (a conferência em `packages/db`), o histórico é o da coleta.
- Área sem conferência: `conferencia.faltando` lista só as coletas daquela área, e `conferencia.foraDaFonte` (ausente quando vazio) diz quais a fonte não publica no exercício (`foraDaFonte` de `packages/contracts`). Vale para receitas, despesas, empenhos e a seção inteira de discrepâncias quando as duas áreas faltam.
- A aba Dinheiro da Educação usa a receita de `conferenciaPorArea`: as rubricas conferidas de 2018 em diante entram sem esperar a despesa.
- Ano em curso: nada depois do corte do TCE-SC sai em agregado nem na lista. O valor fica em `conferencia.aguardandoTce` e em `aguardando` da seção.
- Despesa por função: o selo do total e o da divisão são níveis diferentes. `conferencia` vale para o total e a Legislativa; `conferenciaEducacao`, para a função 12, conferida com a Betha; cada outra função é fonte única. DCA de exemplo sai `sem_betha`. A diferença da função 12 fica fora de `/api/discrepancias` e sai em `/api/educacao/discrepancias`. Etapas nunca se somam, e a coleta nunca soma restos a pagar.
- Discrepâncias, área `funcao`: DCA × TCE-SC diferentes viram um grupo por etapa (`funcao_empenhado`, `funcao_liquidado`, `funcao_pago`), com um item para o total sem a Câmara e outro para a Legislativa, `betha` nulo, `dca`, `tce`, `maior`. Fora de `resumo.porArea`. Sem diferença, a resposta é a mesma de antes.
- Discrepâncias de educação: caso é **valor** diferente, comparado em centavos: percentual igual com valor diferente entra (2021), valor igual com percentual diferente não. Sem o valor de um lado (Fundeb de 2020 no Anexo 8) não há `diferenca` nem `maior`: o caso só existe se os dois percentuais existem e diferem, com `nota`. Ano com uma fonte só não compara: 2017 volta quando o Anexo 8 de 2012 a 2019 entrar. O texto não afirma causa, e a Emenda 119 não aparece aqui.
- Discrepâncias: um grupo por área e tipo, porque receita, despesa e empenhos não se somam (`sem_causa` pode sair três vezes). `total` soma `itens[].valor`, em módulo e em centavos; em `mes_diferente`, `valor` é o que mudou de mês. O tipo interno `empenho_fantasma` sai como `empenho_sem_execucao`, com o rótulo "Registro sem execução e sem par no TCE-SC". Rótulo, explicação e nota não afirmam causa.
- Grafias da Betha sem acento ("SERVIO") são agrupadas pela chave sem não-alfanuméricos; o nome exibido é a grafia mais frequente.
- A busca de empenhos ignora acento e caixa em número, credor, histórico (o já mascarado) e órgão.

## Regras de arquitetura

- Toda resposta JSON de sucesso sai por `responder(reply, schema, corpo)`, com o schema de `packages/contracts`: desvio vira erro aqui, não na tela.
- Valor pedido pelo usuário vai sempre como parâmetro do SQL; `filtroBusca` só interpola as cláusulas fixas dela.
- O conjunto casado é filtrado e somado no Postgres: os pares de `empenhosConferidos` entram por `unnest` e juntam com `tcesc_empenhos` por `id_externo` (`conjuntoConferido`, a relação `e` de todas as consultas de `empenhos.dao.ts`). Nunca some em JS.
- A seção copia campo a campo (`paraItem`): campo novo em `Discrepancia` não vira público sem passar por ali.
- Rota nova: módulo em `src/modules/`, schema no contracts, caso em `test/paridade/casos.ts`.

## Testes

- `test/integration/paridade.spec.ts` — compara cada pedido de `test/paridade/casos.ts` (`CASOS`) com a resposta gravada em `test/paridade/respostas/` (status, tipo, `Content-Disposition`, corpo; CSV com BOM), sobre o banco de `popularBancoDeTeste()`. Traz também valores escritos à mão, que provam que o gravado está certo.
- Regravar só com motivo no commit: `REGRAVAR_PARIDADE=1 pnpm exec vitest run --project=integracao apps/api/test/integration/paridade.spec.ts`.
- `test/integration/conferidos-por-area.spec.ts` — 2025 sem os empenhos do TCE-SC (receita igual, despesa sem número, seção com `semConferencia`) e 2016 só com a Betha (`foraDaFonte`), com `gravarLote` da fixture.
- `test/integration/conferidos.spec.ts` — só o conferido em cada rota, sobre cenários próprios: duplicidade, registro sem par, ano em curso, ano sem o TCE-SC, coleta de exemplo.
- `test/integration/empenhos-credor.spec.ts` — histórico mascarado na lista, nos maiores, no CSV e na busca, e o regex do Postgres igual ao `pareceOrganizacao` da tela.
- Unit: `gerarCsv`, `filtroBusca`, `montarSecao`, `criarApp` (`test/app.spec.ts`: o `X-Robots-Tag` e a saúde com `BancoFake`), o site (`test/site/site.spec.ts`: páginas, 301, 404, cache, sobre o `distFalso()` de `test/support/dist-falso.ts`, um build em miniatura em pasta temporária), o head (`test/site/head.spec.ts`) e o JSON-LD (`test/site/jsonld.spec.ts`); o site recebe `ExerciciosFake` no lugar do banco. `test/integration/site-jsonld.spec.ts` — o período do Dataset a partir de coletas publicadas de verdade. `test/integration/saude.spec.ts` — a saúde contra o Postgres. `app.inject()` serve para rota sem paridade; a paridade sobe o servidor de verdade, em porta efêmera.
