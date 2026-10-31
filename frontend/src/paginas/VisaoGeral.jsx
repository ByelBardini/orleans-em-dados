import { useApi } from '../api.js';
import { Estado, Fonte, Kpi, Painel } from '../components.jsx';
import { moeda, numero, percentual } from '../format.js';

export default function VisaoGeral({ ano }) {
  const rec = useApi(`/api/receitas?ano=${ano}`);
  const emp = useApi(`/api/despesas/empenhos/resumo?ano=${ano}`);

  return (
    <>
      <h2>Visão geral — {ano}</h2>
      <p className="nota">
        Abrangência: Prefeitura, Fundo Municipal de Saúde, SAMAE e Fundação Ambiental, conforme publicado no portal
        Betha. A Câmara Municipal não está incluída.
      </p>

      <Estado carregando={rec.carregando || emp.carregando} erro={rec.erro || emp.erro} />

      {rec.dados && (
        <Painel titulo="Receitas orçamentárias" subtitulo="Consulta Betha 57153">
          <div className="kpis">
            <Kpi
              rotulo="Arrecadado no exercício"
              valor={rec.dados.totais.arrecadadoNoMes}
              detalhe="Soma de “arrecadado no mês”, com ajustes negativos"
            />
            <Kpi rotulo="Orçamento atualizado" valor={rec.dados.totais.orcadoAtualizado} />
          </div>
          <Fonte meta={rec.dados.meta} />
        </Painel>
      )}

      {emp.dados && (
        <Painel titulo="Empenhos do exercício" subtitulo="Consulta Betha 57140 — valores originais dos empenhos">
          <div className="kpis">
            <Kpi rotulo="Valor dos empenhos" valor={emp.dados.totais.empenhado} detalhe={`${numero(emp.dados.totais.quantidade)} empenhos`} />
            <Kpi rotulo="Liquidado" valor={emp.dados.totais.liquidado} />
            <Kpi rotulo="Pago" valor={emp.dados.totais.pago} />
          </div>
          <p className="nota">
            Este total não é a despesa empenhada líquida: não desconta anulações. O indicador orçamentário virá da
            consulta 57170, ainda não integrada.
          </p>
          <Fonte meta={emp.dados.meta} />
        </Painel>
      )}

      {rec.dados && emp.dados && (
        <Painel titulo="Por entidade" subtitulo="Cada coluna vem de uma consulta diferente; não subtrair uma da outra">
          <div className="tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th>Entidade</th>
                  <th className="num">Arrecadado (57153)</th>
                  <th className="num">% da receita</th>
                  <th className="num">Empenhos (57140)</th>
                  <th className="num">% dos empenhos</th>
                </tr>
              </thead>
              <tbody>
                {rec.dados.porEntidade.map((r) => {
                  const e = emp.dados.porEntidade.find((x) => x.chave === r.chave);
                  return (
                    <tr key={r.chave}>
                      <td>{r.entidade.nome}</td>
                      <td className="num">{moeda(r.arrecadadoNoMes)}</td>
                      <td className="num">{percentual(r.arrecadadoNoMes, rec.dados.totais.arrecadadoNoMes)}</td>
                      <td className="num">{moeda(e?.empenhado)}</td>
                      <td className="num">{e ? percentual(e.empenhado, emp.dados.totais.empenhado) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="nota">
            Entidades identificadas pelo código no ID dos registros Betha (mapeamento inferido, a confirmar no cadastro).
          </p>
        </Painel>
      )}
    </>
  );
}
