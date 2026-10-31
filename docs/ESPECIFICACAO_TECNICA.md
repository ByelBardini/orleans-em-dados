# Orleans em Dados — Especificação técnica, fontes, coleta e validação

> **Versão:** 1.0 — 31/10/2026  
> **Status:** Documento-base para desenvolvimento (não é homologação contábil)  
> **Município:** Orleans, Santa Catarina — código IBGE **4211702**  
> **Objetivo:** dashboard público, rastreável, com indicadores municipais, detalhamento de receitas e despesas e comparação com órgãos de controle.

## 1. Resumo executivo e decisões de produto

**Decisão arquitetural:** usar o **Portal da Transparência Betha** como fonte principal dos dados publicados pelo município, preservando registros e informações das entidades; usar **TCE-SC/e-Sfinge, SICONFI (DCA/RREO/RGF)** como fontes de comparação, especialmente para exercícios encerrados. Onde o portal Betha consultado não abranger o Legislativo, utilizar fonte específica da Câmara/TCE-SC, com a origem visível.

**Regra fundamental:** não somar consultas que representam diferentes *visões* da mesma despesa ou receita. Exemplo: empenhos detalhados, despesas por credor e despesas por programa podem se referir à mesma execução orçamentária. A consulta de empenhos originais não substitui a despesa líquida de anulações.

**Principais descobertas validadas em 2025:**

- Autenticação OAuth anônima e consulta direta via Node.js **funcionaram** sem copiar um token manualmente.
- Foram baixados **9.757 empenhos** da Betha (`57140`) com **9.757 IDs únicos** e os campos somados coincidiram com os totalizadores daquela consulta.
- Foram baixados **1.469 registros de receitas** da Betha (`57153`), com **1.469 IDs únicos**, e orçamento atualizado/arrecadação coincidiram exatamente com os respectivos totalizadores.
- A despesa atualizada da Betha (`57170`) cobre as quatro entidades examinadas. A diferença exata em relação ao consolidado do TCE-SC para 2025 (**R$ 2.981.800,76** em cada etapa) corresponde às despesas da **Câmara Municipal**, exibidas separadamente no TCE-SC.
- Na arrecadação, o total Betha excede o total TCE-SC em **R$ 177.771,67**. As diferenças estão localizadas por entidade e por algumas rubricas, mas **as causas contábeis não foram comprovadas**.

**O que NÃO está validado:** contrato/SLA ou permissão de produção para endpoints internos Betha; renovação após expiração real em um processo de longa duração; garantia de paginação estável com `sortBy=null`; conciliação documental de todas as rubricas; séries históricas de outros exercícios.

## 2. Escopo funcional do dashboard

### 2.1 Primeira versão

1. **Visão geral:** ano/entidade, receita arrecadada, orçamento previsto/atualizado, despesa empenhada líquida, liquidada e paga; gráficos mensais e distribuição por entidade.
2. **Receitas:** natureza da receita, rubrica/código, evolução mensal, composição das receitas e orçamento versus realizado; preservar valores negativos (ajustes/reclassificações).
3. **Despesas:** execução orçamentária por entidade e categoria; consulta de empenhos individuais por órgão, credor, número, histórico e data.
4. **Conferência das fontes:** Betha x TCE-SC/SICONFI para exercícios encerrados; destacar diferença absoluta e percentual, abrangência, método e data da apuração.
5. **Metadados e transparência:** fonte, ID da consulta, URL de origem, filtro, exercício, data de coleta, entidade, versão do cálculo e status de validação.

### 2.2 Fora do escopo inicial / próximas etapas

Saúde e educação com indicadores legais, RCL e despesa de pessoal, dívida/restos a pagar, licitações, contratos, transferências, indicadores IBGE e histórico multianual. Projetar a estrutura para acrescentá-los, sem misturar esses conceitos ao MVP.

## 3. Inventário de fontes

| Fonte | Papel no projeto | Endereço |
|---|---|---|
| Betha — Transparência de Orleans | **Dados operacionais principais** de Executivo, fundos e autarquias | https://transparencia.betha.cloud/#/mJRAZlfGu2RI9KNBWj49aw==/consulta/57140 |
| API de consultas Betha | Dados estruturados e totalizadores do portal; API interna observada, estabilidade a confirmar | `https://api.transparencia.betha.cloud` |
| TCE-SC / Farol / e-Sfinge | Conferência anual, tabelas por unidade gestora, incluindo Câmara | https://servicos.tcesc.tc.br/farol_externo/ |
| SICONFI / Tesouro Nacional | DCA, RREO e RGF; auditoria e séries padronizadas | https://www.siconfi.tesouro.gov.br/ |
| API SICONFI | Possível ingestão automática de demonstrativos oficiais | https://apidatalake.tesouro.gov.br/docs/siconfi/ |
| IBGE — Localidades, Agregados, SIDRA | Indicadores demográficos e socioeconômicos futuros | https://servicodados.ibge.gov.br/api/docs |

**Atenção à abrangência:** “dados de Orleans” não implica automaticamente “Prefeitura + fundos + autarquias + Câmara”. A consulta Betha analisada trouxe quatro entidades; o painel de despesas do TCE-SC apresentou cinco unidades gestoras. Documentar o escopo de cada valor.

### 3.1 Catálogo Betha relevante

| ID | Nome/objetivo | Uso previsto |
|---|---|---|
| `57140` | Execução Detalhada de Despesas | Empenhos individuais |
| `57170` | Despesas Orçamentárias | Valor empenhado atualizado, liquidado atualizado, pago atualizado |
| `57171` | Despesas por Credor | Visão por credor; **não adicionar aos empenhos** |
| `57172` | Despesas por Programas e Ações | Análise funcional/temática |
| `57178` | Despesas com Pessoal | Recorte de pessoal, não total geral |
| `57153` | Receitas Orçamentárias | Valores mensais e orçamento |
| `57133` | Receita Prevista × Realizada | Visão comparativa |
| `57154` | Receitas Orçamentárias Diárias | Investigar lançamentos individualmente |
| `57150` | Receitas Tributárias Arrecadadas | Recorte tributário |

Os IDs foram descobertos no menu/configuração pública do portal e observados em requisições reais. A API pode mudar: **não considerar contratos oficiais de integração sem confirmação da Betha**.

## 4. Descoberta e funcionamento da API Betha

### 4.1 Cabeçalhos e contexto

```text
API base: https://api.transparencia.betha.cloud
app-context: eyJwb3J0YWwiOiJtSlJBWmxmR3UyUkk5S05CV2o0OWF3PT0ifQ==
Content-Type: application/json;charset=UTF-8
Authorization: Bearer <TOKEN_ANÔNIMO_TEMPORÁRIO>
```

`app-context` representa o contexto do portal de Orleans, **não é um substituto para autenticação**. Sem bearer token, a API respondeu `401` / `Sem token de autenticação`; com token expirado, `401` / `Token expirado`; com token válido, `200`.

### 4.2 Endpoints observados

```http
POST /transparencia/api/busca-textual/57140?sortBy=null&sortDirection=null&offset=0&limit=20&hiperlink=false
Content-Type: application/json;charset=UTF-8
Authorization: Bearer <token>
app-context: <contexto>

{"anoExercicio":["2025"]}
```

```http
POST /transparencia/api/busca-textual/57140/totalizadores

{"anoExercicio":["2025"]}
```

Para receitas:

```http
POST /transparencia/api/busca-textual/57153?sortBy=null&sortDirection=null&offset=0&limit=20&hiperlink=false

{"ano":["2025"]}
```

```http
POST /transparencia/api/busca-textual/57153/totalizadores

{"ano":["2025"]}
```

**Ponto crítico:** filtros são diferentes por consulta: `57140` usa `anoExercicio`; `57153` usa `ano`. Um payload `{}` retornou **19.139** registros de receitas de vários exercícios; o filtro correto de 2025 retornou **1.469**. Não assumir um esquema único de filtros. Para `57170`, conferir o payload real de exercício/entidade antes de implementar.

Também foram observados endpoints de menu, configuração, ordenação, filtros, tabular e gráficos; nem todos são necessários para o MVP.

### 4.3 Estrutura das respostas

Busca textual:

```json
{
  "totalHits": 1469,
  "hits": [
    {
      "id": "211:728:697340_4",
      "sourceAsMap": {
        "rubricaNatureza": "17295101010000",
        "descricaoNatureza": "Transf. Estado - FEAS PSB Proteção Social Básica",
        "valorOrcadoAtualizado": 0,
        "valorArrecadadoNoMes": -6236.62,
        "valorArrecadadoAteMes": 14552.11
      }
    }
  ]
}
```

Totalizadores: array de objetos `{ campo, titulo, descricao, totalizar: "SOMA", valor, ... }`. `totalHits` é **quantidade de linhas**, não valor financeiro.

### 4.4 OAuth anônimo — descoberta confirmada

Fluxo observado no portal:

```text
GET https://plataforma-oauth.betha.cloud/auth/oauth2/authorize
  ?response_type=token
  &client_id=91a97459-f1d8-4b29-b5fa-2e51d1692623
  &redirect_uri=https://transparencia.betha.cloud/auth-callback.html
  &scope=transparencia.public
  &bth_ignore_origin=true
  &access_mode=anonymous
```

O navegador recebeu **HTTP 303** com redirecionamento para `auth-callback.html#access_token=...&token_type=bearer&expires_in=...`. O Node.js, usando `fetch(..., { redirect: 'manual' })`, também recebeu **HTTP 303 e token**, sem login interativo. Os tempos observados variaram (~2.000–2.600 s); usar sempre `expires_in` da resposta, não um valor fixo.

**Prova de ponta a ponta:** em 31/10/2026, o script Node.js pediu token automaticamente e fez POST em `57140`, retornando HTTP 200, `totalHits=9757`, 20 registros da primeira página.

**Segurança e manutenção:**

- Nunca colocar tokens, cabeçalhos `Authorization` nem `Location` completo em logs, repositórios ou respostas ao navegador. Um token foi compartilhado durante testes anteriores; não reutilizá-lo.
- Manter token apenas no backend, em memória e com margem para expiração; em `401`, invalidar e renovar **uma vez**, sem laço infinito.
- Não usar o client ID do portal como garantia de autorização para integração em produção. Verificar termos de uso, alternativas de Dados Abertos e eventual cliente/fluxo oficialmente suportado.
- O fluxo observado é `response_type=token` (Implicit); preferir fluxo suportado para servidor, quando disponível. Uma prova de viabilidade técnica **não** é autorização contratual ou garantia de compatibilidade futura.
- Não usar browser headless nem contornar barreiras de autenticação se a API deixar de oferecer o acesso anônimo.

### 4.5 Exemplo de cliente Node.js (somente autenticação + uma consulta)

```js
const API = 'https://api.transparencia.betha.cloud';
const CONTEXT = 'eyJwb3J0YWwiOiJtSlJBWmxmR3UyUkk5S05CV2o0OWF3PT0ifQ==';

async function novoTokenAnonimo() {
  const u = new URL('https://plataforma-oauth.betha.cloud/auth/oauth2/authorize');
  u.search = new URLSearchParams({
    response_type: 'token',
    client_id: '91a97459-f1d8-4b29-b5fa-2e51d1692623',
    redirect_uri: 'https://transparencia.betha.cloud/auth-callback.html',
    scope: 'transparencia.public',
    bth_ignore_origin: 'true',
    access_mode: 'anonymous'
  });
  const r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  if (r.status !== 303) throw new Error(`OAuth: HTTP ${r.status}`);
  const loc = r.headers.get('location');
  if (!loc) throw new Error('OAuth sem Location');
  const redirect = new URL(loc);
  if (redirect.origin !== 'https://transparencia.betha.cloud' ||
      redirect.pathname !== '/auth-callback.html') {
    throw new Error('Destino OAuth não esperado');
  }
  const hash = new URLSearchParams(redirect.hash.slice(1));
  const token = hash.get('access_token');
  const expiresIn = Number(hash.get('expires_in'));
  if (!token || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('Credencial inválida');
  }
  return { token, expiresAt: Date.now() + expiresIn * 1000 };
}

async function consultarPrimeiraPagina(token, consulta, filtro, limit = 20) {
  const qs = new URLSearchParams({
    sortBy: 'null', sortDirection: 'null', offset: '0',
    limit: String(limit), hiperlink: 'false'
  });
  const r = await fetch(`${API}/transparencia/api/busca-textual/${consulta}?${qs}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'app-context': CONTEXT,
      'Content-Type': 'application/json;charset=UTF-8',
      Accept: 'application/json'
    },
    body: JSON.stringify(filtro),
    signal: AbortSignal.timeout(30000)
  });
  if (!r.ok) throw new Error(`Betha: HTTP ${r.status}`);
  return r.json();
}

// Exemplo:
// const { token } = await novoTokenAnonimo();
// const { totalHits, hits } = await consultarPrimeiraPagina(token, 57153, { ano: ['2025'] });
```

O exemplo cobre uma página e **não** é o job de ingestão completo. Para produção, implementar renovação, paginação, observabilidade e carga transacional conforme seção 9.

## 5. Coletas já executadas: despesas 2025

### 5.1 Execução detalhada — consulta `57140`

**Filtro:** `{"anoExercicio":["2025"]}`; **linhas:** 9.757; **IDs únicos:** 9.757. As datas de empenho examinadas pertencem ao exercício de 2025. Códigos intermediários de ID observados: `728` (6.220 linhas), `319` (2.241), `2473` (1.200), `320` (96). A correspondência com entidades é fortemente indicada pelos registros, mas deve ser armazenada em tabela de mapeamento verificada.

Principais campos de `sourceAsMap`:

| Campo | Semântica |
|---|---|
| `numeroEmpenho` | Número local do empenho; não assumir unicidade global |
| `dataEmpenho` | Data de emissão do empenho |
| `descricaoOrgao` | Órgão/secretaria (variações e erros de caracteres observados) |
| `credor.nomeCredor` | Credor |
| `historicoEmpenho` | Descrição textual |
| `valorEmpenho` | Valor do empenho no formato dessa consulta |
| `valorLiquidadoEmpenho` | Total liquidado do empenho descontadas anulações de liquidação (descrição Betha) |
| `valorPagoEmpenho` | Total pago do empenho descontadas anulações de pagamento (descrição Betha) |
| `saldoAPagar` | Campo informado quando presente; não inferir contabilmente a partir de outros campos |

**Campos ausentes:** 278 registros não traziam `valorLiquidadoEmpenho`, `valorPagoEmpenho` nem `saldoAPagar`. Preservar `NULL` e reportar a taxa de ausência. Na soma compatível com o totalizador, somaram-se apenas valores presentes; não interpretar ausência como evidência de zero.

#### Resultado e conferência com totalizadores da própria Betha

| Campo | Soma extraída | Totalizador `57140` | Diferença |
|---|---:|---:|---:|
| `valorEmpenho` | R$ 160.833.350,29 | R$ 160.833.350,29 | R$ 0,00 |
| `valorLiquidadoEmpenho` | R$ 142.524.230,52 | R$ 142.524.230,52 | R$ 0,00 |
| `valorPagoEmpenho` | R$ 142.524.230,52 | R$ 142.524.230,52 | R$ 0,00 |

**Não usar R$ 160,83 milhões como despesa empenhada líquida anual:** o indicador de orçamento executado deve preferir `57170` (`valorEmpenhadoAtualizado`) e declarar abrangência. A igualdade de valores liquidados e pagos em `57140` foi reproduzida pelo totalizador, mas merece ressalva por não refletir necessariamente toda a realidade de pagamentos da contabilidade.

### 5.2 Despesas orçamentárias — consulta `57170`

Valores filtrados para 2025 e individualizados por entidade no portal:

| Entidade | Empenhado atualizado | Liquidado atualizado | Pago atualizado |
|---|---:|---:|---:|
| Prefeitura | R$ 96.456.944,43 | R$ 91.608.142,40 | R$ 91.608.142,40 |
| Fundo Municipal de Saúde | R$ 44.499.944,22 | R$ 42.389.952,53 | R$ 42.389.952,53 |
| SAMAE | R$ 12.192.810,66 | R$ 11.517.145,30 | R$ 11.133.139,14 |
| Fundação Ambiental | R$ 794.559,11 | R$ 794.559,11 | R$ 794.559,11 |
| **Total Betha (4 entidades)** | **R$ 153.944.258,42** | **R$ 146.309.799,34** | **R$ 145.925.793,18** |

Descrição Betha: `valorEmpenhadoAtualizado` considera empenhos e suas anulações; `valorLiquidadoAtualizado`, liquidações e anulações; `valorPagoAtualizado`, pagamentos e anulações.

### 5.3 Conciliação das despesas com a Câmara e TCE-SC

O painel de despesas do TCE-SC de 2025 apresentou **5 unidades gestoras**, incluindo a Câmara, e os seguintes valores para o Legislativo:

**Câmara Municipal de Orleans: R$ 2.981.800,76 empenhado, R$ 2.981.800,76 liquidado, R$ 2.981.800,76 pago.**

| Etapa | Betha (4 entidades) | Câmara (TCE-SC) | Consolidado reconciliado / TCE-SC |
|---|---:|---:|---:|
| Empenhado | R$ 153.944.258,42 | R$ 2.981.800,76 | **R$ 156.926.059,18** |
| Liquidado | R$ 146.309.799,34 | R$ 2.981.800,76 | **R$ 149.291.600,10** |
| Pago | R$ 145.925.793,18 | R$ 2.981.800,76 | **R$ 148.907.593,94** |

Os três totais resultantes coincidem **exatamente** com o painel de despesas do TCE-SC e valores da DCA apresentados na investigação. Esta conciliação é específica de **2025** e não deve ser generalizada para qualquer ano sem novo teste.

**Diferença com o RREO:** no 6º bimestre de 2025, foram apontados no RREO R$ 157.420.554,34 empenhados, R$ 149.291.557,31 liquidados e R$ 148.907.551,15 pagos em “despesas exceto intraorçamentárias”, diferentes dos números acima. O motivo específico não foi demonstrado; não chamar os relatórios de idênticos ou explicar como retificação sem prova.

## 6. Coletas já executadas: receitas 2025

### 6.1 Receitas orçamentárias — consulta `57153`

**Filtro correto:** `{"ano":["2025"]}`; **1.469 registros**; **1.469 IDs únicos**; **nenhum campo faltante** para `valorOrcadoAtualizado` ou `valorArrecadadoNoMes`. Existem registros negativos de arrecadação mensal; foram observados **7** no levantamento, preservados na soma.

| Campo | Soma extraída | Totalizador Betha | Diferença |
|---|---:|---:|---:|
| `valorOrcadoAtualizado` | R$ 149.083.697,04 | R$ 149.083.697,04 | R$ 0,00 |
| `valorArrecadadoNoMes` | R$ 171.092.955,92 | R$ 171.092.955,92 | R$ 0,00 |

Outros campos: `rubricaNatureza` (tratar como string), `descricaoNatureza`, `valorOrcado`, `valorOrcadoDeducoes`, `valorLancadoNoMes`, `valorArrecadadoAteMes` (acumulado), `percentualRealizado`.

**Regra contábil:** somar `valorArrecadadoNoMes`, com sinais, para obter o total compatível com o totalizador. **Não somar** `valorArrecadadoAteMes` entre competências: é acumulativo. O ID de receitas termina frequentemente em `_1`, `_2`, ..., `_12`; isso **sugere** o mês, mas validar a semântica antes de construir a série mensal definitiva.

### 6.2 Receita Betha por entidade, confirmada por filtros

| Entidade | Orçamento atualizado | Arrecadação |
|---|---:|---:|
| Prefeitura | R$ 116.270.133,66 | R$ 134.471.455,26 |
| Fundo Municipal de Saúde | R$ 17.029.000,00 | R$ 25.280.415,83 |
| SAMAE | R$ 15.665.563,38 | R$ 11.219.933,18 |
| Fundação Ambiental | R$ 119.000,00 | R$ 121.151,65 |
| **Total** | **R$ 149.083.697,04** | **R$ 171.092.955,92** |

O portal ofereceu opções com nomes duplicados para Fundo de Saúde e Fundação Ambiental; uma opção de cada retornou zero. **Não assumir que são pessoas jurídicas distintas**: mapear por ID oficial da entidade e conferir o cadastro. A grafia da Fundação Ambiental também apareceu corrompida em algumas consultas.

### 6.3 Comparação com TCE-SC (2025)

O painel de planejamento/execução do TCE-SC exibiu receita realizada **R$ 170.915.184,25** e receita prevista **R$ 137.628.308,90**. A comparação de receita prevista com `valorOrcadoAtualizado` Betha **não é equivalente até verificar o critério (inicial x atualizada)**.

| Entidade | Betha: arrecadado | TCE-SC: arrecadado líquido | Betha − TCE-SC |
|---|---:|---:|---:|
| Prefeitura | R$ 134.471.455,26 | R$ 134.468.170,70* | +R$ 3.284,56 |
| Fundo Municipal de Saúde | R$ 25.280.415,83 | R$ 24.710.279,03 | +R$ 570.136,80 |
| SAMAE | R$ 11.219.933,18 | R$ 11.615.582,87 | −R$ 395.649,69 |
| Fundação Ambiental | R$ 121.151,65 | R$ 121.151,65 | R$ 0,00 |
| **Total** | **R$ 171.092.955,92** | **R$ 170.915.184,25** | **+R$ 177.771,67** |

\* Prefeitura TCE-SC **inferida por diferença dos totais**, não obtida em totalizador individual de centavos; validar diretamente em exportação antes de marcar como fechada por entidade.

A igualdade da soma das diferenças **localiza** a divergência, mas **não resolve sua causa**.

### 6.4 Rubricas divergentes — exportações TCE-SC vs Betha

Os arquivos de 2025 `fundo municipal de saude.xlsx` e `samae.xlsx` foram comparados às receitas da Betha, agrupando naturezas num nível comum (os códigos completos de classificação não tinham necessariamente a mesma granularidade).

**Fundo Municipal de Saúde:**

| Natureza agrupada | Betha | TCE-SC | Betha − TCE-SC |
|---|---:|---:|---:|
| `17135011` — SUS, Atenção Primária | R$ 13.635.187,54 | R$ 13.315.050,74 | +R$ 320.136,80 |
| `24145001` — Convênios da União/SUS | R$ 2.276.110,00 | R$ 2.026.110,00 | +R$ 250.000,00 |
| **Soma diferenças** | | | **+R$ 570.136,80** |

**SAMAE:**

| Natureza agrupada | Betha | TCE-SC | Betha − TCE-SC |
|---|---:|---:|---:|
| `11130311` — IRRF sobre trabalho | R$ 0,00 no conjunto atribuído ao SAMAE | R$ 428.717,37 | −R$ 428.717,37 |
| `22130101` — Alienação de bens móveis | R$ 65.800,00 | R$ 32.900,00 | +R$ 32.900,00 |
| `16110101` — Serviços administrativos e comerciais | R$ 10.830.832,59 | R$ 10.830.664,91 | +R$ 167,68 |
| **Soma diferenças** | | | **−R$ 395.649,69** |

**Hipóteses NÃO confirmadas:** lançamento duplicado, receita retificada após fechamento, retenção de IRRF registrada em outra entidade, diferença de critério entre arrecadação e arrecadação líquida, reclassificação por rubrica. Não usar linguagem de irregularidade sem prova.

**Pistas para investigação futura:** a alienação do SAMAE aparece na Betha como dois registros de **R$ 32.900,00** (IDs mensais diferentes) e o TCE-SC mostra R$ 32.900,00; a receita de convênios da saúde possui diferença exata de R$ 250.000,00. Analisar lançamentos da `57154` e as competências do TCE-SC antes de decidir se são estornos, duplicações aparentes ou classificações distintas.

## 7. Regras de negócio e apresentação

### 7.1 Indicadores e fontes preferidas

| Indicador | Fonte principal | Observação |
|---|---|---|
| Receita arrecadada por mês/natureza | Betha `57153` (`valorArrecadadoNoMes`) | Preservar negativos; não somar acumulados |
| Receita orçada atualizada | Betha `57153` (`valorOrcadoAtualizado`) | Não comparar diretamente à “prevista” TCE sem alinhar conceito |
| Empenhos individualizados | Betha `57140` | Mostrar histórico, credor, órgão e número |
| Despesa empenhada líquida | Betha `57170` (`valorEmpenhadoAtualizado`) | Considera anulações, diferente da soma dos empenhos originais |
| Despesa liquidada/paga orçamentária | Betha `57170` | Não substituir pelos campos da `57140` |
| Despesa da Câmara | TCE-SC ou transparência própria da Câmara | Fonte e abrangência explícitas |
| Despesa municipal com Legislativo | Betha + Câmara, **após conciliação por ano** | Não assumir união automática para todos os anos |
| Comparação de exercício encerrado | TCE-SC/SICONFI | Exibir diferença, explicação/status e posição temporal |

### 7.2 Status de confiabilidade

- `coletado`: registros armazenados; ainda não comparados.
- `integridade_validada`: contagem, IDs e filtros consistentes.
- `totalizador_conciliado`: somatório reproduz totalizador da própria fonte.
- `comparacao_externa_pendente`: fonte externa não carregada ou critério incomparável.
- `comparacao_externa_com_divergencia`: diferença numérica localizada; **não significa erro**.
- `comparacao_externa_conciliada`: diferenças explicadas e documentação preservada.

Não chamar “validado” sem especificar **o nível** (integridade, totalizador, comparação externa). Exercício encerrado não significa imutável: aceitar retificações.

### 7.3 UX e transparência

- Filtros por **exercício, entidade, competência, órgão, natureza/credor** conforme dados disponíveis.
- Valor com rótulo exato (*empenhado atualizado*, *liquidado atualizado*, *arrecadado no mês*, etc.).
- Exibir “última extração”, “período de referência” e “fonte oficial” em cada seção.
- Na comparação externa, explicitar que uma diferença pode decorrer de critério, abrangência ou atualização.
- Permitir abrir a consulta original; divulgar metodologia e limitações.
- Não criar automaticamente indicador de **superávit** apenas por subtrair receita Betha − empenhos detalhados Betha; deve obedecer ao balanço orçamentário consolidado e critérios contábeis.

## 8. Modelo de dados sugerido (PostgreSQL)

Separar conteúdo **bruto imutável por execução** de conteúdo **normalizado/materializado**. Sugestão de tabelas:

| Tabela | Chave/atributos principais | Finalidade |
|---|---|---|
| `fontes` | `id`, `nome`, `url`, `tipo` | Catálogo das origens |
| `entidades` | `id`, `nome_canonico`, `codigo_betha`, `codigo_tce`, `tipo`, `poder` | Cruzamento Prefeitura/FMS/SAMAE/Fundação/Câmara |
| `consultas` | `fonte_id`, `consulta_id`, `nome`, `filtro_schema`, `versao` | Metadados dos endpoints |
| `coletas` | `id`, `consulta_id`, `ano`, `filtros_json`, `started_at`, `finished_at`, `status`, `total_hits`, `capturados`, `hash`, `erro` | Auditoria de jobs |
| `registros_brutos` | `coleta_id`, `id_externo`, `payload_jsonb`, `payload_hash` | Resposta original, sem perdas |
| `empenhos` | `id_externo`, `ano`, `entidade_id`, `numero`, `data`, `orgao`, `credor`, `historico`, `valor_empenho`, `valor_liquidado`, `valor_pago`, `saldo` | Pesquisa detalhada |
| `receitas_mensais` | `id_externo`, `ano`, `entidade_id`, `rubrica`, `mes`, `orcado_atualizado`, `arrecadado_mes`, `arrecadado_ate_mes` | Agregações mensais |
| `totais_fonte` | `coleta_id`, `campo`, `valor`, `metodologia` | Totalizadores e demonstrativos externos |
| `conciliacoes` | `ano`, `indicador`, `abrangencia`, `fonte_a`, `fonte_b`, `valor_a`, `valor_b`, `diferenca`, `status`, `nota` | Evidência de auditoria |
| `mapeamentos_rubrica` | `fonte`, `codigo_original`, `codigo_canonico`, `vigencia` | Padronização controlada por exercício |

**Recomendações:** `NUMERIC(18,2)` no PostgreSQL, não `FLOAT` monetário; chaves compostas por fonte + ano + ID externo quando necessário; `JSONB` bruto para permitir reprocessamento; não sobrescrever históricos sem guardar a execução anterior. A parte intermediária de IDs Betha (`728`, `319`, `2473`, `320`) deve ser **confirmada** como código de entidade antes de fixar um mapeamento.

## 9. Plano de implementação e coleta programada

O usuário decidiu implementar a automação **junto do dashboard**, e não como projeto isolado. Proposta em etapas:

### Etapa A — Protótipo fiel ao teste

1. Backend Node.js (versão 20+) com `BethaAuthClient` e `BethaQueryClient` privados.
2. `BethaAuthClient`: obter token, validar destino do `303`, ler `expires_in`, armazenar token só em memória, renovar com antecedência, repetir apenas 1 vez em `401`.
3. `BethaQueryClient`: passar `app-context`, filtros por consulta, `offset/limit`, timeout, retries exponenciais limitados em `429/5xx`, limite de taxa e logs sem segredos.
4. Rotas REST públicas lerão **PostgreSQL**, não consultarão a Betha em cada acesso.

### Etapa B — Extração e validação transacional

1. Definir catálogo de coletores: `57140` com `anoExercicio`, `57153` com `ano`, `57170` com filtro a confirmar em HAR/payload.
2. Buscar primeira página, registrar `totalHits`, paginar até alcançar o total.
3. Identificar/solicitar **ordenação estável**; `sortBy=null` pode provocar deslocamento/omissão se ocorrer atualização durante coleta. Validar repetição da coleta ou usar ordenação/partição temporal quando suportado.
4. Validar `IDs únicos`, contagem, formato dos campos, ano e origem. Detectar mudança de `totalHits` durante o processo e interromper com alerta.
5. Buscar `/totalizadores` usando **o mesmo corpo de filtros**.
6. Calcular somas usando precisão decimal/centavos; preservar valores negativos e `null`.
7. Comparar por campo com totalizadores; se alguma checagem falhar, **não substituir o snapshot publicado**.
8. Gravar dados em staging, fazer troca transacional do snapshot aprovado, manter relatório da execução e snapshots anteriores.

### Etapa C — Validação externa por exercício

1. Importar dados consolidados TCE-SC (inclusive Legislativo) e DCA/RREO SICONFI.
2. Alinhar ano, entidade, poder, moeda, conceito e momento de fechamento antes de comparar.
3. Comparar por rubrica e entidade. Registrar divergências com estado `pendente`/`explicada`, valores, fonte, data e documentação.
4. Para 2025, iniciar pela matriz já documentada nas seções 5 e 6.

### Etapa D — Atualização contínua

- Exercício corrente: atualização configurável (ex.: diária), de preferência fora do pico, com limites de taxa.
- Exercícios encerrados: revalidação periódica menos frequente, pois podem ocorrer retificações.
- Se OAuth ou API falhar: **continuar exibindo o último snapshot validado**, identificar data da última atualização e alertar manutenção.
- Monitorar falhas 401/403/429, mudanças em `totalHits`, esquemas ou totalizadores e divergências de conciliação.
- Fazer backup, reprocessamento idempotente e versionar o cálculo.

Essas frequências são propostas de engenharia, não características oficialmente documentadas da Betha.

## 10. Passo a passo para reproduzir os testes de 2025

### Preparação

```bash
node -v
# Node 20 ou superior; não precisa instalar biblioteca para usar fetch.
```

1. Acessar o portal Betha de Orleans; abrir DevTools → Network → Fetch/XHR.
2. Filtrar exercício e inspecionar **Payload** da busca; em despesas `57140` é `anoExercicio:["2025"]`, em receitas `57153` é `ano:["2025"]`.
3. Inspecionar a resposta de `/totalizadores` para os mesmos filtros.
4. Executar o cliente Node.js de autenticação + consulta (seção 4.5); nunca compartilhar token.
5. Implementar coleta paginada com IDs únicos e reportar totalHits versus total extraído.
6. Somar somente campos apropriados por consulta: receita mensal em `57153`; empenho original em `57140`; empenhado atualizado em `57170`.
7. Confrontar cada soma com **totalizador da própria consulta**; zero de diferença valida o somatório interno, não a contabilidade consolidada.
8. Verificar abrangência no TCE-SC; em 2025 o TCE-SC inclui a Câmara, que faltou à seleção Betha.
9. Para receitas, confrontar totais líquidos do TCE-SC por entidade e rubrica; preservar os cinco grupos divergentes identificados.
10. Registrar origem, hash/versão do arquivo, data e observações, para auditoria reprodutível.

### Artefatos gerados na investigação

- `empenhos-2025.json` — 9.757 registros de `57140`.
- `receitas-2025.json` — 1.469 registros de `57153`, com relatório e totalizadores.
- `relatorio-receitas-2025.json` — integridade e conciliação de receitas.
- `SICONFI_DCA_9181_ANUAL_1.xls` — DCA Executivo / exercício 2025.
- `SICONFI_RREO_9181_BIMESTRAL_6.xls` — RREO 6º bimestre.
- `SICONFI_RGF_9181_QUADRIMESTRAL_3.xls` — RGF Executivo 3º quadrimestre.
- `SICONFI_RGF_9182_QUADRIMESTRAL_3.xls` — RGF Legislativo 3º quadrimestre.
- `fundo municipal de saude.xlsx` e `samae.xlsx` — exportações de receitas do TCE-SC para conciliação por rubrica.
- `betha_orleans_catalogo.csv` / `.json` — inventário de consultas observado.

**Nota:** estes nomes identificam arquivos de trabalho da investigação; não implicam que estejam automaticamente incluídos neste documento Markdown. Guardá-los em repositório de dados de referência ou armazenamento privado apropriado, conforme tamanho e sensibilidade.

## 11. Pendências, riscos e critérios de aceite

### Pendências objetivas

- [ ] Confirmar a legalidade/adequação do acesso automatizado aos endpoints internos da Betha; avaliar canal oficial de Dados Abertos.
- [ ] Testar obtenção e renovação do OAuth em execução longa, inclusive expiração real e falhas transitórias.
- [ ] Obter ordenação de paginação estável; validar reconciliação sob atualização durante coleta.
- [ ] Confirmar mapeamento formal de entidades e denominações duplicadas/corrompidas.
- [ ] Obter filtro exato e extração completa da consulta `57170` no backend.
- [ ] Conferir e explicar diferenças das cinco rubricas de receita identificadas (FMS e SAMAE), inclusive competência e critérios de dedução.
- [ ] Confirmar diretamente a Prefeitura no TCE-SC (valor de R$ 134.468.170,70 atualmente inferido).
- [ ] Alinhar conceito de previsão inicial/atualizada antes de comparar Betha e TCE-SC.
- [ ] Definir integração com Câmara e regra para despesas consolidadas em outros exercícios.
- [ ] Estabelecer política de atualização, retenção, registro de erros e snapshots.

### Critérios de aceite do MVP

- [ ] Os indicadores principais citam claramente a fonte, período, unidade gestora e o conceito contábil.
- [ ] Não há dupla contagem entre visões Betha.
- [ ] A coleta transacional nunca publica um conjunto incompleto ou não conciliado com o próprio totalizador.
- [ ] É possível abrir qualquer empenho detalhado e localizar sua origem.
- [ ] A comparação anual com TCE-SC mostra divergências **sem classificá-las automaticamente como irregularidade**.
- [ ] O módulo de despesas inclui opção de mostrar Executivo isolado versus consolidado com Legislativo, quando os dados externos estiverem disponíveis/conciliados.
- [ ] Os dados monetários são armazenados e exibidos sem erro de precisão, com negativos e nulos preservados.
- [ ] Backend não expõe token OAuth ao navegador, nem a logs públicos.

## 12. Convenções de engenharia e decisões a manter

- Stack sugerida, não obrigatória: **React + Vite** no frontend, **Node.js** no backend e **PostgreSQL**; usar tipos/validações de payload e testes de integração.
- Separar `raw` de `normalized`, `source_total` de `computed_total`, `source_date` de `collected_at`.
- Códigos de rubrica: sempre **strings** (não números), mantendo zeros à esquerda.
- Valores financeiros: tipo decimal exato no banco e somas por centavos/decimal no ETL.
- Análises fiscais mais amplas (superávit, RCL, despesa com pessoal, índices constitucionais) exigem fonte e metodologia próprias.
- Compare períodos equivalentes; não misture data do empenho, data de pagamento, competência e data da atualização da consulta.
- A fonte da Prefeitura pode sofrer retificações após fechamento; manter histórico e carimbo de data, não prometer imutabilidade.

---

## 13. Glossário contábil essencial

- **Empenho:** reserva/compromisso da dotação orçamentária; não equivale por si só a pagamento.
- **Empenhado atualizado:** no contexto da `57170`, saldo de empenhos considerando anulações.
- **Liquidação:** verificação do direito do credor com base nos documentos e na execução do objeto.
- **Pagamento:** desembolso/quitação de obrigação; pode ocorrer em exercício diferente daquele do empenho.
- **Receita arrecadada no mês:** movimento mensal; pode incluir valores negativos de ajuste.
- **Receita arrecadada até o mês:** valor acumulado; não somar entre meses.
- **Intraorçamentária:** operação orçamentária entre integrantes do mesmo orçamento consolidado; pode exigir tratamento de eliminação ou evidenciação específica conforme demonstrativo.
- **TCE-SC/SICONFI:** fontes externas de controle e declaração; não são sinônimos de cada consulta operacional Betha.

**Regra editorial final:** o objetivo do Orleans em Dados é mostrar **o que foi publicado, com qual abrangência, como foi calculado e como se compara a outras fontes**. Uma diferença encontrada é uma informação de transparência — não prova, por si, erro contábil ou irregularidade.
