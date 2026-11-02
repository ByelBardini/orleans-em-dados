# Plano: dashboard só com dados conferidos e seção de discrepâncias

> **Status:** aprovado em 2026-11-01; implementação não iniciada
> **Data:** 2026-11-01
> **Pedido original:** o dashboard exibe só dados verificados, e os dados com problema vão para a seção de discrepâncias, separados por tipo.
> **Na especificação:** §2.1 (itens 1 a 5), §7.1 e §7.2 (fontes e confiabilidade, a atualizar), Etapa C do §9, critérios de aceite do §11 (dupla contagem e comparação com o TCE-SC).

## Contexto

Hoje as páginas mostram os totais da Betha e colocam selos ao lado. Depois da conferência manual de 01/11/2026, sabemos que esses totais incluem valores que o próprio portal não sustenta: receita fora do acumulado, mesmo valor em duas rubricas, consórcio em duas linhas da 57170 e empenhos fantasmas. O cidadão que lê o dashboard vê esses números como se estivessem certos.

O pedido troca o modelo. O número principal passa a ser só a parte conferida entre as fontes, e cada diferença ganha lugar próprio, com tipo, valores e situação. Quem mantém as coletas continua com o dado bruto intacto.

**Termo público:** a especificação (§7.2) proíbe "validado" sem dizer o nível. A interface usa **"conferido com o TCE-SC"**. "Verificado" fica só como nome interno do conceito. Igualdade entre as fontes não é auditoria.

**O que a pesquisa mostrou:**

- Publicadores de dados abertos separam registro **retido** de registro apenas **sinalizado**, e dão números para os dois ([Open Opps](https://openopps.com/blog/data-quality-reports-2026-02-07/)).
- Filtrar o que foi sinalizado não produz um conjunto limpo por si só. É preciso dizer o que ficou de fora e por quê ([GBIF](https://docs.gbif.org/course-data-use/en/flags-and-issues.html)).
- Dashboards tendem a esconder incerteza, e a orientação é deixar claro o status de cada estatística e como ela muda com o tempo ([OSR, perguntas para dashboards](https://osr.statisticsauthority.gov.uk/guidance/regulatory-guidance-dashboards/pages/6), [OSR, orientação](https://osr.statisticsauthority.gov.uk/guidance/regulatory-guidance-dashboards/pages/4)).
- A pesquisa não encontrou referência direta para uma seção de divergências entre duas fontes. Essa parte é decisão de produto do projeto.

## Decisões tomadas

| Pergunta                       | Escolha                                          | Por quê                                                                                                                    |
| ------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Receita divergente: o que sai? | Só a diferença                                   | O valor comum às fontes continua. Em 2025, ficam cerca de R$ 170,47 mi, contra R$ 168,07 mi retirando o cruzamento inteiro |
| Meses que o TCE não recebeu    | Separar como "aguardando TCE"                    | Segue a regra sem tratar atraso como erro. Hoje: outubro de 2026, com R$ 10,26 mi de receita e 956 empenhos (R$ 14,2 mi)   |
| Dados de fonte única           | Manter com rótulo "fonte única, sem conferência" | Orçamento, órgão e Câmara nunca poderão ser conferidos neste modelo                                                        |
| Valor da despesa               | Betha conferida, execução do TCE                 | Encerrado: 57170 se bater. Ano em curso: TCE até o corte. Lista: empenhos casados, com liquidado e pago do TCE             |
| Tabela de rubricas             | Misto                                            | 14 dígitos quando todos os meses batem. Natureza com mês divergente fica em 8 dígitos, sem inventar rateio                 |
| Registro da conferência manual | Arquivo versionado                               | Histórico no git, sem tabela nova                                                                                          |
| Organização da seção           | Renomear para "Discrepâncias" e agrupar por tipo | O leitor sabe onde foram parar os valores retirados                                                                        |
| Testes de tela                 | Testing Library + jsdom                          | Prova que um valor retirado não volta aos cartões e tabelas                                                                |

**Consequência a registrar na interface:** o total conferido pode ficar abaixo das duas fontes. A página sempre mostra a conta: conferido + em discrepância = total da fonte.

## Fontes e conferência

- **Receita arrecadada** — fonte: Betha 57153; conferida contra: TCE-SC por entidade, natureza de 8 dígitos e mês; selo: `conferido com o TCE-SC`.
- **Despesa empenhada, liquidada e paga (encerrado)** — fonte: Betha 57170; conferida contra: TCE-SC por unidade gestora; selo: `conferido com o TCE-SC`.
- **Despesa no ano em curso** — fonte: TCE-SC até a data de corte; conferida contra: Betha 57140, empenho a empenho; selo: `conferido com a Betha até DD/MM`.
- **Lista de empenhos** — identificação e órgão: Betha 57140; liquidado e pago: TCE-SC; casamento 1:1 entre as fontes; selo: `conferido com o TCE-SC`.
- **Orçamento e órgão** — fonte: Betha; sem conferência; selo: `fonte única`.
- **Câmara** — fonte: TCE-SC; sem conferência; selo: `fonte única`, sempre à parte.

## O que já existe e será reaproveitado

- `packages/db/src/conferencia/conferencia.dao.ts` — `receitaIncoerente`, `receitaRepetida` e o casamento de empenhos com desempate.
- `packages/db/src/conferencia/conferencia.bo.ts` — `anotarNaturezas`, `anotarEmpenho`, `empenhosForaDaSoma` e `ehParcial`.
- `packages/db/src/conferencia/conferencia.service.ts` — ponto único usado pela API e pelo `pnpm conferir`.
- `apps/api/src/indicadores.js` e `apps/api/src/server.js` — agregações, rotas e CSV.
- `apps/api/test/integration/paridade.spec.js` — regravação das respostas, com motivo no commit.
- `apps/web/src/selos.jsx`, `apps/web/src/components.jsx` e `apps/web/src/paginas/Conferencia.jsx` — selos, componentes e base da nova seção.
- `packages/contracts/src/api/` — schemas Zod das respostas.
- Da `main`, a portar: `causa`, `explicada` e `receitaMesPorRubrica` (commits `fbda1df` e `0d13330`).

## O que será criado do zero

- **Separação da receita:** regra pura que divide cada cruzamento em parte conferida e diferença. Hoje só existe a comparação.
- **Classificação por tipo de discrepância:** hoje há notas em texto, sem um tipo estável.
- **Regra da despesa em duplicidade:** detecta quando retirar as linhas de modalidade 71 fecha com o TCE.
- **Registro de conferências manuais:** arquivo com situação, evidência e protocolo.
- **Rota `GET /api/discrepancias`** e a página da seção, com contrato próprio.
- **Testes de componente:** primeira adoção de Testing Library + jsdom em `apps/web`.

## Pré-requisitos

- **Commitar a migração em andamento.** A branch `chore/plataforma-typescript` tem alterações não commitadas em `packages/importadores` e nos testes. Nenhuma fase começa antes disso.
- **Publicar a branch de migração ou integrá-la à `main`.** Este trabalho deve nascer em branch própria a partir dela.

## Fases

### Fase 1 — Código atualizado com a `main`

**Objetivo:** a conferência em TypeScript tem `causa`, `explicada` e a decomposição mensal que já estão na `main`.

1. `/testar packages/db/src/conferencia/conferencia.bo.ts "classifica causa e explicada"` → `packages/db/test/conferencia/conferencia.bo.spec.ts` com os cenários: duplicidade em dois meses → `causa` "Possível duplicidade", `explicada` verdadeiro; diferença que soma zero no grupo de 6 dígitos → "Provável reclassificação"; rubrica sem padrão → `causa` nula, `explicada` falso (camada: unit). `/testar packages/db/src/conferencia/conferencia.dao.ts "decompõe o mês por rubrica"` → `packages/db/test/integration/conferencia.spec.ts` com: mês com duas rubricas divergentes → duas parcelas que somam a diferença do mês; mês igual → sem parcela (camada: integração).
2. Rodar os specs e confirmar que falham pela asserção.
3. Fazer o merge da `origin/main` e portar `fbda1df` e `0d13330` para `packages/db/src/conferencia/`, `packages/contracts/src/api/conferencias.ts` e `apps/web/src/`.
4. Rodar e confirmar que passa; driver do `/testar` sem achado novo; suíte inteira verde.
5. Atualizar `docs/context/conferencia.md`: causa, explicada e parcelas por mês.

### Fase 2 — Separar a receita em conferida e diferença

**Objetivo:** cada cruzamento de entidade, natureza e mês vira parte conferida + diferença com tipo.

1. `/testar packages/db/src/conferencia/conferencia.bo.ts "separa receita conferida"` → `packages/db/test/conferencia/conferencia.bo.spec.ts` com os cenários (camada: unit):
   - iguais: Betha 100,00 e TCE 100,00 → conferido 100,00, diferença zero;
   - Betha maior: 150,00 e 100,00 → conferido 100,00, diferença +50,00 do lado Betha;
   - TCE maior: 100,00 e 150,00 → conferido 100,00, diferença de 50,00 do lado TCE;
   - só em uma fonte: Betha nula e TCE 80,00 → conferido 0,00, tipo `so_tce`;
   - negativos de mesmo sinal: −100,00 e −60,00 → conferido −60,00;
   - sinais opostos: 50,00 e −50,00 → conferido 0,00;
   - precisão: valores em centavos sem erro de ponto flutuante;
   - classificação: linha em `receitaIncoerente` → `fora_do_acumulado`; mesmo valor em outra rubrica do mês → `duas_rubricas`; diferença anual zero com meses opostos → `mes_diferente`; sem padrão → `sem_causa`.
2. Rodar o spec e confirmar que falha pela asserção.
3. Implementar em `conferencia.bo.ts` a função `separarReceita` e o tipo `TipoDiscrepancia`.
4. Rodar e confirmar que passa; driver sem achado novo; suíte verde.
5. Atualizar `docs/context/conferencia.md`: regra da separação e ordem dos tipos.

### Fase 3 — Consultas da receita conferida

**Objetivo:** o banco devolve a receita conferida por mês, entidade, origem e natureza, com os detalhes do formato misto.

1. `/testar packages/db/src/conferencia/conferencia.service.ts "receita conferida por ano"` → `packages/db/test/integration/conferencia.spec.ts` com os cenários (camada: integração):
   - exercício encerrado: fixture com rubrica duplicada → total conferido igual à soma das partes comuns;
   - conta fecha: conferido + diferença do lado Betha = total da 57153;
   - ano em curso: mês depois do corte do TCE → fora do conferido e listado como `aguardando_tce`;
   - misto: natureza com todos os meses iguais → 14 dígitos; com um mês divergente → uma linha de 8 dígitos;
   - sem as coletas do TCE → `{ disponivel: false }`, sem número conferido;
   - coleta de exemplo → permanece identificada como exemplo.
2. Rodar e confirmar que falha pela asserção.
3. Implementar em `conferencia.dao.ts` e `conferencia.service.ts`. Corrigir o texto de `receitaIncoerente`, que aponta o mês em que o acumulado desencontra, e não o da linha sobrando.
4. Rodar e confirmar que passa; driver sem achado novo; suíte verde.
5. Atualizar `docs/context/conferencia.md` e `docs/context/db.md`.

### Fase 4 — Despesa conferida por entidade

**Objetivo:** cada entidade tem um valor conferido ou sai para a seção.

1. `/testar packages/db/src/conferencia/conferencia.bo.ts "despesa conferida por entidade"` → `packages/db/test/conferencia/conferencia.bo.spec.ts` com os cenários (camada: unit):
   - igual nas três etapas → valor da 57170;
   - diferença igual à soma das linhas de modalidade 71 nas três etapas → valor sem essas linhas, tipo `despesa_duplicada`;
   - fecha no empenhado, mas não no liquidado → não conferido, tipo `sem_causa`;
   - diferença sem padrão → entidade fora do conferido, sem zerar as demais.

   `/testar packages/db/src/conferencia/conferencia.service.ts "despesa no ano em curso"` → `packages/db/test/integration/conferencia.spec.ts` com: empenhos casados até o corte → soma do líquido do TCE, com a data do corte; empenho depois do corte → `aguardando_tce`; Câmara → à parte e fora da soma (camada: integração).

2. Rodar e confirmar que falha pela asserção.
3. Implementar a regra em `conferencia.bo.ts` e a consulta da modalidade em `conferencia.dao.ts`.
4. Rodar e confirmar que passa; driver sem achado novo; suíte verde.
5. Atualizar `docs/context/conferencia.md`.

### Fase 5 — Empenhos conferidos

**Objetivo:** a lista e os resumos só usam empenhos casados 1:1, com a execução do TCE.

1. `/testar packages/db/src/conferencia/conferencia.bo.ts "classifica empenho sem par"` → `packages/db/test/conferencia/conferencia.bo.spec.ts` com os cenários (camada: unit):
   - sem par, sem execução e em ano encerrado → `empenho_fantasma`;
   - repetido com a mesma chave → `empenho_repetido`;
   - só no TCE → `empenho_ausente`;
   - só na Betha com execução → `sem_causa`, nunca apagado;
   - ano em curso depois do corte → `aguardando_tce`, nunca fantasma.

   `/testar packages/db/src/conferencia/conferencia.dao.ts "número na outra fonte exige credor"` → `packages/db/test/integration/conferencia.spec.ts` com: mesma data e valor de credores diferentes → sem pista de renumeração; mesma data, valor e credor → com pista (camada: integração).

2. Rodar e confirmar que falha pela asserção.
3. Implementar em `conferencia.bo.ts` e `conferencia.dao.ts`, ajustando `OUTRO_NUMERO` para exigir credor ou histórico. Trocar `empenhosForaDaSoma` pelo conjunto casado.
4. Rodar e confirmar que passa; driver sem achado novo; suíte verde.
5. Atualizar `docs/context/conferencia.md`.

### Fase 6 — Duplicidades espalhadas em várias linhas

**Objetivo:** rubricas provisórias, como a 13210300, deixam de ter nota genérica.

1. `/testar packages/db/src/conferencia/conferencia.dao.ts "detecta repetição linha a linha"` → `packages/db/test/integration/conferencia.spec.ts` com os cenários: três linhas de rubrica provisória iguais a outras três da rubrica definitiva, mesmo mês → as três marcadas como `duas_rubricas`; valores iguais em entidades diferentes → sem marcação; mesma rubrica em meses diferentes → sem marcação por esta regra; soma combinada sem linha igual → `sem_causa` (camada: integração).
2. Rodar e confirmar que falha pela asserção.
3. Implementar a consulta linha a linha em `conferencia.dao.ts`, com o casamento 1:1 por entidade, mês e valor.
4. Rodar e confirmar que passa; driver sem achado novo; suíte verde.
5. Atualizar `docs/context/conferencia.md`.

### Fase 7 — Registro das conferências manuais

**Objetivo:** cada caso diz se é hipótese do cálculo ou se foi confirmado à mão.

1. `/testar packages/db/src/conferencia/conferencias-manuais.ts "cruza registro com discrepância"` → `packages/db/test/conferencia/conferencias-manuais.spec.ts` com os cenários (camada: unit):
   - caso com registro → situação `confirmada_no_portal`, data e protocolo;
   - sem registro → `calculada`;
   - registro sem discrepância correspondente → aviso de registro obsoleto, sem quebrar;
   - valor mudou depois da confirmação → `rever`;
   - entrada com código de acompanhamento → recusada pela validação.
2. Rodar e confirmar que falha pela asserção.
3. Criar `packages/db/src/conferencia/conferencias-manuais.ts` com os casos desta conferência e o e-SIC 000/0000. Os números dos demais protocolos entram quando forem informados.
4. Rodar e confirmar que passa; driver sem achado novo; suíte verde.
5. Atualizar `docs/context/conferencia.md`: como registrar um caso.

### Fase 8 — API: indicadores conferidos e rota de discrepâncias

**Objetivo:** as rotas passam a devolver o conferido, e a nova rota entrega a seção.

1. `/testar apps/api/src/server.js "rotas devolvem só o conferido"` → `apps/api/test/integration/conferidos.spec.js` com os cenários (camada: integração):
   - `/api/receitas` → totais conferidos e bloco com a conta até o total da fonte;
   - `/api/receitas.csv` → mesmos valores da rota JSON;
   - `/api/despesas/resumo` em ano com duplicidade → valor sem as linhas retiradas;
   - `/api/despesas/empenhos` → sem fantasma, e `q` não encontra registro retirado;
   - `/api/despesas/empenhos.csv` → mesmo conjunto da lista;
   - `/api/discrepancias?ano` → grupos por tipo com valores, fonte e situação, e sem nome de credor;
   - `/api/discrepancias` sem ano ou com ano inválido → `404 { erro }`;
   - ano sem TCE → estado "sem conferência", sem número inventado.
2. Rodar e confirmar que falha pela asserção.
3. Implementar em `indicadores.js`, `server.js` e `packages/contracts/src/api/`, com o schema novo da rota.
4. Rodar e confirmar que passa. Revisar a diferença das respostas de paridade caso a caso e regravar com o motivo no commit. Driver sem achado novo; suíte verde.
5. Atualizar `docs/context/api.md` e `docs/context/contracts.md`.

### Fase 9 — Testes de componente

**Objetivo:** `apps/web` testa componentes de verdade.

1. `/testar apps/web/src/selos.jsx "selo diz o nível da conferência"` → `apps/web/test/selos.spec.jsx` com os cenários: conferido com o TCE → texto "conferido com o TCE-SC"; fonte única → "fonte única, sem conferência"; aguardando → "aguardando TCE", sem linguagem de erro; nenhum selo usa "validado" nem "irregular" (camada: componente).
2. Rodar e confirmar que falha pela asserção.
3. Instalar Testing Library e jsdom como dependências de desenvolvimento, configurar o projeto no `vitest.config.ts` e ajustar `selos.jsx`.
4. Rodar e confirmar que passa; driver sem achado novo; suíte verde.
5. Atualizar `docs/context/web.md`: novas dependências e como testar componente. Atualizar a seção de testes do `AGENTS.md`.

### Fase 10 — Páginas com dados conferidos

**Objetivo:** Visão Geral, Receitas e Despesas só exibem números conferidos ou de fonte única rotulada.

1. `/testar apps/web/src/paginas/Receitas.jsx "exibe só conferido"` → `apps/web/test/paginas/Receitas.spec.jsx`, e equivalentes para `VisaoGeral.jsx` e `Despesas.jsx`, com os cenários (camada: componente):
   - resposta com diferença → cartão mostra o conferido e nunca o total da fonte como principal;
   - a conta "conferido + em discrepância = total da fonte" aparece com link para a seção;
   - natureza em 8 dígitos e em 14 dígitos convivem na tabela;
   - orçamento e Câmara têm o selo de fonte única;
   - ano em curso → período "até setembro" e aviso de meses aguardando;
   - sem conferência → estado explicando a falta, sem número.
2. Rodar e confirmar que falha pela asserção.
3. Implementar nas páginas e em `components.jsx`. Trocar os selos de "diverge" pela ligação com a seção, onde couber.
4. Rodar e confirmar que passa; driver sem achado novo; suíte verde. Verificar no navegador com as coletas reais.
5. Atualizar `docs/context/web.md`.

### Fase 11 — Seção Discrepâncias

**Objetivo:** o leitor vê cada valor retirado, separado por tipo.

1. `/testar apps/web/src/paginas/Discrepancias.jsx "agrupa por tipo"` → `apps/web/test/paginas/Discrepancias.spec.jsx` com os cenários (camada: componente):
   - grupos separados: fora do acumulado, duas rubricas, só no TCE, despesa em duplicidade, empenhos e sem causa;
   - "aguardando TCE" aparece à parte, com texto de pendência;
   - caso confirmado mostra data e protocolo, e caso calculado diz "provável";
   - grupo sem casos não aparece;
   - nenhum texto usa "irregularidade" ou "fraude";
   - o hash antigo `#conferencia` abre a seção nova.
2. Rodar e confirmar que falha pela asserção.
3. Criar `paginas/Discrepancias.jsx` a partir de `Conferencia.jsx`, mantendo a comparação por entidade, e atualizar `ABAS` em `App.jsx`.
4. Rodar e confirmar que passa; driver sem achado novo; suíte verde. Verificar no navegador com as coletas reais.
5. Atualizar `docs/context/web.md`.

### Fase 12 — Documentação pública e especificação

**Objetivo:** o que o site explica é o que ele faz.

1. `/testar apps/web/src/paginas/Metodologia.jsx "explica conferido, fonte única e aguardando"` → `apps/web/test/paginas/Metodologia.spec.jsx` com os cenários: os três termos aparecem com definição; o texto diz que igualdade entre fontes não é auditoria; há link para Discrepâncias (camada: componente).
2. Rodar e confirmar que falha pela asserção.
3. Atualizar `Metodologia.jsx`, `docs/METODOLOGIA.md`, `docs/CONFERENCIA_BETHA_TCE.md` (incluindo o erro "19 sem liquidação") e os §7.1, §7.2 e §2.1 da especificação.
4. Rodar e confirmar que passa; `pnpm test && pnpm lint` verdes.
5. Atualizar `docs/context/conferencia.md` e `AGENTS.md`.

## Riscos

- **Número menor que as duas fontes:** é esperado, e por isso a conta aparece sempre ao lado do total.
- **Fontes mudam:** o TCE ou a Betha podem retificar um valor. A separação é calculada na consulta, então um caso resolvido sai sozinho. A Fase 7 marca como `rever` o caso confirmado cujo valor mudou.
- **Dependência do TCE:** se o painel mudar e a coleta parar, os meses novos ficam como "aguardando TCE", e o dashboard para de avançar. É o custo aceito ao escolher só dados conferidos.
- **Custo da consulta:** se o cálculo por requisição ficar lento com mais anos, o cache de exclusões do `server.js` pode ser estendido. Não entra agora, porque são poucos anos.

## Fora do escopo

- **Mudar coleta e dados brutos:** os registros seguem como vieram, porque são a prova do que o portal publicou.
- **Mudar o status da coleta:** `totalizador_conciliado` continua significando só o que diz.
- **Corrigir valor sem fonte:** nenhum número é calculado sem existir em pelo menos uma fonte.
- **Consumir o detalhamento da 57170 pela API:** a prova empenho a empenho do consórcio foi manual.
- **Automatizar FNS, Banco do Brasil ou Transferegov.**
- **Credor pessoa física na lista de empenhos atual:** a lista já exibe nomes de credor sem separar pessoa física, o que contraria a regra do projeto. Não muda aqui, mas precisa de plano próprio. A seção nova já nasce sem nome de credor.
