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
            Os dados vêm do Portal da Transparência de Orleans. Antes de aparecer no site, cada coleta é somada
            centavo por centavo e comparada com o total que o próprio portal informa.
          </p>
        </div>
      </div>

      <div className="colunas">
        <article className="secao larga texto-corrido">
          <h2 style={{ marginTop: 0 }}>De onde vêm os dados</h2>
          <p>
            Os valores são coletados do <strong>Portal da Transparência Betha</strong> de Orleans, nas consultas{' '}
            <code>57153</code> (Receitas Orçamentárias) e <code>57140</code> (Execução Detalhada de Despesas). O site lê
            cópias já validadas; não consulta o portal a cada acesso.
          </p>
          <p>
            Os valores por morador usam a população do IBGE (Censo 2022 e estimativas anuais). Os textos em linguagem
            simples, como “repasses da União e do Estado”, agrupam os códigos oficiais de receita pelos dois primeiros
            dígitos.
          </p>

          <h2>Como os dados são validados</h2>
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
              A Câmara Municipal não faz parte da seleção Betha; seus valores vêm do TCE-SC, na página{' '}
              <a href="#conferencia">Conferência</a>.
            </li>
            <li>
              O valor da consulta 57140 é o valor original dos empenhos, sem anulações. A despesa orçamentária líquida
              (consulta 57170) é usada na conferência com o TCE-SC.
            </li>
            <li>
              O mês das receitas é inferido do sufixo do ID do registro. A comparação mês a mês com o TCE-SC confirma essa
              leitura.
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
              A comparação com o TCE-SC está na página <a href="#conferencia">Conferência</a>. O TCE recebe os dados com
              cerca de um mês de atraso. Diferenças entre fontes podem decorrer de critério, classificação ou atualização
              e não indicam, por si, erro ou irregularidade.
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
