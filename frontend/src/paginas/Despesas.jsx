import { useEffect, useRef, useState } from 'react';
import { useApi } from '../api.js';
import { BarraDividida, BarrasMensais, Estado, Filtros, Fonte, ListaPontos, Mi, Numero, Numeros } from '../components.jsx';
import { data, decimal, emMilhoes, MESES, MESES_LONGOS, moeda, nomeProprio, numero, pct } from '../format.js';
import { populacao } from '../referencias.js';
import { Selo, seloDespesa, seloEmpenho, useConferencia } from '../selos.jsx';

const POR_PAGINA = 25;
const N = Number;

function useDebounce(valor, ms = 300) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

const SITUACAO = {
  pago: { nome: 'Pago', classe: 'pago', amostra: '' },
  apagar: { nome: 'Falta pagar', classe: 'apagar', amostra: 'vermelho' },
  sem: { nome: 'Sem informação', classe: 'sem', amostra: 'listrada' },
};

const situacaoDe = (e) => (e.liquidado === null ? 'sem' : N(e.saldoAPagar) > 0 ? 'apagar' : 'pago');

export default function Despesas({ ano, entidade, filtros }) {
  const resumo = useApi(`/api/despesas/empenhos/resumo?${new URLSearchParams({ ano, entidade })}`);
  const desp = useApi(`/api/despesas/resumo?${new URLSearchParams({ ano, entidade })}`);
  const conf = useConferencia(ano);
  return (
    <>
      <Estado
        carregando={(resumo.carregando && !resumo.dados) || (desp.carregando && !desp.dados)}
        erro={resumo.erro || desp.erro}
      />
      {resumo.dados && desp.dados && (
        <Conteudo ano={ano} entidade={entidade} filtros={filtros} d={resumo.dados} o={desp.dados} conf={conf} />
      )}
    </>
  );
}

// `o`: despesa orçamentária (57170), já descontadas as anulações: totais e etapas.
// `d`: empenhos individuais (57140), pelo valor original: mês, órgão, credor e lista.
function Conteudo({ ano, entidade, filtros, d, o, conf }) {
  const [busca, setBusca] = useState('');
  const [orgao, setOrgao] = useState('');
  const [situacao, setSituacao] = useState('');
  const [pagina, setPagina] = useState(0);
  const [aberta, setAberta] = useState(null);
  const tabela = useRef(null);
  const termo = useDebounce(busca);
  const pop = populacao(ano);

  useEffect(() => setPagina(0), [termo, entidade, ano, orgao, situacao]);

  const filtroLista = { ano, q: termo, entidade, orgao, situacao };
  const lista = useApi(
    `/api/despesas/empenhos?${new URLSearchParams({ ...filtroLista, offset: pagina * POR_PAGINA, limit: POR_PAGINA })}`,
  );
  const totalPaginas = lista.dados ? Math.max(1, Math.ceil(lista.dados.total / POR_PAGINA)) : 1;

  const t = d.totais;
  const empenhado = N(o.totais.empenhado);
  const liquidado = N(o.totais.liquidado ?? 0);
  const pago = N(o.totais.pago ?? 0);
  const liquidadoAPagar = Math.max(liquidado - pago, 0);
  const naoLiquidado = Math.max(empenhado - liquidado, 0);
  const faltaPagar = liquidadoAPagar + naoLiquidado;
  const original = N(t.empenhado);
  const camara = o.camara;
  const anoEncerrado = ano < new Date().getFullYear();

  const meses = MESES.map((rotulo, i) => {
    const m = d.porMes.find((x) => x.chave === i + 1);
    return { rotulo, nome: MESES_LONGOS[i], a: N(m?.empenhado ?? 0), b: N(m?.pago ?? 0) };
  });

  const outros = d.porOrgao.slice(8);
  const orgaos = [
    ...d.porOrgao.slice(0, 8).map((o) => ({ ...o, rotulo: nomeProprio(o.nome) })),
    ...(outros.length
      ? [{ chave: '', rotulo: `Outros ${outros.length} órgãos`, empenhado: outros.reduce((s, o) => s + N(o.empenhado), 0), outro: true }]
      : []),
  ];

  const irParaTabela = () => tabela.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      <div className="abertura">
        <h1 className="manchete">
          De cada R$ 100 reservados para despesas, <em>R$ {decimal((pago / empenhado) * 100)}</em> já tinham sido pagos
          {anoEncerrado ? ' no fim do ano' : ' até agora'}.
        </h1>
        <div className="abertura-lado">
          <p className="capitular">
            Toda despesa pública passa por três etapas: empenho, liquidação e pagamento. Aqui você acompanha cada uma
            delas, por órgão e por credor, e pode buscar qualquer um dos {numero(t.quantidade)} empenhos do ano.
          </p>
        </div>
      </div>

      <Filtros {...filtros} />

      <Numeros rotulo="Totais de despesa">
        <Numero
          rotulo="Empenhado"
          detalhe={`já descontadas as anulações · ${numero(t.quantidade)} empenhos somavam ${emMilhoes(original)} no valor original`}
          selo={<Selo selo={seloDespesa(conf, entidade)} />}
        >
          <Mi valor={empenhado} />
        </Numero>
        <Numero rotulo="Pago" detalhe={`${pct(pago, empenhado)} do empenhado · liquidado ${emMilhoes(liquidado)}`}>
          <Mi valor={pago} />
        </Numero>
        <Numero
          rotulo="Falta pagar"
          vermelho
          detalhe={`${emMilhoes(liquidadoAPagar)} já liquidados · ${emMilhoes(naoLiquidado)} ainda não liquidados`}
        >
          <Mi valor={faltaPagar} />
        </Numero>
        <Numero rotulo="Credores" detalhe="empresas, órgãos e pessoas que receberam">
          {numero(t.credores)}
        </Numero>
      </Numeros>

      <section className="secao solta" style={{ gap: 20 }}>
        <h2 className="secao-titulo" style={{ borderBottom: '1px solid var(--tinta)', paddingBottom: 8 }}>
          O caminho dos {emMilhoes(empenhado).replace(' mi', ' milhões')} empenhados
        </h2>
        <ol className="etapas">
          <li>
            <span className="serif">1</span>
            <span>
              <strong>Empenho.</strong> A Prefeitura reserva o valor no orçamento para uma compra ou serviço.
            </span>
          </li>
          <li>
            <span className="serif">2</span>
            <span>
              <strong>Liquidação.</strong> Confere que o produto foi entregue ou o serviço, prestado.
            </span>
          </li>
          <li>
            <span className="serif">3</span>
            <span>
              <strong>Pagamento.</strong> O dinheiro sai do caixa para o credor.
            </span>
          </li>
        </ol>
        <BarraDividida
          total={empenhado}
          descricao={`Pago ${pct(pago, empenhado)}, liquidado e não pago ${pct(liquidadoAPagar, empenhado)}, ainda não liquidado ${pct(naoLiquidado, empenhado)}`}
          partes={[
            { nome: 'Pago', valor: pago },
            { nome: 'Liquidado, falta pagar', valor: liquidadoAPagar, classe: 'vermelho' },
            { nome: 'Ainda não liquidado', valor: naoLiquidado, classe: 'listrada' },
          ]}
        />
      </section>

      <section className="secao dupla">
        <div className="secao-cab">
          <h2 className="secao-titulo">Mês a mês</h2>
          <span className="legenda">
            <span>
              <span className="amostra" aria-hidden="true" />
              Empenhado
            </span>
            <span>
              <span className="amostra vermelho" aria-hidden="true" />
              Já pago
            </span>
            <span>R$ milhões · valor original, pelo mês do empenho</span>
          </span>
        </div>
        <BarrasMensais meses={meses} series={['Empenhado', 'Já pago']} descricao={`Empenhado e pago por mês de ${ano}`} />
      </section>

      <div className="colunas dupla">
        <section className="secao media">
          <h2 className="secao-titulo">Por órgão</h2>
          <p className="legenda-secao">Valor original dos empenhos · R$ mi · clique para ver os empenhos</p>
          <ListaPontos
            total={original}
            aoClicar={(o) => {
              if (o.outro) return;
              setOrgao(o.chave);
              irParaTabela();
            }}
            itens={orgaos.map((o) => ({
              chave: o.chave,
              nome: o.rotulo,
              valor: o.empenhado,
              outro: o.outro,
              selecionado: o.chave && o.chave === orgao,
              cor: o.outro ? 'var(--pontilhado)' : undefined,
              extra: o.outro ? undefined : `R$ ${numero(Math.round(N(o.empenhado) / pop.pessoas))} por morador`,
              dica: `${o.rotulo}: ${emMilhoes(o.empenhado)}`,
            }))}
          />
        </section>

        <section className="secao media com-fio">
          <h2 className="secao-titulo">Quem mais recebeu</h2>
          <p className="legenda-secao">Valor empenhado para cada credor no ano · clique para buscar</p>
          <ol className="ranking">
            {d.porCredor.map((c, i) => (
              <li key={c.chave}>
                <span className="pos">{i + 1}</span>
                <span className="corpo">
                  <button
                    type="button"
                    className="link-nome"
                    onClick={() => {
                      setBusca(c.nome);
                      irParaTabela();
                    }}
                  >
                    <strong>{nomeProprio(c.nome)}</strong>
                  </button>
                  <br />
                  <span className="sub mono apagado" style={{ fontSize: 12 }}>
                    {numero(c.quantidade)} empenhos · {nomeProprio(c.orgaoPrincipal)}
                  </span>
                </span>
                <span className="valor">{emMilhoes(c.empenhado)}</span>
              </li>
            ))}
          </ol>
          <p className="nota">
            A fonte não informa CPF nem CNPJ: os nomes aparecem como publicados. A lista inclui repasses internos, como
            folha de pagamento, encargos (INSS) e transferências entre fundos.
          </p>
        </section>
      </div>

      {d.maiores.length > 0 && (
        <section className="secao dupla">
          <div className="secao-cab">
            <h2 className="secao-titulo">Os maiores empenhos do ano</h2>
            <span className="legenda-secao">Um único empenho, não a soma por credor</span>
          </div>
          <div className="destaques">
            {d.maiores.map((e) => (
              <article key={e.id}>
                <span className="rotulo apagado">
                  Nº {e.numero} · {data(e.data)}
                </span>
                <span className="serif">
                  <Mi valor={e.empenhado} />
                </span>
                <strong>{nomeProprio(e.credor)}</strong>
                <span className="sub mono apagado" style={{ fontSize: 12 }}>
                  {nomeProprio(e.orgao)}
                </span>
                <p title={e.historico}>{e.historico?.toLocaleLowerCase('pt-BR').replace(/^./, (c) => c.toUpperCase())}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="secao dupla" ref={tabela} style={{ scrollMarginTop: 16 }}>
        <div className="secao-cab com-acoes">
          <div>
            <h2 className="secao-titulo">Todos os empenhos</h2>
            <p className="legenda-secao">Busque por credor, número ou descrição · clique numa linha para ler tudo</p>
          </div>
          <div className="acoes">
            <div className="campo-empilhado">
              <label htmlFor="busca-d" className="rotulo">
                Buscar
              </label>
              <input
                id="busca-d"
                type="search"
                placeholder="merenda, combustível…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="campo-empilhado">
              <label htmlFor="orgao-d" className="rotulo">
                Órgão
              </label>
              <select id="orgao-d" value={orgao} onChange={(e) => setOrgao(e.target.value)} style={{ maxWidth: 260 }}>
                <option value="">Todos os {d.porOrgao.length}</option>
                {d.porOrgao.map((o) => (
                  <option key={o.chave} value={o.chave}>
                    {nomeProprio(o.nome)}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo-empilhado">
              <label htmlFor="sit-d" className="rotulo">
                Situação
              </label>
              <select id="sit-d" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(SITUACAO).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <a href={`/api/despesas/empenhos.csv?${new URLSearchParams(filtroLista)}`} className="botao-link">
              Baixar CSV ↓
            </a>
          </div>
        </div>

        <Estado carregando={lista.carregando && !lista.dados} erro={lista.erro} />
        {lista.dados && (
          <>
            <div className="tabela-rolagem" style={{ opacity: lista.carregando ? 0.5 : 1 }}>
              <table style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th scope="col">Empenho</th>
                    <th scope="col">Órgão</th>
                    <th scope="col">Credor e descrição</th>
                    <th scope="col" className="num">
                      Empenhado
                    </th>
                    <th scope="col" className="num">
                      Pago
                    </th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.dados.itens.map((e) => {
                    const s = SITUACAO[situacaoDe(e)];
                    const alternar = () => setAberta(aberta === e.id ? null : e.id);
                    return (
                      <tr
                        key={e.id}
                        className={`expansivel${aberta === e.id ? ' aberta' : ''}`}
                        onClick={alternar}
                        onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), alternar())}
                        tabIndex={0}
                        aria-expanded={aberta === e.id}
                      >
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className="mono" style={{ fontWeight: 500 }}>
                            Nº {e.numero}
                          </span>
                          <br />
                          <span className="sub">
                            {data(e.data)} · {e.entidade}
                          </span>
                        </td>
                        <td style={{ maxWidth: 200 }}>{nomeProprio(e.orgao)}</td>
                        <td style={{ maxWidth: 440 }}>
                          <strong>{nomeProprio(e.credor)}</strong>
                          <br />
                          <span className="historico">
                            {e.historico?.toLocaleLowerCase('pt-BR').replace(/^./, (c) => c.toUpperCase())}
                          </span>
                          <Selo compacto selo={seloEmpenho(conf, e.id)} />
                          {aberta === e.id && e.liquidado !== null && (
                            <span className="sub" style={{ display: 'block', marginTop: 6 }}>
                              Liquidado {moeda(e.liquidado)} · saldo a pagar {moeda(e.saldoAPagar)}
                            </span>
                          )}
                        </td>
                        <td className="num">{decimal(e.empenhado)}</td>
                        <td className="num">{e.pago === null ? '—' : decimal(e.pago)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className={`situacao ${s.classe}`}>
                            <span className={`amostra ${s.amostra}`} aria-hidden="true" />
                            {s.nome}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!lista.dados.itens.length && (
                    <tr>
                      <td colSpan={6} className="nota-serif" style={{ padding: '32px 14px' }}>
                        Nenhum empenho encontrado com esses filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="paginacao">
              <span>
                {lista.dados.total
                  ? `Mostrando ${numero(pagina * POR_PAGINA + 1)}–${numero(Math.min((pagina + 1) * POR_PAGINA, lista.dados.total))} de ${numero(lista.dados.total)} empenhos`
                  : '0 empenhos'}
              </span>
              <nav aria-label="Paginação">
                <button type="button" className="botao-link" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
                  ← Anterior
                </button>
                <button
                  type="button"
                  className="botao-link"
                  disabled={pagina + 1 >= totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Próxima →
                </button>
              </nav>
            </div>
          </>
        )}
      </section>

      {camara && (
        <section className="secao solta">
          <h2 className="secao-titulo" style={{ borderBottom: '1px solid var(--tinta)', paddingBottom: 8 }}>
            Câmara Municipal
          </h2>
          <p className="nota-serif">
            A Câmara não publica no portal Betha da Prefeitura. Pelos dados enviados ao TCE-SC
            {anoEncerrado ? '' : ` (até ${data(camara.ultimoEmpenho)})`}, ela empenhou{' '}
            <strong>{moeda(camara.empenhado)}</strong> em {numero(camara.quantidade)} empenhos e pagou{' '}
            <strong>{moeda(camara.pago)}</strong>. Somada às entidades acima, a despesa empenhada do município é de{' '}
            <strong>{moeda(empenhado + N(camara.empenhado))}</strong>.
          </p>
          <p className="nota">
            Fonte: <a href={camara.urlOrigem}>Farol TCE-SC — Despesas Municipais</a>, coletado em {data(camara.coletadoEm)}.
          </p>
        </section>
      )}

      <p className="nota" style={{ marginTop: 32 }}>
        Os totais (empenhado, liquidado, pago e falta pagar) são a <strong>despesa orçamentária</strong> (consulta Betha
        57170), já descontadas as anulações: é o número que confere com o TCE-SC. O mês, os órgãos, os credores e a
        lista usam o <strong>valor original</strong> de cada empenho (consulta 57140). Registros que a{' '}
        <a href="#conferencia">conferência</a> aponta como versões antigas ou repetidas aparecem na lista com um selo,
        mas ficam fora das somas{t.excluidos ? ` (${numero(t.excluidos)} neste ano)` : ''}.
      </p>
      <Fonte meta={o.meta} />
      <Fonte meta={d.meta} />
    </>
  );
}
