import { useEffect, useState } from 'react';
import { useApi } from '../api.js';
import { BarrasHorizontais, BarrasVerticais, Estado, Fonte, Kpi, Painel } from '../components.jsx';
import { data, MESES, moeda, numero } from '../format.js';

const POR_PAGINA = 25;

function useDebounce(valor, ms = 300) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

export default function Despesas({ ano }) {
  const resumo = useApi(`/api/despesas/empenhos/resumo?ano=${ano}`);
  const [busca, setBusca] = useState('');
  const [entidade, setEntidade] = useState('');
  const [pagina, setPagina] = useState(0);
  const termo = useDebounce(busca);

  useEffect(() => setPagina(0), [termo, entidade, ano]);

  const qs = new URLSearchParams({ ano, q: termo, entidade, offset: pagina * POR_PAGINA, limit: POR_PAGINA });
  const lista = useApi(`/api/despesas/empenhos?${qs}`);
  const d = resumo.dados;
  const totalPaginas = lista.dados ? Math.max(1, Math.ceil(lista.dados.total / POR_PAGINA)) : 1;

  return (
    <>
      <h2>Despesas — {ano}</h2>
      <p className="nota">
        Execução detalhada (consulta Betha 57140): valores <strong>originais</strong> de cada empenho. Não equivale à
        despesa empenhada líquida de anulações, que virá da consulta 57170.
      </p>
      <Estado carregando={resumo.carregando} erro={resumo.erro} />
      {d && (
        <>
          <div className="kpis">
            <Kpi rotulo="Valor dos empenhos" valor={d.totais.empenhado} detalhe={`${numero(d.totais.quantidade)} empenhos`} />
            <Kpi rotulo="Liquidado" valor={d.totais.liquidado} />
            <Kpi
              rotulo="Pago"
              valor={d.totais.pago}
              detalhe={`${numero(d.totais.semValoresDeExecucao)} empenhos sem valores de liquidação/pagamento informados`}
            />
          </div>

          <Painel titulo="Valor empenhado por mês" subtitulo="Pela data de emissão do empenho">
            <BarrasVerticais
              rotuloValor="Valor empenhado mensal"
              itens={d.porMes.map((m) => ({ rotulo: MESES[m.chave - 1] ?? '?', valor: m.empenhado }))}
            />
          </Painel>

          <div className="grade-2">
            <Painel titulo="Por órgão" subtitulo="Descrição do órgão como publicada (inclui grafias corrompidas)">
              <BarrasHorizontais itens={d.porOrgao.map((o) => ({ rotulo: o.chave, valor: o.empenhado }))} />
            </Painel>
            <Painel titulo="Por entidade">
              <BarrasHorizontais itens={d.porEntidade.map((e) => ({ rotulo: e.entidade.sigla, valor: e.empenhado }))} />
            </Painel>
          </div>

          <Painel
            titulo="Empenhos"
            subtitulo={lista.dados ? `${numero(lista.dados.total)} encontrados` : ' '}
            acoes={
              <div className="filtros">
                <select value={entidade} onChange={(e) => setEntidade(e.target.value)}>
                  <option value="">Todas as entidades</option>
                  {d.porEntidade.map((e) => (
                    <option key={e.chave} value={e.chave}>
                      {e.entidade.sigla}
                    </option>
                  ))}
                </select>
                <input
                  type="search"
                  placeholder="Credor, histórico, órgão ou número"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            }
          >
            <Estado carregando={lista.carregando && !lista.dados} erro={lista.erro} />
            {lista.dados && (
              <>
                <div className="tabela-rolagem">
                  <table>
                    <thead>
                      <tr>
                        <th>Nº</th>
                        <th>Data</th>
                        <th>Entidade / órgão</th>
                        <th>Credor</th>
                        <th>Histórico</th>
                        <th className="num">Empenhado</th>
                        <th className="num">Liquidado</th>
                        <th className="num">Pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.dados.itens.map((e) => (
                        <tr key={e.id}>
                          <td>{e.numero}</td>
                          <td className="nowrap">{data(e.data)}</td>
                          <td className="orgao">
                            <span className="etiqueta">{e.entidade}</span>
                            <br />
                            <small>{e.orgao}</small>
                          </td>
                          <td>{e.credor}</td>
                          <td className="historico">{e.historico}</td>
                          <td className="num">{moeda(e.empenhado)}</td>
                          <td className="num">{moeda(e.liquidado)}</td>
                          <td className="num">{moeda(e.pago)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="paginacao">
                  <button disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
                    ← Anterior
                  </button>
                  <span>
                    Página {pagina + 1} de {numero(totalPaginas)}
                  </span>
                  <button disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
                    Próxima →
                  </button>
                </div>
              </>
            )}
          </Painel>

          <Fonte meta={d.meta} />
        </>
      )}
    </>
  );
}
