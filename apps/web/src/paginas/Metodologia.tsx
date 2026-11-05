import { FRASE_DA_DIFERENCA } from '../conferido';

const REPO = 'https://github.com/ByelBardini/orleans-em-dados/blob/main/docs';
const LEI_DO_PNE = 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/L15388.htm';

export default function Metodologia() {
  return (
    <>
      <div className="abertura">
        <h1 className="manchete">
          Cada número aqui pode ser <em>conferido</em> na fonte original.
        </h1>
        <div className="abertura-lado">
          <p className="capitular">
            As finanças vêm do Portal da Transparência de Orleans e do Farol do TCE-SC. O número principal do painel é
            só a parte em que as duas fontes coincidem, e o que difere fica listado na seção Discrepâncias. A despesa
            por função vem do SICONFI, e o retrato da cidade, do IBGE. A educação soma INEP, SIOPE e MEC.
          </p>
        </div>
      </div>

      <div className="colunas">
        <article className="secao larga texto-corrido">
          <h2 style={{ marginTop: 0 }}>De onde vêm os dados</h2>
          <p>
            Os valores são coletados do <strong>Portal da Transparência Betha</strong> de Orleans, nas consultas{' '}
            <code>57153</code> (Receitas Orçamentárias), <code>57140</code> (Execução Detalhada de Despesas) e{' '}
            <code>57170</code> (Despesas Orçamentárias), e do <strong>Farol do TCE-SC</strong>, que reúne o que o
            município envia ao Tribunal de Contas. O site lê cópias já conferidas com o total de cada fonte; não
            consulta as fontes a cada acesso.
          </p>
          <p>
            Os valores por morador usam a população do IBGE (censos e estimativas anuais): o número do próprio ano, ou o
            anterior mais próximo quando o IBGE não estimou aquele ano. Em cada valor, o texto diz qual divisor foi
            usado. Os textos em linguagem simples, como “repasses da União e do Estado”, agrupam os códigos oficiais de
            receita pelos dois primeiros dígitos.
          </p>

          <h2>IBGE e SICONFI</h2>
          <p>
            O IBGE cobre população, território, situação do domicílio, pirâmide etária, rendimento e PIB. Não há outra
            fonte para comparar: cada número leva fonte única, sem conferência, com o próprio ano. Na coleta, as partes
            de cada tabela são conferidas com o total da própria tabela.
          </p>
          <p>
            Em Conheça Orleans, os cartões trazem Santa Catarina e Brasil ao lado de Orleans, nas mesmas tabelas do IBGE
            e no mesmo ano. O número do estado e o do país valem para todos os moradores juntos: não são a média simples
            dos municípios. Cada número diz quanto está acima ou abaixo, em pontos quando já é percentual. Verde e
            vermelho só aparecem no dinheiro, onde mais é melhor.
          </p>
          <p>
            O SICONFI cobre a despesa por função, pela DCA, Anexo I-E, que o município entrega ao Tesouro Nacional. A
            DCA só existe depois do exercício encerrado, e o prazo de entrega é 30 de abril do ano seguinte.
          </p>
          <p>
            O total da despesa por função é comparado com o TCE-SC, nas três etapas. Quando fecha, leva “conferido com o
            TCE-SC”; num ano sem coleta do Tribunal, leva fonte única; com diferença, o valor de cada fonte vai para{' '}
            <a href="#discrepancias">Discrepâncias</a>. Cada função leva fonte única, sem conferência, porque o TCE-SC
            coletado não tem esse recorte, e função não é entidade: igualdade do total não confere cada função. A função
            12, Educação, é a única com par: é comparada com a soma das ações de educação na Betha.
          </p>
          <p>
            A função Legislativa é a Câmara: fica à parte, fora do total e da participação das outras funções, como na
            aba Despesas.
          </p>
          <p>
            O PIB per capita é calculado aqui, com o PIB e a população do IBGE. Em 2023, divide pelo Censo 2022, porque
            o IBGE não estimou aquele ano, e o resultado de Orleans, R$ 59.547,10, é o mesmo que o IBGE publica.
          </p>
          <p>
            Para o Brasil, a mesma conta dá R$ 53.886,67. As Contas Nacionais do IBGE publicam R$ 51.693,92 para o mesmo
            ano: o PIB é igual, e a população é outra, 211,7 milhões em vez dos 203,1 milhões do Censo. O painel compara
            com o primeiro, porque Orleans também divide pelo Censo.
          </p>
          <p>
            PIB per capita não é a renda do morador: divide pela população tudo o que é produzido na cidade, e pode
            refletir uma atividade concentrada. Por isso o rendimento domiciliar do Censo aparece ao lado. A despesa por
            função está em valores nominais, sem correção pela inflação: a comparação entre anos usa a participação de
            cada função no total. Gastar mais numa área não prova serviço melhor, e a função Educação não é o índice
            constitucional de educação.
          </p>

          <h2>O que aparece no painel</h2>
          <p>
            O número principal é o conferido: a parte que as fontes sustentam. Por isso, ele pode ficar abaixo de cada
            uma delas, e a página sempre mostra a conta: conferido + em discrepância = total da fonte. Nas páginas de
            cada área, o símbolo ao lado de cada número diz o nível da conferência. Passe o mouse ou toque nele para ler
            o texto:
          </p>
          <ul>
            <li>
              <span className="selo-icone" aria-hidden="true">
                ✓
              </span>{' '}
              <strong>conferido com o TCE-SC</strong>: o valor que as duas fontes registram, ao centavo, por entidade,
              natureza e mês na receita, por entidade na despesa, e empenho a empenho na lista.
            </li>
            <li>
              <span className="selo-icone" aria-hidden="true">
                ✓
              </span>{' '}
              <strong>conferido com a Betha até DD/MM</strong>: no ano em curso, a despesa vem do TCE-SC, só nos
              empenhos que têm par na Betha até a data do último dado que o Tribunal recebeu.
            </li>
            <li>
              <span className="selo-icone" aria-hidden="true">
                ✓
              </span>{' '}
              <strong>conferido com a Betha</strong>: sem data, é o gasto com educação de um exercício encerrado. A
              função 12 da DCA é igual, ao centavo, à soma das ações de educação na Betha, nas três etapas. Só o total é
              conferido. Cada ação segue em fonte única.
            </li>
            <li>
              <span className="selo-icone" aria-hidden="true">
                –
              </span>{' '}
              <strong>fonte única, sem conferência</strong>: Orçamento, órgão e Câmara vêm de uma fonte só. O valor
              aparece com este rótulo, porque não há com o que comparar. Na educação, é o caso de INEP, SIOPE e MEC.
            </li>
            <li>
              <strong>aguardando TCE</strong>: mês que o Tribunal ainda não recebeu. É pendência de remessa, e o valor
              entra no conferido quando a remessa chegar.
            </li>
          </ul>
          <p>
            Igualdade entre as fontes não é auditoria nem homologação contábil: mostra que as duas publicam o mesmo
            número. O que difere não some: fica em <a href="#discrepancias">Discrepâncias</a>, separado por tipo, com o
            valor de cada fonte e a situação do caso. Cada caso diz se foi conferido à mão no portal, com a data, se foi
            conferido só em parte, ou se é apenas cálculo, e aí o tipo é o mais provável. {FRASE_DA_DIFERENCA}
          </p>

          <h2>Educação: de onde vêm os dados</h2>
          <p>
            O caderno de Educação compara Orleans com Santa Catarina e o Brasil, e cada bloco traz o próprio selo, a
            fonte e o ano. Cada fonte cobre uma parte:
          </p>
          <ul>
            <li>
              <strong>INEP</strong>: rendimento, transição, distorção idade-série, alunos por turma, horas-aula,
              formação, regularidade e esforço dos docentes, nível socioeconômico, alfabetização no 2º ano, as partes do
              IDEB, ENEM e ensino superior. Leva fonte única, porque não há outra fonte para comparar.
            </li>
            <li>
              <strong>IBGE</strong>: alfabetização, frequência à escola, instrução e local da escola, do Censo; a série
              do IDEB, matrículas, docentes e escolas. O IBGE republica o INEP nos dados escolares, e isso não conta
              como conferência: leva fonte única.
            </li>
            <li>
              <strong>SIOPE</strong>: índice de 25%, Fundeb na remuneração, investimento por aluno e remuneração
              declarada dos profissionais, com os relatórios de 2020 em diante. Leva fonte única, e os relatórios de
              2012 a 2019 ainda não entraram.
            </li>
            <li>
              <strong>SICONFI</strong>: o RREO Anexo 14, comparado com o SIOPE no índice de 25% e no Fundeb, e a DCA,
              com a função 12, que é o gasto com educação. Nos índices, igualdade do percentual não confere: o SIOPE
              segue em fonte única, e o ano em que o valor difere traz um aviso e vai para{' '}
              <a href="#discrepancias">Discrepâncias</a>. O gasto leva “conferido com a Betha” onde fecha, e fonte única
              nos anos sem coleta da Betha.
            </li>
            <li>
              <strong>MEC</strong>: o Retrato da Educação Infantil, sobre a procura por creche, sempre com “a Prefeitura
              informou ao MEC”. Leva fonte única.
            </li>
            <li>
              <strong>Repasses</strong>: os repasses para a educação vêm da receita, e levam “conferido com o TCE-SC”. A
              rubrica fora do conferido não sai como número.
            </li>
          </ul>

          <h2>Educação: o que é rede</h2>
          <p>
            Rede é quem mantém a escola: a municipal é da Prefeitura, a estadual, do Estado, a federal, da União, e a
            privada não é do governo. A pública soma municipal, estadual e federal, e “todas” junta a pública e a
            privada. O nível socioeconômico é a exceção: ali, a pública é só estadual e municipal.
          </p>
          <p>
            O caderno abre na rede pública e compara rede com rede, porque a média geral muda com o peso de cada rede em
            cada lugar. O que a fonte não abre por rede, como o Censo, vale para todas.
          </p>

          <h2>Educação: como termina o ano</h2>
          <ul>
            <li>
              <strong>Aprovação</strong>: o aluno termina o ano e passa para a série seguinte.
            </li>
            <li>
              <strong>Reprovação</strong>: o aluno termina o ano, mas não passa.
            </li>
            <li>
              <strong>Abandono</strong>: o aluno sai da escola durante o ano.
            </li>
            <li>
              <strong>Evasão</strong>: o aluno não se matricula no ano seguinte.
            </li>
          </ul>
          <p>
            Aprovação, reprovação e abandono são do mesmo ano e somam perto de 100%. A evasão vem de outra pesquisa do
            INEP, a de transição, cujo dado mais recente é 2021–2022: é de outro período e não se soma às outras três.
            Numa cidade pequena, poucos alunos mudam muito a taxa, e um ano só não prova tendência.
          </p>

          <h2>Educação: IDEB</h2>
          <p>
            O IDEB junta a nota da prova e a aprovação, numa escala de 0 a 10, e sai a cada dois anos. A tabela da
            página separa as duas partes. Ano sem dado na série é lacuna, nunca zero, e “o melhor da série” só aparece
            quando é verdade na rede escolhida.
          </p>

          <h2>Educação: meta nacional e dado de Orleans</h2>
          <p>
            A linha de meta vem do Plano Nacional de Educação (
            <a href={LEI_DO_PNE} target="_blank" rel="noreferrer">
              Lei 15.388/2026
            </a>
            ). A meta é nacional, e o dado de frequência é do Censo 2022, anterior à lei.
          </p>
          <ul>
            <li>
              De 0 a 3 anos: atender toda a demanda manifesta por creche e, em nível nacional, ao menos 60% das
              crianças, até o fim da vigência.
            </li>
            <li>De 4 e 5 anos: universalizar a pré-escola até o 2º ano de vigência.</li>
            <li>
              De 6 a 17 anos: universalizar o acesso à escola até o 3º ano de vigência. É uma meta só, e a linha aparece
              nas faixas de 6 a 14 e de 15 a 17.
            </li>
            <li>De 18 a 24 anos, não há linha de meta.</li>
          </ul>

          <h2>Educação: declarado e medido</h2>
          <p>
            <strong>Medido</strong> é o que sai de censo, prova ou levantamento nacional do IBGE e do INEP.{' '}
            <strong>Declarado</strong> é o que a própria Prefeitura informa, sem contagem de fora: a resposta ao Retrato
            do MEC e a remuneração no SIOPE.
          </p>
          <p>
            Por isso, “não há demanda” por creche sempre vem com “a Prefeitura informou ao MEC”, e a remuneração diz
            “entre os profissionais declarados”. A quantidade de crianças na fila não tem número público: é sem dado,
            nunca zero.
          </p>

          <h2>Educação: o que não é publicado</h2>
          <ul>
            <li>Nenhum número por escola.</li>
            <li>Contagem abaixo de 5 pessoas sai como “menos de 5”, e não como o número.</li>
            <li>Mediana com menos de 10 pessoas fica sem valor.</li>
            <li>Cor ou raça e deficiência de Orleans não aparecem: os grupos são pequenos.</li>
            <li>
              Média do ENEM de rede com menos de 2 escolas não aparece, porque seria a nota de uma escola, nem o total
              que permitiria deduzi-la.
            </li>
            <li>Nome, CPF, número de inscrição e valor individual nunca entram no banco.</li>
          </ul>

          <h2>Como a coleta é conferida</h2>
          <ul>
            <li>A coleta pagina até alcançar o total de registros informado pela própria consulta.</li>
            <li>IDs repetidos ou mudança no total durante a coleta invalidam a cópia.</li>
            <li>
              A soma dos campos, em centavos, precisa coincidir com o <em>totalizador</em> da própria consulta. Só então
              os dados são publicados.
            </li>
            <li>
              “Conciliado com o totalizador” confirma a integridade da extração, não a contabilidade consolidada do
              município.
            </li>
          </ul>

          <h2>Limitações conhecidas</h2>
          <ul>
            <li>
              A Câmara Municipal não faz parte da seleção Betha; seus valores vêm do TCE-SC, com o rótulo de fonte
              única, e não somam com as entidades.
            </li>
            <li>
              O valor da consulta 57140 é o valor original dos empenhos, sem anulações. A despesa orçamentária líquida
              vem da consulta 57170, e liquidado e pago da lista de empenhos vêm do TCE-SC.
            </li>
            <li>
              O mês das receitas é inferido do sufixo do ID do registro. A comparação mês a mês com o TCE-SC confirma
              essa leitura.
            </li>
            <li>
              As entidades são identificadas pelo código no ID dos registros. O vínculo com as unidades do TCE-SC foi
              confirmado pela igualdade da despesa em 2025.
            </li>
            <li>
              Alguns nomes de órgão chegam do portal sem acentos (“SERVIO”, “GUA”). O site junta essas grafias com a
              versão correta antes de somar.
            </li>
            <li>
              O portal não informa CPF nem CNPJ dos credores, então não é possível separar pessoas físicas de empresas.
            </li>
            <li>
              A comparação com o TCE-SC está em <a href="#discrepancias">Discrepâncias</a>. O TCE recebe os dados com
              cerca de um mês de atraso: no ano em curso, o painel vai até o último mês recebido.
            </li>
          </ul>
        </article>

        <aside className="secao estreita com-fio como-ler">
          <h2 className="secao-titulo italico" style={{ border: 0, padding: 0 }}>
            Documentação
          </h2>
          <p>
            <a href={`${REPO}/METODOLOGIA.md`}>Metodologia completa</a>
          </p>
          <p>
            <a href={`${REPO}/FONTES_DE_DADOS.md`}>Fontes de dados</a>
          </p>
          <p>
            <a href={`${REPO}/CONFERENCIA_BETHA_TCE.md`}>Conferência Betha × TCE-SC</a>
          </p>
          <p>
            <a href={`${REPO}/DICIONARIO_DE_DADOS.md`}>Dicionário de dados</a>
          </p>
          <p>
            <a href={`${REPO}/ESPECIFICACAO_TECNICA.md`}>Especificação técnica</a>
          </p>
          <p className="nota-serif com-fio">
            Encontrou algo estranho? O código é aberto: abra uma issue no repositório.
          </p>
        </aside>
      </div>
    </>
  );
}
