import { useApi } from '../api.js';
import { BarrasMensais, Estado, Filtros, Fonte, ListaPontos, Mi, Numero, Numeros } from '../components.jsx';
import { data, decimal, emMilhoes, MESES, MESES_LONGOS, milhoes, nomeProprio, numero, pct, porExtenso } from '../format.js';
import { Selo, seloDespesa, seloReceita, useConferencia } from '../selos.jsx';
import { GLOSSARIO, ORIGEM_CIDADAO, ORIGENS_DE_FORA, populacao, sujeito } from '../referencias.js';

const qs = (ano, entidade) => new URLSearchParams({ ano, entidade }).toString();
const N = Number;

export default function VisaoGeral({ ano, entidade, filtros }) {
  const rec = useApi(`/api/receitas?${qs(ano, entidade)}`);
  const emp = useApi(`/api/despesas/empenhos/resumo?${qs(ano, entidade)}`);
  const desp = useApi(`/api/despesas/resumo?${qs(ano, entidade)}`);
  const conf = useConferencia(ano);
  const r = rec.dados;
  const d = emp.dados;
  const o = desp.dados;
  const pop = populacao(ano);

  return (
    <>
      <Filtros {...filtros} />
      <Estado carregando={rec.carregando || emp.carregando || desp.carregando} erro={rec.erro || emp.erro || desp.erro} />
      {r && d && o && (
        <Conteudo ano={ano} entidade={entidade} r={r} d={d} o={o} pop={pop} entidades={filtros.entidades} conf={conf} />
      )}
    </>
  );
}

// `o`: despesa orçamentária (57170), já descontadas as anulações: os totais oficiais.
// `d`: empenhos individuais (57140), pelo valor original: só para as divisões
// por órgão e por mês, que a 57170 não tem.
function Conteudo({ ano, entidade, r, d, o, pop, entidades, conf }) {
  const arrecadado = N(r.totais.arrecadadoNoMes);
  const previsto = N(r.totais.orcadoAtualizado);
  const empenhado = N(o.totais.empenhado);
  const pago = N(o.totais.pago ?? 0);
  const original = N(d.totais.empenhado);
  const camara = o.camara;
  const comCamara = camara ? empenhado + N(camara.empenhado) : null;
  const quem = sujeito(entidade, entidades);
  const anoEncerrado = ano < new Date().getFullYear();

  const origens = r.porOrigem.filter((o) => N(o.arrecadadoNoMes) > 0);
  const deFora = origens.filter((o) => ORIGENS_DE_FORA.has(o.chave)).reduce((s, o) => s + N(o.arrecadadoNoMes), 0);
  // Empréstimos (21, 23) não são arrecadação da cidade nem repasse.
  const emprestimos = r.porOrigem
    .filter((o) => o.chave === '21' || o.chave === '23')
    .reduce((s, o) => s + N(o.arrecadadoNoMes), 0);
  const propria = arrecadado - deFora - emprestimos;
  const principalOrigem = origens[0] && (ORIGEM_CIDADAO[origens[0].chave] ?? origens[0].descricao);
  const [org1, org2] = d.porOrgao;

  // Meses: arrecadado (receitas) e empenhado (empenhos), cada um da sua consulta.
  const meses = MESES.map((rotulo, i) => ({
    rotulo,
    nome: MESES_LONGOS[i],
    a: N(r.porMes.find((m) => m.chave === i + 1)?.arrecadadoNoMes ?? 0),
    b: N(d.porMes.find((m) => m.chave === i + 1)?.empenhado ?? 0),
  }));
  const pico = meses.reduce((m, x, i) => (x.b > meses[m].b ? i : m), 0);
  const anotacao = meses[pico].b > 0 && {
    texto: `${nomeProprio(meses[pico].nome)}: R$ ${milhoes(meses[pico].b)} mi empenhados, o maior valor do ano.${
      pico === 0 ? ' Contratos do ano inteiro costumam ser empenhados logo no início.' : ''
    }`,
    posicao: pico < 6 ? { left: `${((pico + 1) / 12) * 100}%`, top: 4 } : { left: '4%', top: 4 },
  };

  const outros = d.porOrgao.slice(8);
  const cada100 = [
    ...d.porOrgao.slice(0, 8).map((x) => ({ nome: nomeProprio(x.nome), valor: N(x.empenhado) })),
    ...(outros.length
      ? [{ nome: `Outros ${outros.length} órgãos`, valor: outros.reduce((s, x) => s + N(x.empenhado), 0), outro: true }]
      : []),
  ];

  return (
    <>
      <div className="abertura">
        <h1 className="manchete">
          Em {ano}, {quem} arrecadou <em>{porExtenso(arrecadado)}</em> e empenhou <em>{porExtenso(empenhado)}</em> em
          despesas.
        </h1>
        <div className="abertura-lado">
          <p className="capitular">
            {principalOrigem && <>O dinheiro veio principalmente de {principalOrigem.charAt(0).toLocaleLowerCase('pt-BR') + principalOrigem.slice(1)}. </>}
            {org1 && (
              <>
                {org2 ? (
                  <>
                    Quem mais empenhou foram {nomeProprio(org1.nome)} e {nomeProprio(org2.nome)}.{' '}
                  </>
                ) : (
                  <>Quem mais empenhou foi {nomeProprio(org1.nome)}. </>
                )}
              </>
            )}
            Do que foi empenhado, {pct(pago, empenhado)} já estava pago{anoEncerrado ? ' no fim do ano' : ' até agora'}.
            {camara && (
              <>
                {' '}
                Com a Câmara Municipal ({porExtenso(N(camara.empenhado))}, dados do TCE-SC
                {anoEncerrado ? '' : ` até ${data(camara.ultimoEmpenho)}`}), o município empenhou {porExtenso(comCamara)}.
              </>
            )}
          </p>
          <a href="#metodologia" className="botao-link">
            Como estes dados são feitos →
          </a>
        </div>
      </div>

      <Numeros rotulo="Totais do ano">
        <Numero
          rotulo="Arrecadado"
          detalhe={previsto > 0 ? `${pct(arrecadado, previsto)} dos ${emMilhoes(previsto)} previstos` : 'sem previsão'}
          barra={previsto > 0 ? (arrecadado / previsto) * 100 : undefined}
          selo={<Selo selo={seloReceita(conf, entidade)} />}
        >
          <Mi valor={arrecadado} />
        </Numero>
        <Numero
          rotulo="Empenhado"
          detalhe={`já descontadas as anulações · ${numero(d.totais.quantidade)} empenhos, ${numero(d.totais.credores)} credores`}
          selo={<Selo selo={seloDespesa(conf, entidade)} />}
        >
          <Mi valor={empenhado} />
        </Numero>
        <Numero rotulo="Pago" detalhe={`${pct(pago, empenhado)} do empenhado`} barra={(pago / empenhado) * 100} vermelho>
          <Mi valor={pago} />
        </Numero>
        <Numero
          rotulo="Arrecadado aqui, por morador"
          detalhe={`impostos, taxas e tarifas da cidade ÷ ${numero(pop.pessoas)} moradores (${pop.fonte}). Com os repasses, R$ ${numero(Math.round(arrecadado / pop.pessoas))}`}
        >
          R$ {numero(Math.round(propria / pop.pessoas))}
        </Numero>
      </Numeros>

      <div className="colunas">
        <section className="secao larga">
          <div className="secao-cab">
            <h2 className="secao-titulo">Mês a mês</h2>
            <span className="legenda">
              <span>
                <span className="amostra" aria-hidden="true" />
                Arrecadado
              </span>
              <span>
                <span className="amostra vermelho" aria-hidden="true" />
                Empenhado
              </span>
              <span>R$ milhões · empenhos pelo valor original</span>
            </span>
          </div>
          <BarrasMensais
            meses={meses}
            series={['Arrecadado', 'Empenhado']}
            descricao={`Barras mensais de arrecadado e empenhado em ${ano}`}
            anotacao={anotacao}
          />
        </section>

        <section className="secao estreita">
          <h2 className="secao-titulo">De onde vem</h2>
          <ListaPontos
            itens={origens.map((o) => ({
              chave: o.chave,
              nome: ORIGEM_CIDADAO[o.chave] ?? o.descricao,
              valor: o.arrecadadoNoMes,
              dica: `${o.descricao}: ${emMilhoes(o.arrecadadoNoMes)}`,
            }))}
          />
          {deFora > 0 && (
            <p className="nota-serif com-fio">
              {pct(deFora, arrecadado)} do que entrou veio de fora: repasses da União e do Estado.
            </p>
          )}
          <a href="#receitas" className="botao-link">
            Todas as receitas →
          </a>
        </section>
      </div>

      <section className="secao dupla">
        <div className="secao-cab">
          <h2 className="secao-titulo">Para onde vai cada R$ 100</h2>
          <span className="legenda-secao">
            Valor original dos empenhos por órgão · e quanto isso dá por morador no ano
          </span>
        </div>
        <ul className="cada-100">
          {cada100.map((o) => (
            <li key={o.nome}>
              <span className={`serif${o.outro ? ' apagado' : ''}`}>
                <span style={{ fontSize: '0.55em' }}>R$ </span>
                {decimal((o.valor / original) * 100)}
              </span>
              <span>{o.nome}</span>
              <div className="trilho" aria-hidden="true">
                <span
                  className={o.outro ? '' : 'vermelho'}
                  style={{ width: `${(o.valor / cada100[0].valor) * 100}%`, background: o.outro ? 'var(--pontilhado)' : undefined }}
                />
              </div>
              <span className="lp-extra">
                {emMilhoes(o.valor)} · R$ {numero(Math.round(o.valor / pop.pessoas))} por morador
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="colunas dupla">
        <section className="secao estreita">
          <h2 className="secao-titulo">Quem gasta</h2>
          <ListaPontos
            vermelho
            itens={[
              ...o.porEntidade.map((e) => {
                const qtd = d.porEntidade.find((x) => x.chave === e.chave)?.quantidade;
                return {
                  chave: e.chave,
                  nome: e.entidade?.nome ?? `Entidade ${e.chave}`,
                  valor: e.empenhado,
                  selecionado: e.chave === entidade,
                  extra: qtd ? `${numero(qtd)} empenhos` : undefined,
                  dica: `${e.entidade?.nome}: ${emMilhoes(e.empenhado)} empenhados, já descontadas as anulações`,
                };
              }),
              ...(camara
                ? [
                    {
                      chave: 'camara',
                      nome: camara.nome,
                      valor: camara.empenhado,
                      extra: `${numero(camara.quantidade)} empenhos · fonte TCE-SC${anoEncerrado ? '' : `, até ${data(camara.ultimoEmpenho)}`}`,
                      dica: `${camara.nome}: ${emMilhoes(camara.empenhado)} (TCE-SC; não está no portal Betha)`,
                    },
                  ]
                : []),
            ]}
          />
          <a href="#despesas" className="botao-link">
            Todas as despesas →
          </a>
        </section>

        <section className="secao larga">
          <h2 className="secao-titulo">Pequeno glossário</h2>
          <dl className="glossario">
            {GLOSSARIO.map(([termo, def]) => (
              <div key={termo}>
                <dt>{termo}</dt>
                <dd>{def}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <p className="nota" style={{ marginTop: 32 }}>
        Abrangência: Prefeitura, Fundo Municipal de Saúde, SAMAE e Fundação Ambiental, como publicados no portal Betha.
        Empenhado e pago são a despesa orçamentária (consulta 57170), já descontadas as anulações. As divisões por órgão
        e por mês usam o valor original de cada empenho (consulta 57140), sem os registros que a conferência aponta como
        repetidos. A Câmara Municipal não está no portal Betha: seus valores vêm do TCE-SC e aparecem à parte.
      </p>
      <Fonte meta={r.meta} />
      <Fonte meta={o.meta} />
      <Fonte meta={d.meta} />
    </>
  );
}
