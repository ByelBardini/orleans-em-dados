# Fontes por API

Testadas em novembro de 2026. Código IBGE de Orleans: `4211702` (`421170` sem o dígito verificador). Santa Catarina: `42`. Brasil: `1`. Nenhuma API abaixo pede autenticação.

Nos exemplos, `-g` impede o `curl` de interpretar os colchetes.

## IBGE: Agregados v3 (Censo)

- **Documentação:** <https://servicodados.ibge.gov.br/api/docs/agregados?versao=3>
- **Catálogo de tabelas:** <https://servicodados.ibge.gov.br/api/v3/agregados>
- **Metadados de uma tabela:** `/api/v3/agregados/{tabela}/metadados`, com variáveis, classificações, categorias e níveis.
- **Consulta:** `/api/v3/agregados/{tabela}/periodos/all/variaveis/{v1,v2}?localidades=...&classificacao=...`

```bash
curl -g "https://servicodados.ibge.gov.br/api/v3/agregados/10091/periodos/all/variaveis/2513?localidades=N6[4211702]|N3[42]|N1[all]&classificacao=2[all]|58[95253]|2661[32776]|1[6795]"
```

**Parâmetros**

- `localidades`: `N6[4211702]` município, `N3[42]` estado, `N1[all]` Brasil, separados por `|`.
- `classificacao`: `id[categorias]`, separados por `|`. Sem a classificação, a API devolve só o total; `[all]` traz todas as categorias. Fixe o total das demais para não multiplicar linhas.

**Resposta:** lista de variáveis → `resultados` (um por combinação de categorias) → `series` (uma por localidade) → `serie` (`{ "2022": "97.27" }`). Tudo vem como texto.

**Tabelas usadas (Censo 2022)**

| Tabela | Conteúdo                                 | Variável | Classificações e categorias úteis                                                                                                          |
| ------ | ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 10091  | Taxa de alfabetização, 15 anos ou mais   | 2513     | 2 sexo (6794 total); 58 idade (95253 total); 2661 localização (32776 total); 1 situação (6795 total)                                       |
| 10092  | Pessoas por alfabetização                | 950      | 59 alfabetização (93024 total, 1023 sim, 1024 não); demais como na 10091                                                                   |
| 9543   | Alfabetização por cor ou raça            | 2513     | 2 sexo; 86 cor ou raça (95251 total); 287 idade (100362 total)                                                                             |
| 10056  | Taxa bruta de frequência escolar         | 3795     | 58 idade (99749 0–3; 47813 4–5; 31615 6–14; 2792 15–17; 100052 18–24; 108866 25+); 2 sexo; 86 cor                                          |
| 10139  | Taxa de escolarização                    | 12805    | 2 sexo; 58 idade; 839 deficiência (46583 total)                                                                                            |
| 10057  | Até 5 anos, por nível                    | 13282    | 11798 nível (95300 total); 58 idade; 2 sexo; 86 cor                                                                                        |
| 10058  | De 6 a 17 anos, por nível                | 13283    | Como na 10057                                                                                                                              |
| 10059  | 18 anos ou mais, por nível               | 13284    | Como na 10057                                                                                                                              |
| 10061  | Pessoas de 18 anos ou mais por instrução | 2667     | 1568 instrução (9493 até fundamental incompleto; 9494 fundamental; 9495 médio; 99713 superior); 58 idade; 2 sexo; 86 cor                   |
| 10062  | Média de anos de estudo                  | 13285    | 58 idade; 2 sexo; 86 cor                                                                                                                   |
| 10324  | Quem estuda, por local da escola         | 2021     | 468 local (79174 total; 12163 residência; 12164 outro município); 2 sexo; 58 idade; 11322 curso (79175 total; 121405 graduação; 12123 pós) |

**Censo 2010:** tabela 1549, variáveis 93 (população) e 364 (frequentava), classificação 58. A taxa de alfabetização de 2010 (tabela 1383) é de 10 anos ou mais, e não se compara direto com a de 2022. A tabela 1379 permite montar 15 anos ou mais somando idades.

**Armadilhas**

- Na 10061, a variável 1002667 é percentual sobre **todos os de 18 anos ou mais**, mesmo filtrando 25 ou mais. Calcule o percentual a partir das pessoas (2667).
- Tabela inexistente ou classificação inválida responde `500`, não `404`.
- `-` é zero absoluto. `...`, `..` e `X` são sem valor. O importador do IBGE já trata isso ([ibge.md](../context/ibge.md)).
- Áreas de formação do superior (10063) não têm nível municipal em 2022.
- Frequência, instrução e local da escola vêm da amostra do Censo. Em grupos pequenos, a margem é grande: não publicar cor ou raça nem deficiência de Orleans.

## IBGE: Pesquisas v1 (IDEB e rede escolar)

- **Documentação:** <https://servicodados.ibge.gov.br/api/docs/pesquisas?versao=1>
- **Árvore de indicadores:** `/api/v1/pesquisas/{pesquisa}/indicadores/0`
- **Resultados:** `/api/v1/pesquisas/{pesquisa}/periodos/all/indicadores/0/resultados/{local}`

```bash
curl "https://servicodados.ibge.gov.br/api/v1/pesquisas/40/periodos/all/indicadores/0/resultados/4211702"
```

| Pesquisa | Conteúdo                          | Indicadores úteis                                                                                                                                         |
| -------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 40       | IDEB, 2005–2025                   | 78187 iniciais pública; 78188 municipal; 78189 estadual; 78192 finais pública; 78193 municipal; 78194 estadual; 78197 médio pública; 78199 médio estadual |
| 13       | Censo Escolar, sinopse, 2008–2025 | Matrículas: 77882 creche, 5903 pré-escola, 5908 fundamental, 5913 médio. Docentes e escolas seguem a mesma árvore, por rede e etapa                       |

**Resposta:** lista de `{ id, res: [{ localidade, res: { "2025": "6.6" } }] }`. Junte com a árvore para saber o nome de cada `id`.

**Armadilhas**

- O código `id` só faz sentido com a árvore: repete a mesma lógica por rede e série.
- Funciona para município (`4211702`) e estado (`42`). `BR` responde lista vazia, e `1` responde `500`: IDEB do Brasil só no arquivo do INEP.
- Matrícula por rede no fundamental e no médio só existe por ano e série. É preciso somar.
- É republicação do INEP. Comparar com o arquivo do INEP não é conferência entre fontes independentes.
- Valor sem dado vem como `-` ou vazio. Ensino superior não traz valor para Orleans.

## SICONFI: RREO e DCA

- **Documentação:** <https://apidatalake.tesouro.gov.br/docs/siconfi/>
- **RREO:** `/ords/siconfi/tt/rreo`, com `an_exercicio`, `nr_periodo` (6 é o último bimestre), `co_tipo_demonstrativo=RREO`, `no_anexo` e `id_ente`.
- **DCA:** `/ords/siconfi/tt/dca`, já usada no projeto ([siconfi.md](../context/siconfi.md)).

```bash
curl "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio=2025&nr_periodo=6&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo%2014&id_ente=4211702"
```

**No Anexo 14**, procure em `conta` e `coluna`:

- `conta` com "Manutenção e Desenvolvimento do Ensino" e `coluna` "% Aplicado Até o Bimestre" ou "Valor Apurado Até o Bimestre".
- `conta` com "FUNDEB na Remuneração", nas mesmas colunas.

**Cobertura em Orleans:** índices em 2017 e de 2020 a 2025. O RREO de 2018 vem vazio, e o de 2019 não traz a linha. O Anexo 08 não existe no SICONFI para Orleans: o detalhe está no SIOPE.

## SIOPE: dados abertos (fora do ar nos testes)

- **Documentação:** <https://www.fnde.gov.br/olinda-ide/servico/DADOS_ABERTOS_SIOPE/versao/v1/aplicacao>
- **Base OData:** `https://www.fnde.gov.br/olinda-ide/servico/DADOS_ABERTOS_SIOPE/versao/v1/odata`

```bash
curl -G "https://www.fnde.gov.br/olinda-ide/servico/DADOS_ABERTOS_SIOPE/versao/v1/odata/Indicadores_Siope(Ano_Consulta=@Ano_Consulta,Num_Peri=@Num_Peri,Sig_UF=@Sig_UF)" --data-urlencode "@Ano_Consulta=2025" --data-urlencode "@Num_Peri=6" --data-urlencode "@Sig_UF='SC'" --data-urlencode "\$filter=COD_MUNI eq 421170" --data-urlencode "\$format=json"
```

**Estado em novembro de 2026:** todas as chamadas responderam `500` ("Unable to acquire JDBC Connection"). Nada aqui foi confirmado com dado real, nem o formato de `COD_MUNI`.

**Entidades**, segundo o [pacote R tesouror](https://rdrr.io/cran/tesouror/src/R/siope.R):

| Entidade                                                                                                                                           | Parâmetros                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `Indicadores_Siope`, `Dados_Gerais_Siope`, `Despesas_Siope`, `Despesas_Funcao_Educacao_Siope`, `Receita_Siope`, `Informacoes_Complementares_Siope` | `Ano_Consulta`, `Num_Peri`, `Sig_UF`                    |
| `Remuneracao_Siope`                                                                                                                                | `Ano_Declaracao`, `Num_Peri`, `Mes_Exercicio`, `Sig_UF` |

Enquanto a API não volta, o caminho é o relatório: [fontes-download.md](fontes-download.md#siope). A remuneração traz dados pessoais: guardar só agregados, nunca em `registros_brutos`.

## Já no projeto

| Fonte                 | O que dá para educação                                     | Documentação                    |
| --------------------- | ---------------------------------------------------------- | ------------------------------- |
| Betha, consulta 57170 | Despesa por ação e natureza (ações de educação, pelo nome) | [betha.md](../context/betha.md) |
| Betha, consulta 57153 | Repasses por rubrica                                       | [betha.md](../context/betha.md) |
| TCE-SC, receitas      | Dedução para o Fundeb e conferência dos repasses           | [tcesc.md](../context/tcesc.md) |
| IBGE 6579 e 4709      | População, divisor do gasto por morador                    | [ibge.md](../context/ibge.md)   |

## Testadas e descartadas

| Fonte                                                                              | Por quê                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [LDE/UFPR](https://simcaq.c3sl.ufpr.br/api/v1/enrollment/years)                    | Série até 2020, e a consulta de matrículas de Orleans veio vazia                                                                                 |
| [Base dos Dados](https://basedosdados.org/search?q=inep)                           | Cópia tratada do INEP: não é conferência independente, exige conta Google, e a alfabetização vai só até 2024. O catálogo GraphQL respondeu `504` |
| [QEdu](https://qedu.org.br/municipio/4211702-orleans)                              | Sem API confirmada, e bloqueia acesso automatizado (`403`). Útil para consulta visual                                                            |
| [Painel SIOPE](https://www.gov.br/fnde/pt-br/assuntos/sistemas/siope/painel-siope) | Power BI, sem API. A coluna de Fundeb não bate com o relatório oficial                                                                           |
