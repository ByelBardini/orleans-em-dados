import type { Meta } from '@orleans-em-dados/contracts';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { dataHora, milhoes, moeda, numero } from './format';

export type Anotacao = { texto: ReactNode; posicao?: CSSProperties };

export function Estado({ carregando, erro }: { carregando: boolean; erro?: string | null }) {
  if (erro) return <p className="aviso">Não foi possível carregar: {erro}</p>;
  if (carregando) return <p className="carregando">Carregando os números…</p>;
  return null;
}

// Célula da faixa de totais. `barra` (0–100) desenha o trilho embaixo.
export function Numero({
  rotulo,
  children,
  detalhe,
  barra,
  vermelho,
  selo,
  comparacao,
  className = '',
}: {
  rotulo: ReactNode;
  children: ReactNode;
  detalhe?: ReactNode;
  comparacao?: ReactNode;
  barra?: number;
  vermelho?: boolean;
  selo?: ReactNode;
  className?: string;
}) {
  return (
    <div className="numero-cel">
      <span className="rotulo">{rotulo}</span>
      <span className={`numero-valor ${vermelho ? 'vermelho' : ''} ${className}`}>{children}</span>
      {detalhe && <span className="numero-detalhe">{detalhe}</span>}
      {comparacao && <div className="numero-comparacao">{comparacao}</div>}
      {barra !== undefined && (
        <div className="trilho" aria-hidden="true">
          <span className={vermelho ? 'vermelho' : ''} style={{ width: `${Math.min(Math.max(barra, 0), 100)}%` }} />
        </div>
      )}
      {selo}
    </div>
  );
}

export const Mi = ({ valor }: { valor: number | null | undefined }) => (
  <>
    {milhoes(valor)}
    <small> mi</small>
  </>
);

export function Numeros({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <section aria-label={rotulo} className="numeros">
      <div className="numeros-grade">{children}</div>
    </section>
  );
}

// Nome … valor, com trilho proporcional ao maior item.
export type ItemDaLista = {
  chave?: string | null;
  nome: string;
  valor: number | null;
  cod?: ReactNode;
  dica?: string;
  selecionado?: boolean;
  vermelho?: boolean;
  cor?: string;
  extra?: ReactNode;
};

export function ListaPontos<I extends ItemDaLista>({
  itens,
  vermelho,
  total,
  aoClicar,
  comUnidade,
}: {
  itens: readonly I[];
  vermelho?: boolean;
  total?: number | null;
  aoClicar?: (item: I) => void;
  // Para a seção sem a legenda "R$ mi": sem unidade, o valor parece percentual.
  comUnidade?: boolean;
}) {
  const max = Math.max(...itens.map((i) => Number(i.valor)), 0) || 1;
  return (
    <ul className="lista-pontos">
      {itens.map((item) => (
        <li key={item.chave ?? item.nome} title={item.dica} className={item.selecionado ? 'is-selecionado' : undefined}>
          <div className="lp-linha">
            {item.cod && <span className="lp-cod">{item.cod}</span>}
            {aoClicar ? (
              <button type="button" className="lp-nome link-nome" onClick={() => aoClicar(item)}>
                {item.nome}
              </button>
            ) : (
              <span className="lp-nome">{item.nome}</span>
            )}
            <span className="lp-pontos" aria-hidden="true" />
            <span className="lp-valor">
              {item.valor === null ? '—' : comUnidade ? <Mi valor={item.valor} /> : milhoes(item.valor)}
            </span>
            {total && item.valor !== null && <span className="lp-pct">{pctCurto(item.valor, total)}</span>}
          </div>
          <div className="trilho" aria-hidden="true">
            <span
              className={(item.vermelho ?? vermelho) ? 'vermelho' : ''}
              style={{ width: `${(Math.max(Number(item.valor), 0) / max) * 100}%`, background: item.cor }}
            />
          </div>
          {item.extra && <span className="lp-extra">{item.extra}</span>}
        </li>
      ))}
    </ul>
  );
}

const pctCurto = (v: number | null, t: number | null) =>
  `${((Number(v) / Number(t)) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;

// Escala "redonda" para o eixo: 34 → passo 10, topo 40.
export function escala(maximo: number, linhas = 3): { topo: number; passos: number[] } {
  if (!(maximo > 0)) return { topo: 1, passos: [] };
  const bruto = maximo / linhas;
  const magnitude = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((p) => p >= bruto) as number;
  const topo = Math.ceil((maximo * 1.04) / passo) * passo;
  const passos: number[] = [];
  for (let v = passo; v < topo - passo / 1000; v += passo) passos.push(v);
  return { topo, passos };
}

const rotuloEixo = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

// Duas séries mês a mês, em milhões. `meses`: [{ rotulo, nome, a, b }].
export function BarrasMensais({
  meses,
  series,
  descricao,
  anotacao,
}: {
  meses: readonly { rotulo: string; nome: string; a: number | null; b: number | null }[];
  series: readonly [string, string];
  descricao: string;
  anotacao?: Anotacao | null;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const max = Math.max(...meses.flatMap((m) => [m.a ?? 0, m.b ?? 0])) / 1e6;
  const { topo, passos } = escala(max, 4);
  const altura = (v: number | null) => `${(Math.max(Number(v ?? 0), 0) / 1e6 / topo) * 100}%`;

  return (
    <>
      <div className="grafico" role="img" aria-label={descricao}>
        {passos.map((p) => (
          <div key={p} className="grade-y" style={{ bottom: `${(p / topo) * 100}%` }} aria-hidden="true">
            <span>{rotuloEixo(p)}</span>
          </div>
        ))}
        <div className="barras-mes">
          {meses.map((m, i) => (
            <div
              key={m.rotulo}
              className={`barras-mes-grupo${ativo === i ? ' is-ativo' : ''}`}
              onMouseEnter={() => setAtivo(i)}
              onMouseLeave={() => setAtivo(null)}
              onClick={() => setAtivo(ativo === i ? null : i)}
            >
              <span style={{ height: altura(m.a) }} />
              <span className="vermelho" style={{ height: altura(m.b) }} />
              {ativo === i && (
                <div className="dica" style={dicaNasBordas(i, meses.length)}>
                  <strong>{m.nome}</strong>
                  <div className="mono">
                    {series[0]}: R$ {milhoes(m.a ?? 0)} mi
                  </div>
                  <div className="mono vermelho">
                    {series[1]}: R$ {milhoes(m.b ?? 0)} mi
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {anotacao && (
          <div className="anotacao" style={anotacao.posicao}>
            <span>{anotacao.texto}</span>
          </div>
        )}
      </div>
      <div className="eixo-x" aria-hidden="true">
        {meses.map((m) => (
          <span key={m.rotulo}>{m.rotulo}</span>
        ))}
      </div>
    </>
  );
}

// Nas pontas, a dica abre para dentro do gráfico.
const dicaNasBordas = (i: number, n: number): CSSProperties | undefined =>
  i < 2 ? { left: 0, transform: 'none' } : i > n - 3 ? { left: 'auto', right: 0, transform: 'none' } : undefined;

// Ao lado da guia, sem cobrir as linhas: elas sobem, então o alto só fica livre enquanto o valor é baixo.
const dicaDaLinha = (i: number, alturaDoValor: number): CSSProperties => ({
  ...(i < 6
    ? { left: `calc(${(i / 11) * 100}% + 12px)` }
    : { left: 'auto', right: `calc(${100 - (i / 11) * 100}% + 12px)` }),
  ...(alturaDoValor > 0.6 ? { bottom: 12 } : { top: 4, bottom: 'auto' }),
  transform: 'none',
});

// Em décimos de milhão, para a diferença bater com os dois números arredondados da dica.
const diferencaDoRitmo = (arrecadado: number, previsto: number) => {
  const decimos = Math.round(previsto / 1e5) - Math.round(arrecadado / 1e5);
  if (decimos === 0) return 'No ritmo previsto';
  return `R$ ${milhoes(Math.abs(decimos) * 1e5)} mi ${decimos > 0 ? 'atrás do' : 'à frente do'} ritmo`;
};

// Acumulado do ano contra o ritmo previsto (meta ÷ 12 por mês).
export function LinhaAcumulada({
  acumulado,
  meta,
  rotulos,
  nomes,
  descricao,
  anotacao,
}: {
  acumulado: readonly number[];
  meta: number;
  rotulos: readonly string[];
  nomes: readonly (string | undefined)[];
  descricao: string;
  anotacao?: Anotacao | null;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const final = acumulado.at(-1) ?? 0;
  const { topo, passos } = escala(Math.max(meta, final) / 1e6, 4);
  const y = (v: number) => 300 - (v / 1e6 / topo) * 300;
  const x = (i: number) => (i / 11) * 1000;
  const linha = acumulado.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const pctY = (v: number) => `${(v / 1e6 / topo) * 100}%`;
  const acima = final >= meta;
  const previstoAte = (i: number) => (meta / 12) * (i + 1);

  return (
    <>
      <div className="grafico linha-acumulada">
        {passos.map((p) => (
          <div key={p} className="grade-y" style={{ bottom: `${(p / topo) * 100}%` }} aria-hidden="true">
            <span>{rotuloEixo(p)}</span>
          </div>
        ))}
        <div className="base" aria-hidden="true" />
        <svg role="img" aria-label={descricao} viewBox="0 0 1000 300" preserveAspectRatio="none">
          {meta > 0 && (
            <line
              x1="0"
              y1={y(meta / 12)}
              x2="1000"
              y2={y(meta)}
              stroke="var(--vermelho)"
              strokeWidth="2"
              strokeDasharray="6 5"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <polyline
            points={linha}
            fill="none"
            stroke="var(--tinta)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {ativo !== null && <div className="linha-guia" style={{ left: `${(ativo / 11) * 100}%` }} aria-hidden="true" />}
        {acumulado.map((v, i) => (
          <div
            key={rotulos[i]}
            className={`ponto${ativo === i ? ' is-ativo' : ''}`}
            style={{ left: `${(i / 11) * 100}%`, bottom: pctY(v) }}
            aria-hidden="true"
          />
        ))}
        {ativo !== null && meta > 0 && (
          <div
            className="ponto previsto is-ativo"
            style={{ left: `${(ativo / 11) * 100}%`, bottom: pctY(previstoAte(ativo)) }}
            aria-hidden="true"
          />
        )}
        {meta > 0 && (
          <div
            className="rotulo-fim"
            style={{ bottom: acima ? `calc(${pctY(meta)} - 46px)` : `calc(${pctY(meta)} + 6px)` }}
          >
            <span className="italico vermelho" style={{ fontSize: 18 }}>
              Previsto: {milhoes(meta)}
            </span>
          </div>
        )}
        <div
          className="rotulo-fim"
          style={{ right: 12, bottom: acima ? `calc(${pctY(final)} + 8px)` : `calc(${pctY(final)} - 34px)` }}
        >
          <span style={{ fontSize: 22 }}>{milhoes(final)}</span>
        </div>
        {anotacao && (
          <div className="anotacao" style={anotacao.posicao}>
            <span>{anotacao.texto}</span>
          </div>
        )}
        {/* A coluna inteira do mês responde ao mouse, e não só o ponto, e os meses sem dado também. */}
        {rotulos.map((r, i) => (
          <div
            key={r}
            className="linha-zona"
            style={{
              left: `${(Math.max(i - 0.5, 0) / 11) * 100}%`,
              width: `${((i === 0 || i === 11 ? 0.5 : 1) / 11) * 100}%`,
            }}
            onMouseEnter={() => setAtivo(i)}
            onMouseLeave={() => setAtivo(null)}
            onClick={() => setAtivo(i)}
          />
        ))}
        {ativo !== null && (
          <div
            className="dica"
            style={dicaDaLinha(ativo, Math.max(acumulado[ativo] ?? 0, previstoAte(ativo)) / 1e6 / topo)}
          >
            <strong>Até {nomes[ativo]}</strong>
            {acumulado[ativo] !== undefined && (
              <div className="mono">Arrecadado: R$ {milhoes(acumulado[ativo])} mi</div>
            )}
            {meta > 0 && <div className="mono vermelho">Previsto: R$ {milhoes(previstoAte(ativo))} mi</div>}
            {meta > 0 && acumulado[ativo] !== undefined && (
              <div className="mono">{diferencaDoRitmo(acumulado[ativo], previstoAte(ativo))}</div>
            )}
          </div>
        )}
      </div>
      <div className="eixo-x-abs" aria-hidden="true">
        {rotulos.map((r, i) => (
          <span key={r} style={{ left: `${(i / 11) * 100}%` }}>
            {r}
          </span>
        ))}
      </div>
    </>
  );
}

// Uma barra cheia dividida em partes. `partes`: [{ nome, valor, classe, detalhe }].
export function BarraDividida({
  partes,
  total,
  descricao,
  formatar = (v) => `${milhoes(v)} mi`,
}: {
  partes: readonly { nome: string; valor: number | null; classe?: string; detalhe?: ReactNode }[];
  total: number | null;
  descricao: string;
  /** O valor na legenda; por padrão, em milhões de reais. */
  formatar?: (valor: number) => string;
}) {
  const visiveis = partes.filter((p) => Number(p.valor) > 0);
  return (
    <>
      <div className="barra-dividida" role="img" aria-label={descricao}>
        {visiveis.map((p) => (
          <span
            key={p.nome}
            className={p.classe}
            title={`${p.nome}: ${formatar(Number(p.valor))}`}
            style={{ width: `${(Number(p.valor) / Number(total)) * 100}%` }}
          />
        ))}
      </div>
      <div className="legenda-grade">
        {visiveis.map((p) => (
          <div key={p.nome}>
            <span className={`amostra ${p.classe ?? ''}`} aria-hidden="true" />
            <span>
              <span className="mono" style={{ fontWeight: 500 }}>
                {formatar(Number(p.valor))} · {pctCurto(p.valor, total)}
              </span>
              <br />
              {p.nome}
              {p.detalhe && <span className="apagado"> ({p.detalhe})</span>}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/** A largura de uma barra da pirâmide: proporcional à maior faixa, de qualquer sexo. */
export const larguraDaFaixa = (valor: number, maximo: number) =>
  maximo > 0 ? `${Math.max((valor / maximo) * 100, 0)}%` : '0%';

// Homens à esquerda, mulheres à direita, os mais velhos em cima. A figura é para quem vê;
// a tabela, para o leitor de tela.
export function Piramide({
  faixas,
  descricao,
}: {
  faixas: readonly { faixa: string; homens: number; mulheres: number }[];
  descricao: string;
}) {
  const maximo = Math.max(...faixas.flatMap((f) => [f.homens, f.mulheres]), 0);
  const deCimaParaBaixo = [...faixas].reverse();
  return (
    <>
      <div className="piramide" role="img" aria-label={descricao}>
        <div className="piramide-cabecalho" aria-hidden="true">
          <span>Homens</span>
          <span />
          <span className="vermelho">Mulheres</span>
        </div>
        {deCimaParaBaixo.map((f) => (
          <div
            key={f.faixa}
            className="piramide-linha"
            title={`${f.faixa}: ${f.homens} homens, ${f.mulheres} mulheres`}
          >
            <span className="piramide-barra homens">
              <span style={{ width: larguraDaFaixa(f.homens, maximo) }} />
            </span>
            <span className="piramide-faixa">{f.faixa.replace(' anos', '')}</span>
            <span className="piramide-barra mulheres">
              <span style={{ width: larguraDaFaixa(f.mulheres, maximo) }} />
            </span>
          </div>
        ))}
      </div>
      <table className="visualmente-oculto" aria-label="Pirâmide etária por faixa de idade">
        <thead>
          <tr>
            <th scope="col">Faixa de idade</th>
            <th scope="col">Homens</th>
            <th scope="col">Mulheres</th>
          </tr>
        </thead>
        <tbody>
          {faixas.map((f) => (
            <tr key={f.faixa}>
              <th scope="row">{f.faixa}</th>
              <td>{numero(f.homens)}</td>
              <td>{numero(f.mulheres)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

const temaAtual = () =>
  document.documentElement.dataset.theme ??
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// Alterna entre papel claro e escuro; sem escolha salva, segue o sistema.
export function SeletorTema() {
  const [tema, setTema] = useState(temaAtual);
  const trocar = () => {
    const novo = tema === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = novo;
    try {
      localStorage.setItem('tema', novo);
    } catch {
      // localStorage indisponível (modo privado, bloqueado): o tema vale só nesta visita.
    }
    setTema(novo);
  };
  return (
    <button
      type="button"
      className="botao-tema"
      onClick={trocar}
      aria-label={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
    >
      <span aria-hidden="true">{tema === 'dark' ? '☀' : '☾'}</span> {tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
    </button>
  );
}

export function Alternador<V extends string>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string;
  opcoes: readonly { valor: V; nome: string }[];
  valor: V;
  aoMudar: (valor: V) => void;
}) {
  return (
    <div role="group" aria-label={rotulo} className="alternador">
      <span className="rotulo" aria-hidden="true">
        {rotulo}
      </span>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" aria-pressed={valor === o.valor} onClick={() => aoMudar(o.valor)}>
          {o.nome}
        </button>
      ))}
    </div>
  );
}

// Barra de ano e entidade, posicionada por cada página.
export type PropsDosFiltros = {
  anos: readonly number[];
  ano: number | null;
  setAno: (ano: number) => void;
  entidades: readonly { codigo: string; sigla: string; nome: string }[];
  entidade: string;
  setEntidade: (entidade: string) => void;
  children?: ReactNode;
};

export function Filtros({ anos, ano, setAno, entidades, entidade, setEntidade, children }: PropsDosFiltros) {
  return (
    <div className="barra-filtros">
      {anos.length > 0 && (
        <div className="campo">
          <label htmlFor="filtro-ano" className="rotulo">
            Ano
          </label>
          <select id="filtro-ano" value={ano ?? ''} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      )}
      {entidades.length > 0 && (
        <Alternador
          rotulo="Entidade"
          valor={entidade}
          aoMudar={setEntidade}
          opcoes={[{ valor: '', nome: 'Todas' }, ...entidades.map((e) => ({ valor: e.codigo, nome: e.sigla }))]}
        />
      )}
      {children}
    </div>
  );
}

const STATUS: Record<string, string> = {
  totalizador_conciliado: 'Somatório conciliado com o totalizador da fonte',
  exemplo: 'Dados fictícios de exemplo',
  coletado: 'Coletado, ainda não comparado',
};

// Metadados exibidos em toda seção: fonte, consulta, filtro, data de coleta e nível da conferência.
export function Fonte({ meta }: { meta: Meta | null | undefined }) {
  if (!meta) return null;
  return (
    <details className="fonte">
      <summary>
        Fonte: {meta.fonte} · consulta {meta.consultaId} · coletado em {dataHora(meta.coletadoEm)}
      </summary>
      <dl>
        <dt>Consulta</dt>
        <dd>
          <a href={meta.urlOrigem} target="_blank" rel="noreferrer">
            {meta.consultaNome} ({meta.consultaId})
          </a>
        </dd>
        <dt>Filtro</dt>
        <dd>
          <code>{JSON.stringify(meta.filtro)}</code>
        </dd>
        <dt>Registros</dt>
        <dd>
          {numero(meta.capturados)} de {numero(meta.totalHits)} ({numero(meta.idsUnicos)} IDs únicos)
        </dd>
        <dt>Conferência</dt>
        <dd>{STATUS[meta.status] ?? meta.status}</dd>
        {meta.conferencia.map((c) => (
          <div key={c.campo} className="fonte-conferencia">
            <dt>
              <code>{c.campo}</code>
            </dt>
            <dd>
              calculado {moeda(c.calculado)} · totalizador {moeda(c.fonte)} · diferença {moeda(c.diferenca)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
