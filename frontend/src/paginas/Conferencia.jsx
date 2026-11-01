import { useState } from 'react';
import { useApi } from '../api.js';
import { Estado, Filtros, Mi, Numero, Numeros } from '../components.jsx';
import { data, dataHora, emMilhoes, MESES, MESES_LONGOS, moeda, numero, pct } from '../format.js';

const N = Number;
const INICIAL = 8;
const RELATORIO = 'https://github.com/ByelBardini/orleans-em-dados/blob/main/docs/CONFERENCIA_BETHA_TCE.md';

// Diferença Betha − TCE dita por extenso: "R$ 1,00 a mais na Betha" / "a mais no TCE" / "igual".
const ladoMaior = (v) => (N(v) > 0 ? 'a mais na Betha' : 'a mais no TCE');

function Diferenca({ valor }) {
  if (valor === null || valor === undefined) return <span className="apagado">—</span>;
  if (N(valor) === 0) return <span className="apagado">igual</span>;
  return (
    <span className="vermelho">
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
  diverge: { texto: 'Diverge', classe: 'apagar', amostra: 'vermelho' },
  soTce: { texto: 'Só no TCE', classe: 'sem', amostra: 'cinza' },
  soBetha: { texto: 'Só na Betha', classe: 'apagar', amostra: 'vermelho' },
  aguardando: { texto: 'Aguardando TCE', classe: 'sem', amostra: 'cinza' },
  valor: { texto: 'Valor diferente', classe: 'apagar', amostra: 'vermelho' },
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

function Conteudo({ ano, filtros, dados }) {
  const { resumo, parcial, limites, camara } = dados;
  const mesLimite = MESES_LONGOS[limites.mesReceita - 1];
  const divergentesDespesa = dados.despesaPorEntidade.filter(
    (r) => r.comparavel && (r.difEmpenhado !== 0 || r.difLiquidado !== 0 || r.difPago !== 0),
  );
  const empenhosOk = resumo.empenhosCasados === resumo.empenhosBetha && resumo.empenhosCasados === resumo.empenhosTce;

  return (
    <>
      <div className="abertura">
        <h1 className="manchete">
          {parcial ? (
            empenhosOk ? (
              <>
                Até {mesLimite} de {ano}, os {numero(resumo.empenhosCasados)} empenhos que o TCE-SC já recebeu batem{' '}
                <em>um a um</em> com a Betha.
              </>
            ) : (
              <>
                Até {mesLimite} de {ano}, <em>{numero(resumo.empenhosBetha - resumo.empenhosCasados)} empenhos</em> da
                Betha não aparecem no TCE-SC.
              </>
            )
          ) : (
            <>
              Em {ano}, a despesa bate ao centavo em {resumo.despesaEntidadesIguais} de {resumo.despesaEntidadesComparadas}{' '}
              entidades; a receita difere em <em>{moeda(Math.abs(resumo.receitaDiferenca))}</em>.
            </>
          )}
        </h1>
        <div className="abertura-lado">
          <p className="capitular">
            O Portal da Transparência (Betha) é o que o município publica. O Farol do TCE-SC reúne o que o município
            envia ao Tribunal de Contas. As duas fontes deveriam coincidir. Aqui, cada diferença aparece com o valor e a
            pista mais provável. Diferença entre fontes não é, por si, erro ou irregularidade.
          </p>
        </div>
      </div>

      <Filtros {...filtros} entidades={[]} />

      {parcial && (
        <p className="aviso">
          O TCE-SC recebe os dados com atraso: por enquanto, tem receitas até <strong>{mesLimite}</strong> e empenhos
          até <strong>{data(limites.dataEmpenho)}</strong>. As comparações de receita e de empenhos abaixo se limitam a
          esse período. A despesa total do ano só será comparada quando o TCE tiver o exercício completo.
        </p>
      )}

      <Numeros rotulo="Resumo da conferência">
        <Numero
          rotulo="Despesa por entidade"
          detalhe={parcial ? 'aguardando o exercício completo no TCE' : 'iguais ao centavo (empenhado, liquidado e pago)'}
          vermelho={!parcial && divergentesDespesa.length > 0}
        >
          {parcial ? '—' : `${resumo.despesaEntidadesIguais} de ${resumo.despesaEntidadesComparadas}`}
        </Numero>
        <Numero
          rotulo="Diferença na receita"
          detalhe={`${resumo.receitaDiferenca === 0 ? '' : `${ladoMaior(resumo.receitaDiferenca)} · `}Betha ${emMilhoes(resumo.receitaBetha)} · TCE ${emMilhoes(resumo.receitaTce)}`}
          vermelho={resumo.receitaDiferenca !== 0}
        >
          {resumo.receitaDiferenca === 0 ? 'igual' : <MilOuMi valor={Math.abs(resumo.receitaDiferenca)} />}
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
          vermelho={!empenhosOk}
        >
          {pct(resumo.empenhosCasados, resumo.empenhosBetha, 1)}
        </Numero>
      </Numeros>

      <Despesa dados={dados} />

      <ReceitaEntidades dados={dados} />

      <RubricasDivergentes dados={dados} />

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
              ` (${emMilhoes(camara.empenhado)} empenhados e ${emMilhoes(camara.pago)} pagos em ${numero(camara.empenhos)} empenhos, dados até ${data(camara.ultimo)})`}{' '}
            e já fazem parte do total municipal do Tribunal: somar a Câmara ao total do TCE contaria duas vezes.
          </p>
          <h2 className="secao-titulo italico com-fio" style={{ border: 0, padding: 0, marginTop: 12 }}>
            Como ler esta página
          </h2>
          <p>
            <strong>Igual</strong> significa idêntico ao centavo. Quando não é igual, a diferença diz qual fonte registra
            mais: “a mais na Betha” ou “a mais no TCE”.
          </p>
          <p>
            <strong>Despesa</strong> compara a consulta 57170 da Betha (empenhado, liquidado e pago já descontadas as
            anulações) com o mesmo conceito no TCE. <strong>Empenhos</strong> compara a lista 57140, um a um, por
            entidade, número, data e valor original. <strong>Rubricas</strong> são comparadas pelos 8 primeiros dígitos
            do código da receita, o nível comum às duas fontes.
          </p>
          <p>
            As pistas (“possível duplicidade”, “provável renumeração”) saem de padrões nos próprios números. Não são
            explicação contábil.{' '}
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

function Despesa({ dados }) {
  const linhas = dados.despesaPorEntidade;
  const soma = (k) => linhas.reduce((s, r) => s + Math.round(N(r[k] ?? 0) * 100), 0) / 100;
  return (
    <section className="secao solta">
      <div className="secao-cab">
        <h2 className="secao-titulo">Despesa por entidade</h2>
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
                  <td className="num">{r.comparavel ? <Diferenca valor={r.difEmpenhado} /> : '—'}</td>
                  <td className="num">{r.comparavel ? <Diferenca valor={r.difLiquidado} /> : '—'}</td>
                  <td className="num">{r.comparavel ? <Diferenca valor={r.difPago} /> : '—'}</td>
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
        <h2 className="secao-titulo">Receita arrecadada por entidade</h2>
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
                  <Diferenca valor={r.diferenca} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReceitaMeses({ dados }) {
  const meses = dados.receitaPorMes.filter((m) => m.mes);
  const max = Math.max(...meses.map((m) => Math.abs(N(m.diferenca ?? 0))), 1);
  return (
    <section className="secao media">
      <h2 className="secao-titulo">Receita mês a mês</h2>
      <p className="legenda-secao">Em cada mês, quanto uma fonte registra a mais que a outra · traço maior, diferença maior</p>
      <ul className="lista-pontos">
        {meses.map((m) => (
          <li key={m.mes}>
            <div className="lp-linha">
              <span className="lp-cod">{MESES[m.mes - 1]}</span>
              <span className="lp-nome apagado">{m.diferenca === null ? 'TCE ainda não recebeu' : ''}</span>
              <span className="lp-pontos" aria-hidden="true" />
              <span className="lp-valor">
                <Diferenca valor={m.diferenca} />
              </span>
            </div>
            {m.diferenca !== null && (
              <div className="trilho" aria-hidden="true">
                <span className="vermelho" style={{ width: `${(Math.abs(N(m.diferenca)) / max) * 100}%` }} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RubricasDivergentes({ dados }) {
  const [todas, setTodas] = useState(false);
  const linhas = dados.receitaPorNatureza;
  const visiveis = todas ? linhas : linhas.slice(0, INICIAL);
  return (
    <section className="secao solta">
      <div className="secao-cab">
        <h2 className="secao-titulo">Onde a receita diverge</h2>
        <span className="legenda">
          <span>
            {linhas.length} de {dados.resumo.naturezasComparadas} rubricas × entidade
          </span>
        </span>
      </div>
      {linhas.length === 0 ? (
        <p className="nota-serif">Todas as rubricas de receita batem ao centavo entre as duas fontes.</p>
      ) : (
        <>
          <div className="tabela-rolagem">
            <table style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th scope="col">Rubrica</th>
                  <th scope="col" className="num">
                    Betha
                  </th>
                  <th scope="col" className="num">
                    TCE
                  </th>
                  <th scope="col" className="num">
                    Diferença
                  </th>
                  <th scope="col">O que pode ser</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((r) => (
                  <tr key={`${r.entidade}|${r.natureza}`}>
                    <td style={{ maxWidth: 340 }}>
                      <span className="mono" style={{ fontWeight: 500 }}>
                        {r.natureza}
                      </span>{' '}
                      · {r.entidade}
                      <div className="historico">{r.descricao ? r.descricao.replace(/\s*-\s*Principal$/i, '') : 'sem descrição no TCE'}</div>
                    </td>
                    <td className="num">{moeda(r.betha)}</td>
                    <td className="num">{moeda(r.tce)}</td>
                    <td className="num">
                      <Diferenca valor={r.diferenca} />
                    </td>
                    <td style={{ maxWidth: 360 }}>
                      <Situacao tipo={r.tipo} />
                      <div className="historico" style={{ WebkitLineClamp: 'unset', display: 'block' }}>
                        {r.nota}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {linhas.length > INICIAL && (
            <button type="button" className="botao-link" onClick={() => setTodas(!todas)}>
              {todas ? 'Mostrar menos' : `Ver as ${linhas.length} rubricas divergentes`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function Empenhos({ dados }) {
  const [todos, setTodos] = useState(false);
  const semPar = dados.empenhosSemPar;
  const visiveis = todos ? semPar : semPar.slice(0, INICIAL);
  return (
    <section className="secao solta dupla">
      <div className="secao-cab">
        <h2 className="secao-titulo">Empenhos, um a um</h2>
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
                  {e.soBetha ? (
                    <span className="vermelho">
                      {numero(e.soBetha)}
                      <div className="sub">{moeda(e.valorSoBetha)}</div>
                    </span>
                  ) : (
                    <span className="apagado">0</span>
                  )}
                </td>
                <td className="num">
                  {e.soTce ? (
                    <span className="vermelho">
                      {numero(e.soTce)}
                      <div className="sub">{moeda(e.valorSoTce)}</div>
                    </span>
                  ) : (
                    <span className="apagado">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {semPar.length > 0 ? (
        <>
          <h3 className="secao-titulo" style={{ fontSize: 26, marginTop: 20 }}>
            Os {numero(semPar.length)} empenhos sem par
          </h3>
          <p className="nota">
            Registros “só na Betha” entram no total de empenhos exibido nas outras páginas. Quando o TCE tem o mesmo
            empenho com outro número, o registro da Betha provavelmente é uma versão antiga que não foi retirada do
            portal.
          </p>
          <div className="tabela-rolagem">
            <table style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th scope="col">Onde está</th>
                  <th scope="col">Empenho</th>
                  <th scope="col" className="num">
                    Valor
                  </th>
                  <th scope="col">Pista</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((e) => (
                  <tr key={`${e.fonte}|${e.id}`}>
                    <td>
                      <Situacao tipo={e.fonte === 'betha' ? 'soBetha' : 'soTce'} />
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="mono" style={{ fontWeight: 500 }}>
                        nº {e.numero}
                      </span>{' '}
                      · {e.entidade}
                      <div className="sub">{data(e.data)}</div>
                    </td>
                    <td className="num">{moeda(e.valor)}</td>
                    <td style={{ maxWidth: 420 }}>
                      <div className="historico" style={{ WebkitLineClamp: 'unset', display: 'block' }}>
                        {e.nota}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {semPar.length > INICIAL && (
            <button type="button" className="botao-link" onClick={() => setTodos(!todos)}>
              {todos ? 'Mostrar menos' : `Ver os ${semPar.length} empenhos sem par`}
            </button>
          )}
        </>
      ) : (
        <p className="nota-serif">Todos os empenhos comparados existem nas duas fontes, com o mesmo número, data e valor.</p>
      )}
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
