import { FRASE_DA_DIFERENCA } from '../conferido';

const REPO = 'https://github.com/ByelBardini/orleans-em-dados/blob/main/docs';

export default function Metodologia() {
  return (
    <>
      <div className="abertura">
        <h1 className="manchete">
          Cada número aqui pode ser <em>conferido</em> na fonte original.
        </h1>
        <div className="abertura-lado">
          <p className="capitular">
            Os dados vêm do Portal da Transparência de Orleans e do Farol do TCE-SC. O número principal do painel é só a
            parte em que as duas fontes coincidem. O que difere fica listado na seção Discrepâncias.
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
            Os valores por morador usam a população do IBGE (Censo 2022 e estimativas anuais). Os textos em linguagem
            simples, como “repasses da União e do Estado”, agrupam os códigos oficiais de receita pelos dois primeiros
            dígitos.
          </p>

          <h2>O que aparece no painel</h2>
          <p>
            O número principal é o conferido: a parte que as fontes sustentam. Por isso, ele pode ficar abaixo de cada
            uma delas, e a página sempre mostra a conta: conferido + em discrepância = total da fonte. Cada número diz o
            nível da conferência:
          </p>
          <ul>
            <li>
              <strong>conferido com o TCE-SC</strong>: o valor que as duas fontes registram, ao centavo, por entidade,
              natureza e mês na receita, por entidade na despesa, e empenho a empenho na lista.
            </li>
            <li>
              <strong>conferido com a Betha até DD/MM</strong>: no ano em curso, a despesa vem do TCE-SC, só nos
              empenhos que têm par na Betha até a data do último dado que o Tribunal recebeu.
            </li>
            <li>
              <strong>fonte única, sem conferência</strong>: Orçamento, órgão e Câmara vêm de uma fonte só. O valor
              aparece com este rótulo, porque não há com o que comparar.
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
