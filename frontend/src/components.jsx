import { useState } from 'react';
import { dataHora, moeda, moedaCompacta, numero } from './format.js';

export function Estado({ carregando, erro }) {
  if (erro) return <p className="aviso aviso-erro">Não foi possível carregar: {erro}</p>;
  if (carregando) return <p className="carregando">Carregando…</p>;
  return null;
}

export function Kpi({ rotulo, valor, texto, detalhe }) {
  return (
    <div className="kpi">
      <span className="kpi-rotulo">{rotulo}</span>
      <strong className="kpi-valor">{texto ?? moeda(valor)}</strong>
      {detalhe && <span className="kpi-detalhe">{detalhe}</span>}
    </div>
  );
}

export function Painel({ titulo, subtitulo, children, acoes }) {
  return (
    <section className="painel">
      <header className="painel-cabecalho">
        <div>
          <h3>{titulo}</h3>
          {subtitulo && <p className="painel-subtitulo">{subtitulo}</p>}
        </div>
        {acoes}
      </header>
      {children}
    </section>
  );
}

const STATUS = {
  totalizador_conciliado: 'Somatório conciliado com o totalizador da fonte',
  exemplo: 'Dados fictícios de exemplo',
  coletado: 'Coletado, ainda não comparado',
};

// Metadados exibidos em toda seção: fonte, consulta, filtro, data de coleta e nível de validação.
export function Fonte({ meta }) {
  if (!meta) return null;
  return (
    <details className="fonte">
      <summary>
        Fonte: {meta.fonte} · consulta <code>{meta.consultaId}</code> · coletado em {dataHora(meta.coletadoEm)}
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
        <dt>Validação</dt>
        <dd>{STATUS[meta.status] ?? meta.status}</dd>
        {meta.conferencia?.map((c) => (
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

// Série única: um só tom, sem legenda (o título do painel nomeia a série).
export function BarrasVerticais({ itens, rotuloValor }) {
  const [ativo, setAtivo] = useState(null);
  const max = Math.max(...itens.map((i) => i.valor), 0) || 1;
  return (
    <div className="barras-v" role="img" aria-label={rotuloValor}>
      <div className="barras-v-area">
        {itens.map((item, i) => (
          <div
            key={item.rotulo}
            className="barras-v-coluna"
            onMouseEnter={() => setAtivo(i)}
            onMouseLeave={() => setAtivo(null)}
          >
            {ativo === i && (
              <div className="tooltip">
                <span>{item.rotulo}</span>
                <strong>{moeda(item.valor)}</strong>
              </div>
            )}
            <div
              className={`barras-v-barra${ativo === i ? ' is-ativo' : ''}`}
              style={{ height: `${(Math.max(item.valor, 0) / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="barras-v-eixo">
        {itens.map((item) => (
          <span key={item.rotulo}>{item.rotulo}</span>
        ))}
      </div>
    </div>
  );
}

export function BarrasHorizontais({ itens }) {
  const max = Math.max(...itens.map((i) => Math.abs(i.valor)), 0) || 1;
  return (
    <ul className="barras-h">
      {itens.map((item) => (
        <li key={item.rotulo} title={`${item.rotulo}: ${moeda(item.valor)}`}>
          <span className="barras-h-rotulo">{item.rotulo}</span>
          <span className="barras-h-trilho">
            <span className="barras-h-barra" style={{ width: `${(Math.max(item.valor, 0) / max) * 100}%` }} />
          </span>
          <span className="barras-h-valor">{moedaCompacta(item.valor)}</span>
        </li>
      ))}
    </ul>
  );
}
