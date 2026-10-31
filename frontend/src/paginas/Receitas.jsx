import { useMemo, useState } from 'react';
import { useApi } from '../api.js';
import { BarraDividida, Estado, Filtros, Fonte, LinhaAcumulada, ListaPontos, Mi, Numero, Numeros } from '../components.jsx';
import { emMilhoes, MESES, MESES_LONGOS, milhoes, moeda, numero, pct, porExtenso } from '../format.js';
import { ORIGEM_CIDADAO, ORIGENS_DE_FORA, populacao, sujeito } from '../referencias.js';

const N = Number;
const INICIAL = 10;

// "Imposto sobre ... - Principal" → "Imposto sobre ..."
const nomeReceita = (d) => d.replace(/\s*-\s*Principal$/i, '').trim();

// Nomes pelos quais o morador conhece os tributos, pelo começo da natureza.
const TRIBUTOS = [
  ['111250', 'IPTU'],
  ['111253', 'ITBI (venda de imóveis)'],
  ['111451', 'ISS (imposto sobre serviços)'],
  ['11130', 'Imposto de Renda retido na fonte'],
  ['1241', 'Contribuição de iluminação pública'],
];
const nomeTributo = (r) => TRIBUTOS.find(([prefixo]) => r.rubrica.startsWith(prefixo))?.[1] ?? r.descricao;

export default function Receitas({ ano, entidade, filtros }) {
  const { dados, carregando, erro } = useApi(`/api/receitas?${new URLSearchParams({ ano, entidade })}`);
  return (
    <>
      <Estado carregando={carregando} erro={erro} />
      {dados && <Conteudo ano={ano} entidade={entidade} filtros={filtros} dados={dados} />}
    </>
  );
}

function Conteudo({ ano, entidade, filtros, dados }) {
  const [busca, setBusca] = useState('');
  const [todas, setTodas] = useState(false);
  const pop = populacao(ano);
  const arrecadado = N(dados.totais.arrecadadoNoMes);
  const previsto = N(dados.totais.orcadoAtualizado);
  const deducoes = N(dados.totais.orcadoDeducoes ?? 0);
  const realizado = previsto > 0 ? (arrecadado / previsto) * 100 : null;
  const diferenca = arrecadado - previsto;
  const quem = sujeito(entidade, filtros.entidades);

  // Uma linha por rubrica, somando as entidades.
  const rubricas = useMemo(() => {
    const mapa = new Map();
    for (const n of dados.naturezas) {
      const r = mapa.get(n.rubrica) ?? { rubrica: n.rubrica, descricao: nomeReceita(n.descricao), previsto: 0, arrecadado: 0, entidades: new Set() };
      r.previsto += N(n.orcadoAtualizado);
      r.arrecadado += N(n.arrecadadoNoMes);
      r.entidades.add(n.entidade);
      mapa.set(n.rubrica, r);
    }
    return [...mapa.values()].sort((a, b) => b.arrecadado - a.arrecadado);
  }, [dados.naturezas]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (!t) return rubricas;
    return rubricas.filter(
      (r) =>
        r.rubrica.includes(t) ||
        r.descricao.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(t),
    );
  }, [rubricas, busca]);
  const visiveis = todas || busca ? filtradas : filtradas.slice(0, INICIAL);

  // Acumulado mês a mês a partir de "arrecadado no mês" (o acumulado da fonte não é somável).
  const ultimoMes = Math.max(0, ...dados.porMes.map((m) => m.chave ?? 0));
  const acumulado = [];
  for (let i = 1, soma = 0; i <= ultimoMes; i++) {
    soma += N(dados.porMes.find((m) => m.chave === i)?.arrecadadoNoMes ?? 0);
    acumulado.push(soma);
  }
  const ritmo = (i) => (previsto / 12) * (i + 1);
  const sempreAcima = acumulado.every((v, i) => v >= ritmo(i));
  const sempreAbaixo = acumulado.every((v, i) => v < ritmo(i));
  const textoLinha = !previsto
    ? null
    : sempreAcima
      ? 'A linha cheia corre acima da tracejada o ano todo: a arrecadação ficou à frente do previsto.'
      : sempreAbaixo
        ? 'A linha cheia corre sempre abaixo da tracejada: o ano todo, a arrecadação ficou atrás do previsto.'
        : acumulado.at(-1) >= ritmo(acumulado.length - 1)
          ? 'A linha cheia passa a tracejada no decorrer do ano: a arrecadação terminou à frente do previsto.'
          : 'A linha cheia perde fôlego no decorrer do ano e termina abaixo da tracejada.';

  const origens = dados.porOrigem.filter((o) => N(o.arrecadadoNoMes) !== 0);
  const somaOrigem = (f) => origens.filter(f).reduce((s, o) => s + N(o.arrecadadoNoMes), 0);
  const deFora = somaOrigem((o) => ORIGENS_DE_FORA.has(o.chave));
  const emprestimos = somaOrigem((o) => o.chave === '21' || o.chave === '23');
  const propria = arrecadado - deFora - emprestimos;

  const impostos = rubricas.filter((r) => (r.rubrica.startsWith('11') || r.rubrica.startsWith('12')) && r.arrecadado > 0);
  const totalImpostos = impostos.reduce((s, r) => s + r.arrecadado, 0);

  return (
    <>
      <div className="abertura">
        <div className="manchete" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 style={{ font: 'inherit' }}>
            {realizado !== null ? (
              <>
                {quem.charAt(0).toUpperCase() + quem.slice(1)} arrecadou <em>{pct(arrecadado, previsto)}</em> do que o
                orçamento previa para {ano}.
              </>
            ) : (
              <>
                {quem.charAt(0).toUpperCase() + quem.slice(1)} arrecadou <em>{porExtenso(arrecadado)}</em> em {ano}.
              </>
            )}
          </h1>
        </div>
        <div className="abertura-lado">
          <p className="capitular">
            {realizado === null
              ? 'Não há previsão de receita publicada para este recorte. '
              : diferenca >= 0
                ? `Entraram ${porExtenso(diferenca)} a mais que os ${porExtenso(previsto)} previstos. `
                : `Faltaram ${porExtenso(-diferenca)} para a meta de ${porExtenso(previsto)}. `}
            {deFora > 0 &&
              `Repasses da União e do Estado responderam por ${pct(deFora, arrecadado)} do total; o restante saiu de impostos, taxas e tarifas cobrados aqui.`}
          </p>
        </div>
      </div>

      <Filtros {...filtros} />

      <Numeros rotulo="Totais de receita">
        <Numero rotulo="Previsto" detalhe="orçamento atualizado do ano">
          <Mi valor={previsto} />
        </Numero>
        <Numero rotulo="Arrecadado" detalhe={moeda(arrecadado)}>
          <Mi valor={arrecadado} />
        </Numero>
        <Numero rotulo="Realizado" vermelho barra={realizado ?? undefined}>
          {realizado === null ? '—' : pct(arrecadado, previsto)}
        </Numero>
        {deducoes > 0 ? (
          <Numero rotulo="Separado p/ o FUNDEB" detalhe="previsto: 20% de FPM, ICMS, IPVA, IPI e ITR">
            <Mi valor={deducoes} />
          </Numero>
        ) : (
          <Numero rotulo="Por morador" detalhe={`${numero(pop.pessoas)} moradores (${pop.fonte})`}>
            R$ {numero(Math.round(arrecadado / pop.pessoas))}
          </Numero>
        )}
      </Numeros>

      {acumulado.length > 0 && (
        <section className="secao solta">
          <div className="secao-cab">
            <h2 className="secao-titulo">A arrecadação acompanhou a previsão?</h2>
            <span className="legenda">
              <span>
                <span aria-hidden="true" style={{ width: 16, height: 2, background: 'var(--tinta)' }} />
                Arrecadado, acumulado
              </span>
              {previsto > 0 && (
                <span>
                  <svg width="18" height="4" aria-hidden="true">
                    <line x1="0" y1="2" x2="18" y2="2" stroke="var(--vermelho)" strokeWidth="2" strokeDasharray="4 3" />
                  </svg>
                  Ritmo previsto
                </span>
              )}
              <span>R$ milhões</span>
            </span>
          </div>
          <LinhaAcumulada
            acumulado={acumulado}
            meta={previsto}
            rotulos={MESES}
            nomes={MESES_LONGOS}
            descricao={`Arrecadado acumulado em ${ano} chega a ${milhoes(arrecadado)} milhões; o previsto era ${milhoes(previsto)} milhões`}
            anotacao={textoLinha && { texto: textoLinha, posicao: { left: '5%', top: '2%' } }}
          />
        </section>
      )}

      <div className="colunas dupla">
        <section className="secao media">
          <h2 className="secao-titulo">Por origem</h2>
          <p className="legenda-secao">Pelos 2 primeiros dígitos do código da receita · R$ mi</p>
          <ListaPontos
            total={arrecadado}
            itens={origens.map((o) => ({
              chave: o.chave,
              cod: o.chave,
              nome: o.descricao,
              valor: o.arrecadadoNoMes,
              dica: `${ORIGEM_CIDADAO[o.chave] ?? o.descricao}: ${emMilhoes(o.arrecadadoNoMes)}`,
            }))}
          />
        </section>

        <aside className="secao media com-fio como-ler">
          <h2 className="secao-titulo italico" style={{ border: 0, padding: 0 }}>
            Como ler estes números
          </h2>
          <p>
            <strong>Transferências correntes são repasses.</strong> FPM, ICMS, IPVA, FUNDEB e SUS chegam da União e do
            Estado e costumam pesar mais que os impostos cobrados pela própria cidade.
          </p>
          <p>
            <strong>Valores negativos são ajustes.</strong> Em alguns meses uma receita aparece negativa porque um
            lançamento anterior foi corrigido.{' '}
            {dados.totais.negativos > 0 && `Neste recorte há ${numero(dados.totais.negativos)} lançamentos assim.`}
          </p>
          <p>
            <strong>Acima de 100% é bom sinal.</strong> Aquela receita rendeu mais do que o orçamento esperava.
            Receitas sem previsão (convênios, emendas) entram no ano sem meta.
          </p>
          <p>
            <strong>O SAMAE cobra e depois recebe.</strong> A tarifa de água é lançada no mês e só conta como
            arrecadada quando a conta é paga.
          </p>
        </aside>
      </div>

      <div className="colunas dupla">
        <section className="secao larga">
          <h2 className="secao-titulo">Quanto vem de fora</h2>
          <p className="legenda-secao">Dinheiro da própria cidade × repasses de outros governos</p>
          <BarraDividida
            total={arrecadado}
            descricao={`Arrecadação própria ${pct(propria, arrecadado)}, repasses ${pct(deFora, arrecadado)}`}
            partes={[
              { nome: 'Arrecadação própria: impostos, taxas, tarifas, rendimentos', valor: propria },
              { nome: 'Repasses da União e do Estado', valor: deFora, classe: 'vermelho' },
              { nome: 'Empréstimos', valor: emprestimos, classe: 'cinza' },
            ]}
          />
          <p className="nota-serif">
            Para cada R$ 10 que entraram, R$ {((deFora / arrecadado) * 10).toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}{' '}
            vieram de repasses.
          </p>
        </section>

        {impostos.length > 0 && (
          <section className="secao estreita">
            <h2 className="secao-titulo">Impostos da cidade</h2>
            <p className="legenda-secao">
              {emMilhoes(totalImpostos)} · R$ {numero(Math.round(totalImpostos / pop.pessoas))} por morador
            </p>
            <ListaPontos
              itens={impostos.slice(0, 7).map((r) => ({
                chave: r.rubrica,
                nome: nomeTributo(r),
                valor: r.arrecadado,
                extra: `R$ ${numero(Math.round(r.arrecadado / pop.pessoas))} por morador`,
                dica: r.descricao,
              }))}
            />
          </section>
        )}
      </div>

      <section className="secao dupla">
        <div className="secao-cab com-acoes">
          <div>
            <h2 className="secao-titulo">Principais receitas</h2>
            <p className="legenda-secao">
              {busca
                ? `${numero(filtradas.length)} de ${numero(rubricas.length)} naturezas`
                : `As ${Math.min(visiveis.length, rubricas.length)} maiores de ${numero(rubricas.length)} naturezas`}{' '}
              · R$ milhões
            </p>
          </div>
          <div className="acoes">
            <div className="campo-empilhado">
              <label htmlFor="busca-r" className="rotulo">
                Buscar receita
              </label>
              <input
                id="busca-r"
                type="search"
                placeholder="IPTU, FPM, ISS…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <a href={`/api/receitas.csv?${new URLSearchParams({ ano, entidade })}`} className="botao-link">
              Baixar CSV ↓
            </a>
          </div>
        </div>
        <div className="tabela-rolagem">
          <table style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th scope="col">Receita</th>
                <th scope="col">Origem</th>
                <th scope="col" className="num">
                  Previsto
                </th>
                <th scope="col" className="num">
                  Arrecadado
                </th>
                <th scope="col" style={{ width: 220 }}>
                  Realizado
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((r) => {
                const p = r.previsto > 0 ? (r.arrecadado / r.previsto) * 100 : null;
                const cor = p !== null && p >= 100 ? 'vermelho' : '';
                return (
                  <tr key={r.rubrica}>
                    <td>
                      <strong>{r.descricao}</strong>
                      <br />
                      <span className="sub">
                        {r.rubrica}
                        {r.entidades.size === 1 && !entidade ? ` · ${[...r.entidades][0]}` : ''}
                      </span>
                    </td>
                    <td>{ORIGEM_CIDADAO[r.rubrica.slice(0, 2)] ?? r.rubrica.slice(0, 2)}</td>
                    <td className="num">{r.previsto ? milhoes(r.previsto) : '—'}</td>
                    <td className={`num${r.arrecadado < 0 ? ' vermelho' : ''}`} style={{ fontWeight: 500 }} title={moeda(r.arrecadado)}>
                      {milhoes(r.arrecadado)}
                    </td>
                    <td>
                      {p === null ? (
                        <span className="sub">sem previsão</span>
                      ) : (
                        <div className="realizado">
                          <div className="trilho" aria-hidden="true">
                            <span className={cor} style={{ width: `${Math.min(Math.max(p, 0) / 110, 1) * 100}%` }} />
                            <span className="marca-100" style={{ left: `${(100 / 110) * 100}%` }} />
                          </div>
                          <span className={`mono ${cor}`}>{Math.round(p)}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="paginacao">
          <p className="nota-serif" style={{ fontSize: 17 }}>
            O traço vertical marca 100% do previsto. Em vermelho, receitas que passaram da meta.
          </p>
          {!busca && rubricas.length > INICIAL && (
            <button type="button" className="botao-link" onClick={() => setTodas((t) => !t)}>
              {todas ? 'Mostrar só as maiores ↑' : `Mostrar todas as ${numero(rubricas.length)} ↓`}
            </button>
          )}
        </div>
      </section>

      <Fonte meta={dados.meta} />
    </>
  );
}
