const REPO = 'https://github.com/ByelBardini/orleans-em-dados/blob/main/docs';

export default function Metodologia() {
  return (
    <article className="texto">
      <h2>Fontes e metodologia</h2>

      <h3>De onde vêm os dados</h3>
      <p>
        Os valores exibidos são coletados do <strong>Portal da Transparência Betha</strong> de Orleans, nas consultas{' '}
        <code>57153</code> (Receitas Orçamentárias) e <code>57140</code> (Execução Detalhada de Despesas). O
        dashboard lê snapshots já validados; não consulta o portal a cada acesso.
      </p>

      <h3>Como os dados são validados</h3>
      <ul>
        <li>A coleta pagina até alcançar o total de registros informado pela própria consulta.</li>
        <li>IDs repetidos ou mudança no total durante a coleta invalidam o snapshot.</li>
        <li>
          A soma dos campos, em centavos, precisa coincidir com o <em>totalizador</em> da própria consulta. Só então o
          snapshot é publicado.
        </li>
        <li>
          “Conciliado com o totalizador” confirma a integridade da extração, não a contabilidade consolidada do
          município.
        </li>
      </ul>

      <h3>Limitações conhecidas</h3>
      <ul>
        <li>A Câmara Municipal não faz parte da seleção Betha; seus valores virão do TCE-SC.</li>
        <li>
          O valor da consulta 57140 é o valor original dos empenhos, sem anulações. A despesa orçamentária
          (empenhado/liquidado/pago atualizado, consulta 57170) ainda não foi integrada.
        </li>
        <li>O mês das receitas é inferido do sufixo do ID do registro; a semântica ainda não foi confirmada.</li>
        <li>As entidades são identificadas pelo código no ID dos registros; o mapeamento foi inferido.</li>
        <li>
          A comparação com TCE-SC/SICONFI ainda não está no painel. Diferenças entre fontes podem decorrer de critério,
          abrangência ou atualização e não indicam, por si, erro ou irregularidade.
        </li>
      </ul>

      <p>
        Documentação completa: <a href={`${REPO}/METODOLOGIA.md`}>metodologia</a>,{' '}
        <a href={`${REPO}/FONTES_DE_DADOS.md`}>fontes de dados</a> e{' '}
        <a href={`${REPO}/ESPECIFICACAO_TECNICA.md`}>especificação técnica</a>.
      </p>
    </article>
  );
}
