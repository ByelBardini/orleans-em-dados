import { useApi } from '../api.js';
import { BarrasMensais, Estado, Filtros, Fonte, ListaPontos, Mi, Numero, Numeros } from '../components.jsx';
import { decimal, emMilhoes, MESES, MESES_LONGOS, milhoes, nomeProprio, numero, pct, porExtenso } from '../format.js';
import { GLOSSARIO, ORIGEM_CIDADAO, ORIGENS_DE_FORA, populacao, sujeito } from '../referencias.js';

const qs = (ano, entidade) => new URLSearchParams({ ano, entidade }).toString();
const N = Number;

export default function VisaoGeral({ ano, entidade, filtros }) {
  const rec = useApi(`/api/receitas?${qs(ano, entidade)}`);
  const emp = useApi(`/api/despesas/empenhos/resumo?${qs(ano, entidade)}`);
  const r = rec.dados;
  const d = emp.dados;
  const pop = populacao(ano);

  return (
    <>
      <Filtros {...filtros} />
      <Estado carregando={rec.carregando || emp.carregando} erro={rec.erro || emp.erro} />
      {r && d && <Conteudo ano={ano} entidade={entidade} r={r} d={d} pop={pop} entidades={filtros.entidades} />}
    </>
  );
}

function Conteudo({ ano, entidade, r, d, pop, entidades }) {
  const arrecadado = N(r.totais.arrecadadoNoMes);
  const previsto = N(r.totais.orcadoAtualizado);
  const empenhado = N(d.totais.empenhado);
  const pago = N(d.totais.pago ?? 0);
  const quem = sujeito(entidade, entidades);
  const anoEncerrado = ano < new Date().getFullYear();

  const origens = r.porOrigem.filter((o) => N(o.arrecadadoNoMes) > 0);
  const deFora = origens.filter((o) => ORIGENS_DE_FORA.has(o.chave)).reduce((s, o) => s + N(o.arrecadadoNoMes), 0);
  const principalOrigem = origens[0] && (ORIGEM_CIDADAO[origens[0].chave] ?? origens[0].descricao);
  const [o1, o2] = d.porOrgao;

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
    ...d.porOrgao.slice(0, 8).map((o) => ({ nome: nomeProprio(o.nome), valor: N(o.empenhado) })),
    ...(outros.length
      ? [{ nome: `Outros ${outros.length} órgãos`, valor: outros.reduce((s, o) => s + N(o.empenhado), 0), outro: true }]
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
            {o1 && (
              <>
                {o2 ? (
                  <>
                    Quem mais empenhou foram {nomeProprio(o1.nome)} e {nomeProprio(o2.nome)}.{' '}
                  </>
                ) : (
                  <>Quem mais empenhou foi {nomeProprio(o1.nome)}. </>
                )}
              </>
            )}
            Do que foi empenhado, {pct(pago, empenhado)} já estava pago{anoEncerrado ? ' no fim do ano' : ' até agora'}.
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
        >
          <Mi valor={arrecadado} />
        </Numero>
        <Numero
          rotulo="Empenhado"
          detalhe={`${numero(d.totais.quantidade)} empenhos, ${numero(d.totais.credores)} credores`}
        >
          <Mi valor={empenhado} />
        </Numero>
        <Numero rotulo="Pago" detalhe={`${pct(pago, empenhado)} do empenhado`} barra={(pago / empenhado) * 100} vermelho>
          <Mi valor={pago} />
        </Numero>
        <Numero rotulo="Por morador" detalhe={`arrecadado ÷ ${numero(pop.pessoas)} moradores (${pop.fonte})`}>
          R$ {numero(Math.round(arrecadado / pop.pessoas))}
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
              <span>R$ milhões</span>
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
          <span className="legenda-secao">Valor empenhado por órgão · e quanto isso dá por morador no ano</span>
        </div>
        <ul className="cada-100">
          {cada100.map((o) => (
            <li key={o.nome}>
              <span className={`serif${o.outro ? ' apagado' : ''}`}>
                <span style={{ fontSize: '0.55em' }}>R$ </span>
                {decimal((o.valor / empenhado) * 100)}
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
            itens={d.porEntidade.map((e) => ({
              chave: e.chave,
              nome: e.entidade?.nome ?? `Entidade ${e.chave}`,
              valor: e.empenhado,
              selecionado: e.chave === entidade,
              extra: `${numero(e.quantidade)} empenhos`,
              dica: `${e.entidade?.nome}: ${emMilhoes(e.empenhado)} em ${numero(e.quantidade)} empenhos`,
            }))}
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
        A Câmara Municipal não está incluída. O empenhado é o valor original de cada empenho, sem descontar anulações.
      </p>
      <Fonte meta={r.meta} />
      <Fonte meta={d.meta} />
    </>
  );
}
