import { useMemo, useState } from 'react';
import { useApi } from '../api.js';
import { BarrasHorizontais, BarrasVerticais, Estado, Fonte, Kpi, Painel } from '../components.jsx';
import { MESES, moeda, numero, percentual } from '../format.js';

export default function Receitas({ ano }) {
  const { dados, carregando, erro } = useApi(`/api/receitas?ano=${ano}`);
  const [busca, setBusca] = useState('');

  const naturezas = useMemo(() => {
    if (!dados) return [];
    const t = busca.trim().toLowerCase();
    if (!t) return dados.naturezas;
    return dados.naturezas.filter(
      (n) => n.rubrica.includes(t) || n.descricao.toLowerCase().includes(t) || n.entidade.toLowerCase().includes(t),
    );
  }, [dados, busca]);

  return (
    <>
      <h2>Receitas — {ano}</h2>
      <Estado carregando={carregando} erro={erro} />
      {dados && (
        <>
          <div className="kpis">
            <Kpi rotulo="Arrecadado no exercício" valor={dados.totais.arrecadadoNoMes} />
            <Kpi rotulo="Orçamento atualizado" valor={dados.totais.orcadoAtualizado} />
            <Kpi
              rotulo="Arrecadado ÷ orçado atualizado"
              texto={percentual(dados.totais.arrecadadoNoMes, dados.totais.orcadoAtualizado)}
            />
          </div>

          <Painel
            titulo="Arrecadação por mês"
            subtitulo="Mês inferido do sufixo do ID do registro (_1 a _12); semântica ainda não confirmada"
          >
            <BarrasVerticais
              rotuloValor="Arrecadação mensal"
              itens={dados.porMes.map((m) => ({ rotulo: MESES[m.chave - 1] ?? '?', valor: m.arrecadadoNoMes }))}
            />
          </Painel>

          <div className="grade-2">
            <Painel titulo="Por origem" subtitulo="Dois primeiros dígitos da natureza da receita">
              <BarrasHorizontais
                itens={dados.porOrigem.map((o) => ({ rotulo: o.descricao, valor: o.arrecadadoNoMes }))}
              />
            </Painel>
            <Painel titulo="Por entidade">
              <BarrasHorizontais
                itens={dados.porEntidade.map((e) => ({ rotulo: e.entidade.sigla, valor: e.arrecadadoNoMes }))}
              />
            </Painel>
          </div>

          <Painel
            titulo="Naturezas de receita"
            subtitulo={`${numero(naturezas.length)} de ${numero(dados.naturezas.length)} rubricas · ${numero(dados.totais.negativos)} lançamentos mensais negativos preservados`}
            acoes={
              <input
                type="search"
                placeholder="Buscar rubrica ou descrição"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            }
          >
            <div className="tabela-rolagem tabela-alta">
              <table>
                <thead>
                  <tr>
                    <th>Rubrica</th>
                    <th>Descrição</th>
                    <th>Entidade</th>
                    <th className="num">Orçado atualizado</th>
                    <th className="num">Arrecadado</th>
                  </tr>
                </thead>
                <tbody>
                  {naturezas.map((n) => (
                    <tr key={n.chave}>
                      <td>
                        <code>{n.rubrica}</code>
                      </td>
                      <td>{n.descricao}</td>
                      <td>{n.entidade}</td>
                      <td className="num">{moeda(n.orcadoAtualizado)}</td>
                      <td className={`num${n.arrecadadoNoMes < 0 ? ' negativo' : ''}`}>{moeda(n.arrecadadoNoMes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Painel>

          <Fonte meta={dados.meta} />
        </>
      )}
    </>
  );
}
