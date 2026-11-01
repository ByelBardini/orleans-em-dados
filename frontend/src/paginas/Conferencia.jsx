import { useState } from 'react';
import { useApi } from '../api.js';
import { Estado, Filtros, Mi, Numero, Numeros } from '../components.jsx';
import { data, dataHora, MESES, MESES_LONGOS, moeda, numero, pct } from '../format.js';

const N = Number;
const RELATORIO = 'https://github.com/ByelBardini/orleans-em-dados/blob/main/docs/CONFERENCIA_BETHA_TCE.md';

// O foco desta página é o que não tem explicação. Divergências com causa provável,
// ou já conhecidas de outros exercícios, ficam em cinza; os totais (por entidade, mês e empenho) são neutros, porque sua
// diferença é só a soma das causas listadas acima deles.

// Diferença Betha − TCE dita por extenso: "R$ 1,00 a mais na Betha" / "a mais no TCE" / "igual".
const ladoMaior = (v) => (N(v) > 0 ? 'a mais na Betha' : 'a mais no TCE');

function Diferenca({ valor, neutro = false }) {
  if (valor === null || valor === undefined) return <span className="apagado">—</span>;
  if (N(valor) === 0) return <span className="apagado">igual</span>;
  return (
    <span className={neutro ? '' : 'vermelho'}>
      {moeda(Math.abs(N(valor)))} <span className="diferenca-lado">{ladoMaior(valor)}</span>
    </span>
  );
}

// Valores grandes em milhões; abaixo de 1 milhão, em milhares.
function MilOuMi({ valor }) {
  if (Math.abs(N(valor)) >= 1e6) return <Mi valor={valor} />;
  return (
    <>
      {(N(valor) / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
      <small> mil</small>
    </>
  );
}

const SITUACOES = {
  igual: { texto: 'Igual', classe: '', amostra: '' },
  diverge: { texto: 'Diverge', classe: '', amostra: 'cinza' },
  soTce: { texto: 'Só no TCE', classe: 'sem', amostra: 'cinza' },
  aguardando: { texto: 'Aguardando TCE', classe: 'sem', amostra: 'cinza' },
};

function Situacao({ tipo }) {
  const s = SITUACOES[tipo];
  return (
    <span className={`situacao ${s.classe}`}>
      <span className={`amostra ${s.amostra}`} aria-hidden="true" />
      {s.texto}
    </span>
  );
}

const ONDE = { despesa: 'Despesa', receita: 'Receita', empenho: 'Empenhos' };
const descricaoCurta = (d) => (d ? d.replace(/\s*-\s*Principal$/i, '') : null);

export default function Conferencia({ ano, filtros }) {
  const { dados, carregando, erro } = useApi(`/api/conferencias?ano=${ano}`);
  return (
    <>
      {erro ? (
        <>
          <div className="abertura">
            <h1 className="manchete">
              Ainda não dá para conferir <em>{ano}</em>.
            </h1>
            <div className="abertura-lado">
              <p>
                A conferência precisa das coletas publicadas das duas fontes para o mesmo exercício. Rode{' '}
                <code>npm run coletar -- --ano {ano}</code> e <code>npm run coletar:tcesc -- --ano {ano}</code>.
              </p>
            </div>
          </div>
          <Filtros {...filtros} entidades={[]} />
        </>
      ) : (
        <Estado carregando={carregando} />
      )}
      {dados && <Conteudo ano={ano} filtros={filtros} dados={dados} />}
    </>
  );
}

// Agrupa os empenhos sem explicação por entidade e fonte: são dezenas de linhas com a mesma história.
function agruparItens(itens) {
  const grupos = [];
  for (const item of itens) {
    if (item.onde !== 'empenho') {
      grupos.push({ ...item, chave: `${item.onde}|${item.entidade}|${item.natureza ?? ''}` });
      continue;
    }
    const chave = `empenho|${item.entidade}|${item.fonte}`;
    let g = grupos.find((x) => x.chave === chave);
    if (!g) {
      g = { chave, onde: 'empenho', entidade: item.entidade, fonte: item.fonte, itens: [], betha: 0, tce: 0, diferenca: 0 };
      grupos.push(g);
    }
    g.itens.push(item);
    g.betha += N(item.betha ?? 0);
    g.tce += N(item.tce ?? 0);
    g.diferenca += N(item.diferenca);
  }
  return grupos;
}

function Conteudo({ ano, filtros, dados }) {
  const { resumo, parcial, limites, camara } = dados;
  const mesLimite = MESES_LONGOS[limites.mesReceita - 1];
  const quando = parcial ? `Até ${mesLimite} de ${ano}` : `Em ${ano}`;
  const semExplicacao = dados.semExplicacao;
  const valorSemExplicacao = semExplicacao.reduce((s, i) => s + Math.abs(N(i.diferenca ?? 0)), 0);
  const empenhosSemExplicacao = semExplicacao.filter((i) => i.onde === 'empenho').length;
  const conhecidas = resumo.comCausaProvavel + resumo.conhecidas;
  const tudoIgual = conhecidas === 0 && semExplicacao.length === 0;

  return (
    <>
      <div className="abertura">
        <h1 className="manchete">
          {semExplicacao.length > 0 ? (
            <>
              {quando}, <em>{numero(semExplicacao.length)} {semExplicacao.length === 1 ? 'diferença' : 'diferenças'}</em>{' '}
              entre Betha e TCE-SC ainda não {semExplicacao.length === 1 ? 'tem' : 'têm'} explicação
              {resumo.conhecidas > 0 && ' nem se repetem de outros anos'}.
            </>
          ) : tudoIgual ? (
            <>
              {quando}, Betha e TCE-SC mostram <em>os mesmos números</em>.
            </>
          ) : (
            <>
              {quando}, não há diferença <em>nova</em> entre Betha e TCE-SC: as que existem têm causa provável ou já
              se repetiam em outros anos.
            </>
          )}
        </h1>
        <div className="abertura-lado">
          <p className="capitular">
            O Portal da Transparência (Betha) é o que o município publica. O Farol do TCE-SC reúne o que o município
            envia ao Tribunal de Contas. As duas fontes deveriam coincidir. Primeiro vêm as diferenças que nenhum padrão
            nos números explica e que não vêm de outros anos; depois, as já conhecidas. Diferença entre fontes não é, por si, erro ou
            irregularidade.
          </p>
        </div>
      </div>

      <Filtros {...filtros} entidades={[]} />

      {parcial && (
        <p className="aviso">
          O TCE-SC recebe os dados com atraso: por enquanto, tem receitas até <strong>{mesLimite}</strong> e empenhos
          até <strong>{data(limites.dataEmpenho)}</strong>. As comparações abaixo se limitam a esse período; o que veio
          depois ainda não foi conferido e não conta como diferença.
        </p>
      )}

      <Numeros rotulo="Resumo da conferência">
        <Numero
          rotulo="Sem explicação"
          detalhe={semExplicacao.length ? `${moeda(valorSemExplicacao)} em diferenças` : 'nenhuma diferença em aberto'}
          vermelho={semExplicacao.length > 0}
        >
          {numero(semExplicacao.length)}
        </Numero>
        <Numero
          rotulo="Já conhecidas"
          detalhe={`${numero(resumo.comCausaProvavel)} com causa provável${
            resumo.conhecidas
              ? ` · ${numero(resumo.conhecidas)} ${resumo.conhecidas === 1 ? 'recorrente' : 'recorrentes'}, sem causa confirmada`
              : ''
          }`}
        >
          {numero(conhecidas)}
        </Numero>
        <Numero
          rotulo="Rubricas de receita iguais"
          detalhe={`${resumo.naturezasIguais} de ${resumo.naturezasComparadas} (rubrica × entidade)`}
          barra={(resumo.naturezasIguais / resumo.naturezasComparadas) * 100}
        >
          {pct(resumo.naturezasIguais, resumo.naturezasComparadas, 0)}
        </Numero>
        <Numero
          rotulo="Empenhos casados"
          detalhe={`${numero(resumo.empenhosCasados)} de ${numero(resumo.empenhosBetha)} da Betha`}
          barra={(resumo.empenhosCasados / resumo.empenhosBetha) * 100}
          vermelho={empenhosSemExplicacao > 0}
        >
          {pct(resumo.empenhosCasados, resumo.empenhosBetha, 1)}
        </Numero>
      </Numeros>

      <SemExplicacao itens={semExplicacao} />

      <ComCausa dados={dados} />

      <section className="secao solta dupla">
        <div className="secao-cab">
          <h2 className="secao-titulo">Os totais, para conferir</h2>
          <span className="legenda">
            <span>A diferença de cada total é a soma das causas listadas acima</span>
          </span>
        </div>
      </section>
      <Despesa dados={dados} />
      <ReceitaEntidades dados={dados} />
      <Empenhos dados={dados} />

      <div className="colunas dupla">
        <ReceitaMeses dados={dados} />
        <aside className="secao media com-fio como-ler">
          <h2 className="secao-titulo italico" style={{ border: 0, padding: 0 }}>
            Câmara Municipal
          </h2>
          <p>
            A Câmara não está no portal Betha da Prefeitura. Os números dela vêm só do TCE-SC
            {camara?.empenhos > 0 &&
              ` (${moeda(camara.empenhado)} empenhados e ${moeda(camara.pago)} pagos em ${numero(camara.empenhos)} empenhos, dados até ${data(camara.ultimo)})`}{' '}
            e já fazem parte do total municipal do Tribunal: somar a Câmara ao total do TCE contaria duas vezes. Ela não
            tem receita própria: recebe repasses da Prefeitura, que não são lançados como receita orçamentária. Por isso
            não aparece na comparação de receitas.
          </p>
          <h2 className="secao-titulo italico com-fio" style={{ border: 0, padding: 0, marginTop: 12 }}>
            Como ler esta página
          </h2>
          <p>
            <strong>Sem explicação</strong> é a diferença que nenhum padrão nos números explica: é o que vale
            investigar. <strong>Causa provável</strong> é a diferença que segue um padrão (o mesmo valor lançado duas
            vezes, uma troca entre rubricas que se compensa, um empenho renumerado); não é explicação contábil.{' '}
            <strong>Conhecida e recorrente</strong> é a diferença sem causa confirmada que aparece, do mesmo lado, em
            outros exercícios: continua em aberto, mas não é novidade.
          </p>
          <p>
            <strong>Despesa</strong> compara a consulta 57170 da Betha (empenhado, liquidado e pago já descontadas as
            anulações). <strong>Empenhos</strong> compara a lista 57140, um a um, por entidade, número, data e valor
            original. <strong>Rubricas</strong> são comparadas pelos 8 primeiros dígitos do código da receita, o nível
            comum às duas fontes.{' '}
            <a href={RELATORIO} target="_blank" rel="noreferrer">
              Relatório completo da conferência
            </a>
            .
          </p>
        </aside>
      </div>

      <Coletas coletas={dados.coletas} />
    </>
  );
}

function SemExplicacao({ itens }) {
  const grupos = agruparItens(itens);
  return (
    <section className="secao solta">
      <div className="secao-cab">
        <h2 className="secao-titulo">O que ainda não tem explicação</h2>
        <span className="legenda">
          <span>Diferenças sem padrão que indique a causa</span>
        </span>
      </div>
      {grupos.length === 0 ? (
        <p className="nota-serif">
          Nenhuma. Toda diferença entre as fontes neste exercício tem causa provável ou se repete de outros anos,
          como listado abaixo.
        </p>
      ) : (
        <div className="tabela-rolagem">
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th scope="col">Onde</th>
                <th scope="col">O quê</th>
                <th scope="col" className="num">
                  Diferença
                </th>
                <th scope="col">O que se sabe</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.chave}>
                  <td>
                    <span className="situacao apagar">
                      <span className="amostra vermelho" aria-hidden="true" />
                      {ONDE[g.onde]}
                    </span>
                  </td>
                  <td style={{ maxWidth: 320 }}>
                    {g.onde === 'empenho' ? (
                      <>
                        <strong>
                          {numero(g.itens.length)} {g.itens.length === 1 ? 'empenho' : 'empenhos'} · {g.entidade}
                        </strong>
                        <div className="sub">{g.fonte === 'betha' ? 'só na Betha' : 'só no TCE'}</div>
                      </>
                    ) : (
                      <>
                        <strong>
                          {g.onde === 'receita' ? (
                            <span className="mono">{g.natureza}</span>
                          ) : (
                            g.titulo
                          )}{' '}
                          · {g.entidade}
                        </strong>
                        {g.onde === 'receita' && <div className="historico">{descricaoCurta(g.descricao) ?? 'sem descrição no TCE'}</div>}
                      </>
                    )}
                  </td>
                  <td className="num">
                    <Diferenca valor={g.diferenca} />
                    {g.onde !== 'empenho' && (
                      <div className="sub">
                        Betha {moeda(g.betha)} · TCE {moeda(g.tce)}
                      </div>
                    )}
                  </td>
                  <td style={{ maxWidth: 400 }}>
                    {g.onde === 'empenho' ? (
                      <ListaEmpenhos itens={g.itens} />
                    ) : (
                      <div className="historico" style={{ WebkitLineClamp: 'unset', display: 'block' }}>
                        {g.nota}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ListaEmpenhos({ itens }) {
  return (
    <details className="causa-detalhe">
      <summary>{itens.length === 1 ? itens[0].nota : `Ver os ${numero(itens.length)} empenhos`}</summary>
      <ul>
        {itens.map((e) => (
          <li key={`${e.fonte}|${e.id}`}>
            <span className="mono">nº {e.numero}</span> · {data(e.data)} · {moeda(e.valor)}
            {itens.length > 1 && <span className="apagado"> — {e.nota}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

// Divergências com causa provável ou recorrentes: em cinza, empenhos agrupados por causa.
// As recorrentes vêm primeiro: continuam sem causa confirmada.
function ComCausa({ dados }) {
  const rubricas = dados.receitaPorNatureza
    .filter((r) => r.explicada || r.conhecida)
    .sort((a, b) => Number(Boolean(b.conhecida)) - Number(Boolean(a.conhecida)));
  const empenhos = dados.empenhosSemPar.filter((e) => e.explicada);
  const grupos = [];
  for (const e of empenhos) {
    const chave = `${e.entidade}|${e.causa}`;
    let g = grupos.find((x) => x.chave === chave);
    if (!g) grupos.push((g = { chave, entidade: e.entidade, causa: e.causa, fonte: e.fonte, itens: [], valor: 0 }));
    g.itens.push(e);
    g.valor += N(e.valor);
  }
  if (!rubricas.length && !grupos.length) return null;

  return (
    <section className="secao solta com-causa">
      <div className="secao-cab">
        <h2 className="secao-titulo">Já conhecidas</h2>
        <span className="legenda">
          <span>Com causa provável ou repetidas de outros anos</span>
        </span>
      </div>
      <ul className="lista-causas">
        {rubricas.map((r) => (
          <li key={`${r.entidade}|${r.natureza}`}>
            <span className="causa-rotulo">{r.causa}</span>
            <span>
              <strong>
                Rubrica <span className="mono">{r.natureza}</span> · {r.entidade}
              </strong>{' '}
              — <Diferenca valor={r.diferenca} neutro />. {r.nota}
            </span>
          </li>
        ))}
        {grupos.map((g) => (
          <li key={g.chave}>
            <span className="causa-rotulo">{g.causa}</span>
            <span>
              <strong>
                {numero(g.itens.length)} {g.itens.length === 1 ? 'empenho' : 'empenhos'} · {g.entidade}
              </strong>{' '}
              — {moeda(g.valor)} {g.fonte === 'betha' ? 'só na Betha' : 'só no TCE'}.{' '}
              {g.causa === 'Provável renumeração'
                ? 'O TCE tem os mesmos empenhos, com a mesma data e valor, sob outro número: os registros da Betha parecem versões antigas que ficaram no portal.'
                : 'Mesmo número, data e valor de outro empenho da própria Betha.'}{' '}
              Ficam fora das somas das outras páginas.
              <details className="causa-detalhe">
                <summary>Ver os empenhos</summary>
                <ul>
                  {g.itens.map((e) => (
                    <li key={e.id}>
                      <span className="mono">nº {e.numero}</span> · {data(e.data)} · {moeda(e.valor)}
                      {e.numeroNaOutra && <span className="apagado"> — no TCE é o nº {e.numeroNaOutra}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Despesa({ dados }) {
  const linhas = dados.despesaPorEntidade;
  const soma = (k) => linhas.reduce((s, r) => s + Math.round(N(r[k] ?? 0) * 100), 0) / 100;
  return (
    <section className="secao solta">
      <div className="secao-cab">
        <h2 className="secao-titulo" style={{ fontSize: 28 }}>
          Despesa por entidade
        </h2>
        <span className="legenda">
          <span>Betha 57170 × TCE-SC · empenhado, liquidado e pago</span>
        </span>
      </div>
      <div className="tabela-rolagem">
        <table style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th scope="col">Entidade</th>
              <th scope="col" className="num">
                Empenhado Betha
              </th>
              <th scope="col" className="num">
                Empenhado TCE
              </th>
              <th scope="col" className="num">
                Dif. empenhado
              </th>
              <th scope="col" className="num">
                Dif. liquidado
              </th>
              <th scope="col" className="num">
                Dif. pago
              </th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((r) => {
              const so = r.bethaEmpenhado === null;
              const tipo = so
                ? 'soTce'
                : !r.comparavel
                  ? 'aguardando'
                  : r.difEmpenhado === 0 && r.difLiquidado === 0 && r.difPago === 0
                    ? 'igual'
                    : 'diverge';
              return (
                <tr key={r.sigla}>
                  <td>
                    <strong>{r.sigla}</strong>
                    <div className="sub">{r.poder}</div>
                  </td>
                  <td className="num">{so ? <span className="apagado">não publica</span> : moeda(r.bethaEmpenhado)}</td>
                  <td className="num">{moeda(r.tceEmpenhado)}</td>
                  <td className="num">{r.comparavel ? <Diferenca valor={r.difEmpenhado} neutro /> : '—'}</td>
                  <td className="num">{r.comparavel ? <Diferenca valor={r.difLiquidado} neutro /> : '—'}</td>
                  <td className="num">{r.comparavel ? <Diferenca valor={r.difPago} neutro /> : '—'}</td>
                  <td>
                    <Situacao tipo={tipo} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="num">{moeda(soma('bethaEmpenhado'))}</td>
              <td className="num">{moeda(soma('tceEmpenhado'))}</td>
              <td colSpan={4} className="sub">
                O total do TCE inclui a Câmara; o da Betha, não.
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function ReceitaEntidades({ dados }) {
  return (
    <section className="secao solta">
      <div className="secao-cab">
        <h2 className="secao-titulo" style={{ fontSize: 28 }}>
          Receita arrecadada por entidade
        </h2>
        <span className="legenda">
          <span>Betha 57153 × TCE-SC · {dados.parcial ? 'até o último mês recebido pelo TCE' : 'ano inteiro'}</span>
        </span>
      </div>
      <div className="tabela-rolagem">
        <table style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th scope="col">Entidade</th>
              <th scope="col" className="num">
                Betha
              </th>
              <th scope="col" className="num">
                TCE
              </th>
              <th scope="col" className="num">
                Diferença
              </th>
            </tr>
          </thead>
          <tbody>
            {dados.receitaPorEntidade.map((r) => (
              <tr key={r.sigla}>
                <td>
                  <strong>{r.sigla}</strong>
                </td>
                <td className="num">{moeda(r.betha)}</td>
                <td className="num">{moeda(r.tce)}</td>
                <td className="num">
                  <Diferenca valor={r.diferenca} neutro />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Empenhos({ dados }) {
  return (
    <section className="secao solta">
      <div className="secao-cab">
        <h2 className="secao-titulo" style={{ fontSize: 28 }}>
          Empenhos, um a um
        </h2>
        <span className="legenda">
          <span>Betha 57140 × TCE-SC · entidade + número + data + valor original</span>
        </span>
      </div>
      <div className="tabela-rolagem">
        <table style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th scope="col">Entidade</th>
              <th scope="col" className="num">
                Na Betha
              </th>
              <th scope="col" className="num">
                No TCE
              </th>
              <th scope="col" className="num">
                Casados
              </th>
              <th scope="col" className="num">
                Só na Betha
              </th>
              <th scope="col" className="num">
                Só no TCE
              </th>
            </tr>
          </thead>
          <tbody>
            {dados.empenhos.map((e) => (
              <tr key={e.entidade}>
                <td>
                  <strong>{e.entidade}</strong>
                </td>
                <td className="num">{numero(e.betha)}</td>
                <td className="num">{numero(e.tce)}</td>
                <td className="num">{numero(e.casados)}</td>
                <td className="num">
                  {numero(e.soBetha)}
                  {e.soBetha > 0 && <div className="sub">{moeda(e.valorSoBetha)}</div>}
                </td>
                <td className="num">
                  {numero(e.soTce)}
                  {e.soTce > 0 && <div className="sub">{moeda(e.valorSoTce)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Cada mês com as rubricas que formam a sua diferença, em letra pequena.
function ReceitaMeses({ dados }) {
  const meses = dados.receitaPorMes.filter((m) => m.mes);
  const max = Math.max(...meses.map((m) => Math.abs(N(m.diferenca ?? 0))), 1);
  const mil = (v) => `${(Math.abs(N(v)) / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  const descricao = (p) =>
    descricaoCurta(dados.receitaPorNatureza.find((r) => r.natureza === p.natureza && r.entidade === p.entidade)?.descricao);
  return (
    <section className="secao media">
      <h2 className="secao-titulo">Receita mês a mês</h2>
      <p className="legenda-secao">Quanto uma fonte registra a mais que a outra, e de quais rubricas vem</p>
      <ul className="lista-pontos">
        {meses.map((m) => (
          <li key={m.mes}>
            <div className="lp-linha">
              <span className="lp-cod">{MESES[m.mes - 1]}</span>
              <span className="lp-nome apagado">{m.diferenca === null ? 'TCE ainda não recebeu' : ''}</span>
              <span className="lp-pontos" aria-hidden="true" />
              <span className="lp-valor">
                <Diferenca valor={m.diferenca} neutro />
              </span>
            </div>
            {m.diferenca !== null && N(m.diferenca) !== 0 && (
              <>
                <div className="trilho" aria-hidden="true">
                  <span style={{ width: `${(Math.abs(N(m.diferenca)) / max) * 100}%`, background: 'var(--regua)' }} />
                </div>
                <span className="parcelas-mes">
                  {m.parcelas.slice(0, 4).map((p, i) => (
                    <span key={`${p.entidade}|${p.natureza}`} title={descricao(p) ?? undefined}>
                      {i > 0 && ' · '}
                      {p.entidade} {p.natureza} ({mil(p.diferenca)})
                    </span>
                  ))}
                  {m.parcelas.length > 4 && ` · e mais ${m.parcelas.length - 4}`}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const NOME_FONTE = { betha: 'Betha', tcesc: 'TCE-SC' };

function Coletas({ coletas }) {
  const recarga = coletas.map((c) => c.recargaTce).filter(Boolean).sort().at(-1);
  return (
    <details className="fonte">
      <summary>
        Coletas comparadas · {coletas.length} consultas{recarga ? ` · painéis do TCE atualizados em ${dataHora(recarga)}` : ''}
      </summary>
      <dl>
        {coletas.map((c) => (
          <div key={c.chave} className="fonte-conferencia">
            <dt>{NOME_FONTE[c.fonte] ?? c.fonte}</dt>
            <dd>
              {c.nome} · coleta {c.coleta} · {numero(c.linhas)} linhas · coletado em {dataHora(c.coletadoEm)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
