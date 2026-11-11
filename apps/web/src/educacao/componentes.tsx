// As peças do caderno de Educação. Como a `Piramide`: a figura é para quem vê, a tabela, para o leitor de tela, e o
// valor sempre fica escrito, sem depender de `title`. Vermelho só para Orleans; nenhuma cor diz bom ou ruim.
import type { ComparacaoDeEducacao, FonteDoBloco, Meta, Rede } from '@orleans-em-dados/contracts';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { posicao, SETA } from '../comparacao';
import { escala as escalaRedonda, Fonte } from '../components';
import {
  alargarEscala,
  escalaDaComparacao,
  formatarMeta,
  formatarValor,
  LUGARES,
  NOMES_DE_ETAPA,
  NOMES_DE_REDE,
  posicaoNaEscala,
  redesComDado,
  rotuloDaRede,
  trechosDaSerie,
  type Escala,
  type Lugar,
  type PontoDaSerie,
  type UnidadeDaComparacao,
} from '../educacao';
import { Selo } from '../selo';
import { SELO_FONTE_UNICA, type DadosDoSelo } from '../selos';
import './componentes.css';

const noEixo = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function AvisoDeEscala({ escala: { min, max } }: { escala: Escala }) {
  if (min === 0) return null;
  return (
    <span className="edu-escala">
      A escala vai de {noEixo(min)} a {noEixo(max)}: não começa em zero.
    </span>
  );
}

// `rotulo` é o nome na tela; sem ele, o nome da etapa. `escala` é para o que não vai de zero, como o ENEM.
export function Comparacao({
  comparacao,
  rede,
  rotulo,
  escala,
  casas,
  semAvisoDeEscala = false,
  sentidoBom,
}: {
  comparacao: ComparacaoDeEducacao;
  rede: Rede;
  rotulo?: string;
  escala?: Escala;
  casas?: number;
  /** Várias comparações com a mesma escala: a página escreve o aviso uma vez só. */
  semAvisoDeEscala?: boolean;
  /** Só onde o sentido é claro: desenha a seta de Orleans diante de SC e do Brasil. */
  sentidoBom?: SentidoBom;
}) {
  const nome = rotulo ?? NOMES_DE_ETAPA[comparacao.etapa] ?? comparacao.indicador;
  const { ano, meta, unidade } = comparacao;
  const valores = comparacao.porRede[rede];
  const cabeca = (
    <span className="cmp-nome">
      <span>{nome}</span> <span className="cmp-ano">{ano}</span>
    </span>
  );
  if (!valores || LUGARES.every((l) => valores[l.chave] === null)) {
    return (
      <div className="cmp">
        {cabeca}
        <span className="cmp-sem-dado">Sem dado nesta rede.</span>
      </div>
    );
  }

  const faixa = escalaDaComparacao(comparacao, escala);
  const emTexto = (valor: number | null) => formatarValor(valor, unidade, casas);
  const naFigura = LUGARES.map(
    (l) => `${l.nome} ${valores[l.chave] === null ? 'sem dado' : emTexto(valores[l.chave])}`,
  ).join(', ');
  return (
    <div className="cmp">
      {cabeca}
      <span className="cmp-valores" aria-hidden="true">
        {LUGARES.map((l) => (
          <span key={l.chave} className={l.classe}>
            {l.curto} {emTexto(valores[l.chave])}
          </span>
        ))}
      </span>
      {sentidoBom && (
        <SetasDiante
          orleans={valores.orleans}
          santaCatarina={valores.santaCatarina}
          brasil={valores.brasil}
          unidade={unidade}
          sentidoBom={sentidoBom}
        />
      )}
      <div className="cmp-linha" role="img" aria-label={naFigura}>
        <span className="cmp-trilho" />
        {meta && <span className="cmp-meta" style={{ left: posicaoNaEscala(meta.valor, faixa) }} />}
        {LUGARES.map((l) => {
          const valor = valores[l.chave];
          return valor === null ? null : (
            <span key={l.chave} className={`cmp-ponto ${l.classe}`} style={{ left: posicaoNaEscala(valor, faixa) }} />
          );
        })}
      </div>
      {meta && (
        <span className="cmp-meta-texto" aria-hidden="true">
          Meta: {formatarMeta(meta.valor, unidade)} {meta.referencia}
        </span>
      )}
      {!semAvisoDeEscala && <AvisoDeEscala escala={faixa} />}
      <table className="visualmente-oculto" aria-label={`${nome}, ${rotuloDaRede(rede)}, ${ano}`}>
        <thead>
          <tr>
            <th scope="col">Lugar</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {LUGARES.map((l) => (
            <tr key={l.chave}>
              <th scope="row">{l.nome}</th>
              <td>{emTexto(valores[l.chave])}</td>
            </tr>
          ))}
          {meta && (
            <tr>
              <th scope="row">Meta: {meta.referencia}</th>
              <td>{formatarMeta(meta.valor, unidade)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// A rede sem dado em nenhuma das comparações da página fica desabilitada: ela não mostraria nada.
export function AlternadorDeRede({
  comparacoes,
  valor,
  aoMudar,
  rotulo = 'Rede',
}: {
  comparacoes: readonly Pick<ComparacaoDeEducacao, 'porRede'>[];
  valor: Rede;
  aoMudar: (rede: Rede) => void;
  rotulo?: string;
}) {
  const comDado = redesComDado(comparacoes);
  const redes = Object.keys(NOMES_DE_REDE) as Rede[];
  return (
    <div role="group" aria-label={rotulo} className="alternador alternador-de-rede">
      <span className="rotulo" aria-hidden="true">
        {rotulo}
      </span>
      {redes.map((rede) => (
        <button
          key={rede}
          type="button"
          aria-pressed={valor === rede}
          disabled={!comDado.includes(rede)}
          onClick={() => aoMudar(rede)}
        >
          {NOMES_DE_REDE[rede]}
        </button>
      ))}
    </div>
  );
}

/** Alternador de botões com uma escolha só, como o de rede, para opções fixas (nominal e corrigido, por exemplo). */
export function Alternador<T extends string>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string;
  opcoes: readonly { valor: T; nome: string }[];
  valor: T;
  aoMudar: (valor: T) => void;
}) {
  return (
    <div role="group" aria-label={rotulo} className="alternador">
      <span className="rotulo" aria-hidden="true">
        {rotulo}
      </span>
      {opcoes.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          aria-pressed={valor === opcao.valor}
          onClick={() => aoMudar(opcao.valor)}
        >
          {opcao.nome}
        </button>
      ))}
    </div>
  );
}

const ALTURA_DA_SERIE = 300;
const LARGURA_DA_SERIE = 1000;
const CLASSE_DO_LUGAR = Object.fromEntries(LUGARES.map((l) => [l.chave, l])) as Record<Lugar, (typeof LUGARES)[number]>;
const umDecimal = (v: number) => Number(v.toFixed(1));

// Ano sem dado quebra a linha. O eixo de baixo escolhe o ano, e os valores dele ficam escritos, em mouse, toque ou teclado.
export function SerieDoIdeb({
  series,
  descricao,
  escala = { min: 0, max: 10 },
  casas,
  unidade = 'indice',
  meta,
}: {
  series: readonly { lugar: Lugar; pontos: readonly PontoDaSerie[] }[];
  descricao: string;
  escala?: Escala;
  casas?: number;
  /** `indice` no IDEB; `%` serve à alfabetização, com a mesma leitura. */
  unidade?: UnidadeDaComparacao;
  /** A meta de Orleans, em marca vazada. Só os anos da série entram: meta futura não estica o eixo. */
  meta?: { rotulo: string; pontos: readonly PontoDaSerie[] };
}) {
  const anos = [...new Set(series.flatMap((s) => s.pontos.map((p) => p.ano)))].sort((a, b) => a - b);
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const [sobMouse, setSobMouse] = useState<number | null>(null);
  const ultimo = anos.at(-1);
  if (ultimo === undefined) return <p className="edu-sem-dado">Sem dado.</p>;

  const anoAtual = escolhido !== null && anos.includes(escolhido) ? escolhido : ultimo;
  const destacado = sobMouse ?? anoAtual;
  const eixoX = { min: anos[0] as number, max: ultimo };
  const metas = (meta?.pontos ?? []).flatMap((p) => (p.valor !== null && anos.includes(p.ano) ? [p] : []));
  const faixa = alargarEscala(escala, [
    ...series.flatMap((s) => s.pontos.flatMap((p) => (p.valor === null ? [] : [p.valor]))),
    ...metas.map((p) => p.valor as number),
  ]);
  const fracaoX = (ano: number) => (eixoX.max === eixoX.min ? 0 : (ano - eixoX.min) / (eixoX.max - eixoX.min));
  const fracaoY = (valor: number) => (valor - faixa.min) / (faixa.max - faixa.min);
  const emTexto = (valor: number | null) => formatarValor(valor, unidade, casas);
  const valorEm = (pontos: readonly PontoDaSerie[], ano: number) => pontos.find((p) => p.ano === ano)?.valor ?? null;
  // A zona de cada ano vai do meio do caminho até o vizinho: o mouse acha o ano sem mirar no ponto.
  const limites = anos.map((ano, i) => {
    const antes = i === 0 ? fracaoX(ano) : (fracaoX(anos[i - 1] as number) + fracaoX(ano)) / 2;
    const depois = i === anos.length - 1 ? fracaoX(ano) : (fracaoX(ano) + fracaoX(anos[i + 1] as number)) / 2;
    return {
      ano,
      esquerda: i === 0 ? 0 : antes,
      largura: (i === anos.length - 1 ? 1 : depois) - (i === 0 ? 0 : antes),
    };
  });
  const naDireita = fracaoX(destacado) > 0.6;

  return (
    <div className="ideb">
      <div className="ideb-area" onMouseLeave={() => setSobMouse(null)}>
        <div className="ideb-figura" role="img" aria-label={descricao}>
          {reguaDaEscala(faixa).map((marca) => (
            <span key={marca} className="ideb-grade" style={{ bottom: posicaoNaEscala(marca, faixa) }}>
              <span className="ideb-eixo-y" aria-hidden="true">
                {noEixo(marca)}
              </span>
            </span>
          ))}
          <span className="ideb-guia" style={{ left: posicaoNaEscala(destacado, eixoX) }} />
          <svg viewBox={`0 0 ${LARGURA_DA_SERIE} ${ALTURA_DA_SERIE}`} preserveAspectRatio="none" aria-hidden="true">
            {series.flatMap((s) =>
              trechosDaSerie(anos, s.pontos)
                .filter((trecho) => trecho.length > 1)
                .map((trecho) => (
                  <polyline
                    key={`${s.lugar}-${trecho[0]?.ano}`}
                    className={CLASSE_DO_LUGAR[s.lugar].classe}
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                    points={trecho
                      .map(
                        (p) =>
                          `${umDecimal(fracaoX(p.ano) * LARGURA_DA_SERIE)},${umDecimal((1 - fracaoY(p.valor)) * ALTURA_DA_SERIE)}`,
                      )
                      .join(' ')}
                  />
                )),
            )}
          </svg>
          {series.flatMap((s) =>
            s.pontos.flatMap((p) =>
              p.valor === null
                ? []
                : [
                    <span
                      key={`${s.lugar}-${p.ano}`}
                      className={`ideb-ponto ${CLASSE_DO_LUGAR[s.lugar].classe}${sobMouse === p.ano ? ' is-ativo' : ''}`}
                      style={{ left: posicaoNaEscala(p.ano, eixoX), bottom: posicaoNaEscala(p.valor, faixa) }}
                    />,
                  ],
            ),
          )}
          {metas.map((p) => (
            <span
              key={`meta-${p.ano}`}
              className={`ideb-meta${sobMouse === p.ano ? ' is-ativo' : ''}`}
              style={{ left: posicaoNaEscala(p.ano, eixoX), bottom: posicaoNaEscala(p.valor as number, faixa) }}
            />
          ))}
          {limites.map(({ ano, esquerda, largura }) => (
            <span
              key={ano}
              className="ideb-zona"
              data-ano={ano}
              aria-hidden="true"
              style={{ left: `${umDecimal(esquerda * 100)}%`, width: `${umDecimal(largura * 100)}%` }}
              onMouseEnter={() => setSobMouse(ano)}
            />
          ))}
          {sobMouse !== null && (
            <div
              className={`ideb-dica${naDireita ? ' a-esquerda' : ''}`}
              style={{ left: posicaoNaEscala(sobMouse, eixoX) }}
              aria-hidden="true"
            >
              <strong>{sobMouse}</strong>
              {series.map((s) => (
                <span key={s.lugar} className="ideb-dica-linha">
                  <span className={`cmp-amostra ${CLASSE_DO_LUGAR[s.lugar].classe}`} />
                  <span>{CLASSE_DO_LUGAR[s.lugar].nome}</span>
                  <span className={`ideb-dica-valor ${CLASSE_DO_LUGAR[s.lugar].classe}`}>
                    {emTexto(valorEm(s.pontos, sobMouse))}
                  </span>
                </span>
              ))}
              {meta && valorEm(metas, sobMouse) !== null && (
                <span className="ideb-dica-linha">
                  <span className="ideb-meta-amostra" />
                  <span>{meta.rotulo}</span>
                  <span className="ideb-dica-valor">{emTexto(valorEm(metas, sobMouse))}</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="ideb-anos" role="group" aria-label="Escolher o ano">
          {anos.map((ano) => (
            <button
              key={ano}
              type="button"
              aria-pressed={ano === anoAtual}
              style={{ left: posicaoNaEscala(ano, eixoX) }}
              onClick={() => setEscolhido(ano)}
            >
              {ano}
            </button>
          ))}
        </div>
      </div>
      <p className="ideb-valores" aria-hidden="true">
        <strong>{anoAtual}</strong>
        {series.map((s) => (
          <span key={s.lugar} className={CLASSE_DO_LUGAR[s.lugar].classe}>
            {CLASSE_DO_LUGAR[s.lugar].nome} {emTexto(valorEm(s.pontos, anoAtual))}
          </span>
        ))}
        {meta && valorEm(metas, anoAtual) !== null && (
          <span className="ideb-valores-meta">
            {meta.rotulo} {emTexto(valorEm(metas, anoAtual))}
          </span>
        )}
      </p>
      <AvisoDeEscala escala={faixa} />
      <table className="visualmente-oculto" aria-label={descricao}>
        <thead>
          <tr>
            <th scope="col">Ano</th>
            {series.map((s) => (
              <th key={s.lugar} scope="col">
                {CLASSE_DO_LUGAR[s.lugar].nome}
              </th>
            ))}
            {meta && <th scope="col">{meta.rotulo}</th>}
          </tr>
        </thead>
        <tbody>
          {anos.map((ano) => (
            <tr key={ano}>
              <th scope="row">{ano}</th>
              {series.map((s) => (
                <td key={s.lugar}>{emTexto(valorEm(s.pontos, ano))}</td>
              ))}
              {meta && <td>{emTexto(valorEm(metas, ano))}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Marcas da régua: cada inteiro, se couberem até 10; senão, 5 marcas redondas.
function reguaDaEscala({ min, max }: Escala): number[] {
  const bruto = (max - min) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(bruto));
  const passo = max - min <= 10 ? 1 : ([1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((q) => q >= bruto) as number);
  const marcas: number[] = [];
  for (let v = Math.ceil(min / passo) * passo; v <= max + 1e-9; v += passo) marcas.push(Number(v.toFixed(6)));
  return marcas;
}

const valoresPresentes = (lista: readonly { valor: number | null }[]) =>
  lista.flatMap((i) => (i.valor === null ? [] : [i.valor]));

// `formatar` troca o texto dos valores presentes (dinheiro, por exemplo); ano sem dado é travessão, sem barra.
function textoDoValor(
  unidade: UnidadeDaComparacao,
  casas: number | undefined,
  formatar: ((valor: number) => string) | undefined,
) {
  return (valor: number | null) =>
    valor !== null && formatar ? formatar(valor) : formatarValor(valor, unidade, casas);
}

// Uma barra por ano, com o valor em cima e, se houver, a linha de mínimo. As barras são de Orleans: a do ano sob o
// mouse ou com o foco fica vermelha e abre a dica. O mínimo não leva vermelho.
export function BarrasPorAno({
  barras,
  descricao,
  unidade = 'indice',
  casas,
  formatar,
  minimo,
  maximo,
  detalhar,
}: {
  /** `minimo` da barra: o mínimo muda de um ano para outro, como no Fundeb. */
  barras: readonly { ano: number | string; valor: number | null; minimo?: number }[];
  descricao: string;
  unidade?: UnidadeDaComparacao;
  casas?: number;
  formatar?: (valor: number) => string;
  minimo?: { valor: number; rotulo: string };
  /** O topo da escala; sem ele, um número redondo acima do maior valor. */
  maximo?: number;
  /** Uma linha a mais na dica, como o valor em reais por trás do percentual. */
  detalhar?: (barra: { ano: number | string; valor: number | null }) => ReactNode;
}) {
  const [ativa, setAtiva] = useState<number | string | null>(null);
  const dosAnos = barras.flatMap((b) => (b.minimo === undefined ? [] : [b.minimo]));
  const valores = [...valoresPresentes(barras), ...dosAnos, ...(minimo ? [minimo.valor] : [])];
  const faixa = alargarEscala({ min: 0, max: maximo ?? escalaRedonda(Math.max(...valores, 0), 4).topo }, valores);
  const emTexto = textoDoValor(unidade, casas, formatar);
  return (
    <div className="bpa">
      <div className="bpa-area" role="img" aria-label={descricao}>
        {minimo && (
          <div className="bpa-minimo" style={{ bottom: posicaoNaEscala(minimo.valor, faixa) }}>
            <span>
              {minimo.rotulo}: {emTexto(minimo.valor)}
            </span>
          </div>
        )}
        {barras.map((barra, i) => {
          const { ano, valor, minimo: doAno } = barra;
          const altura = valor === null ? '0%' : posicaoNaEscala(valor, faixa);
          const abrir = () => setAtiva(ano);
          const fechar = () => setAtiva((atual) => (atual === ano ? null : atual));
          return (
            <div
              key={ano}
              className={`bpa-coluna${ativa === ano ? ' is-ativa' : ''}`}
              data-ano={ano}
              tabIndex={0}
              onMouseEnter={abrir}
              onMouseLeave={fechar}
              onFocus={abrir}
              onBlur={fechar}
            >
              {valor !== null && <span className="bpa-barra" style={{ height: altura }} />}
              {doAno !== undefined && (
                <span className="bpa-minimo-do-ano" style={{ bottom: posicaoNaEscala(doAno, faixa) }} />
              )}
              <span className="bpa-valor" style={{ bottom: `calc(${altura} + 4px)` }}>
                {emTexto(valor)}
              </span>
              {ativa === ano && (
                <div
                  className={`bpa-dica${i >= barras.length / 2 ? ' a-esquerda' : ''}`}
                  style={{ bottom: `calc(${altura} + 34px)` }}
                  aria-hidden="true"
                >
                  <strong>{ano}</strong>
                  <span className="bpa-dica-valor">{emTexto(valor)}</span>
                  {detalhar && <span>{detalhar(barra)}</span>}
                  {doAno !== undefined && <span>Mínimo: {emTexto(doAno)}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="bpa-anos" aria-hidden="true">
        {barras.map(({ ano }) => (
          <span key={ano}>{ano}</span>
        ))}
      </div>
      <table className="visualmente-oculto" aria-label={descricao}>
        <thead>
          <tr>
            <th scope="col">Ano</th>
            <th scope="col">Valor</th>
            {dosAnos.length > 0 && <th scope="col">Mínimo</th>}
          </tr>
        </thead>
        <tbody>
          {barras.map(({ ano, valor, minimo: doAno }) => (
            <tr key={ano}>
              <th scope="row">{ano}</th>
              <td>{emTexto(valor)}</td>
              {dosAnos.length > 0 && <td>{emTexto(doAno ?? null)}</td>}
            </tr>
          ))}
          {minimo && (
            <tr>
              <th scope="row">{minimo.rotulo}</th>
              <td>{emTexto(minimo.valor)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// A dica fica sob a fatia, centrada nela; da metade para a direita, abre para a esquerda.
function DicaDaFatia({
  partes,
  parte,
  soma,
  rotulo,
  emTexto,
}: {
  partes: readonly { nome: string; valor: number | null }[];
  parte: string;
  soma: number;
  rotulo: string;
  emTexto: (valor: number | null) => string;
}) {
  const indice = partes.findIndex((p) => p.nome === parte);
  const daParte = partes[indice];
  if (!daParte || daParte.valor === null || soma <= 0) return null;
  const antes = valoresPresentes(partes.slice(0, indice)).reduce((a, b) => a + b, 0);
  const meio = (antes + daParte.valor / 2) / soma;
  return (
    <div
      className={`bpa-dica emp-dica${meio > 0.5 ? ' emp-dica-esquerda' : ''}`}
      style={{ left: `${Number((meio * 100).toFixed(2))}%` }}
      aria-hidden="true"
    >
      <strong>{rotulo}</strong>
      <span>{daParte.nome}</span>
      <span className="bpa-dica-valor emp-dica-valor">{emTexto(daParte.valor)}</span>
    </div>
  );
}

// Tons neutros e hachura, pela posição da parte: nenhuma parte é o vermelho, nem boa ou ruim. Parte nula não tem fatia.
export function BarrasEmpilhadas({
  linhas,
  descricao,
  unidade = '%',
  casas,
  formatar,
}: {
  /** `apoio`, opcional: uma linha curta embaixo dos valores da barra (a comparação com SC e o Brasil, por exemplo). */
  linhas: readonly {
    rotulo: string;
    partes: readonly { nome: string; valor: number | null }[];
    apoio?: ReactNode;
  }[];
  descricao: string;
  unidade?: UnidadeDaComparacao;
  casas?: number;
  formatar?: (valor: number) => string;
}) {
  const nomes = [...new Set(linhas.flatMap((l) => l.partes.map((p) => p.nome)))];
  const tom = (nome: string) => `emp-tom-${nomes.indexOf(nome) % 5}`;
  const emTexto = textoDoValor(unidade, casas, formatar);
  const temApoio = linhas.some((l) => l.apoio !== undefined);
  // A fatia sob o mouse ou com o foco ganha contorno e abre a dica; nenhuma vira vermelha.
  const [ativa, setAtiva] = useState<{ linha: string; parte: string } | null>(null);
  return (
    <div className="emp">
      <div className="emp-legenda" aria-hidden="true">
        {nomes.map((nome) => (
          <span key={nome}>
            <i className={tom(nome)} />
            {nome}
          </span>
        ))}
      </div>
      <div className="emp-linhas" role="img" aria-label={descricao}>
        {linhas.map(({ rotulo, partes, apoio }) => {
          const presentes = valoresPresentes(partes);
          // A soma só dá a largura de cada fatia: nenhum total sai daqui.
          const soma = presentes.reduce((a, b) => a + b, 0);
          return (
            <div key={rotulo} className="emp-linha">
              <span className="emp-rotulo">{rotulo}</span>
              {presentes.length ? (
                <>
                  <div className="emp-trilho" onMouseLeave={() => setAtiva(null)}>
                    <div className={`emp-barra${ativa?.linha === rotulo ? ' tem-ativa' : ''}`}>
                      {partes.flatMap((p) => {
                        if (p.valor === null) return [];
                        const eAtiva = ativa?.linha === rotulo && ativa.parte === p.nome;
                        const abrir = () => setAtiva({ linha: rotulo, parte: p.nome });
                        const fechar = () =>
                          setAtiva((atual) =>
                            atual === null || (atual.linha === rotulo && atual.parte === p.nome) ? null : atual,
                          );
                        return [
                          <span
                            key={p.nome}
                            className={eAtiva ? `${tom(p.nome)} is-ativa` : tom(p.nome)}
                            data-parte={p.nome}
                            tabIndex={0}
                            style={{ width: posicaoNaEscala(p.valor, { min: 0, max: soma }) }}
                            onMouseEnter={abrir}
                            onMouseLeave={fechar}
                            onFocus={abrir}
                            onBlur={fechar}
                          />,
                        ];
                      })}
                    </div>
                    {ativa?.linha === rotulo && (
                      <DicaDaFatia partes={partes} parte={ativa.parte} soma={soma} rotulo={rotulo} emTexto={emTexto} />
                    )}
                  </div>
                  <div className="emp-valores">
                    {partes.map((p) => (
                      <span key={p.nome}>
                        <i className={`emp-amostra ${tom(p.nome)}`} aria-hidden="true" />
                        {p.nome} {emTexto(p.valor)}
                      </span>
                    ))}
                  </div>
                  {apoio !== undefined && <div className="emp-apoio">{apoio}</div>}
                </>
              ) : (
                <span className="edu-sem-dado">Sem dado.</span>
              )}
            </div>
          );
        })}
      </div>
      <table className="visualmente-oculto" aria-label={descricao}>
        <thead>
          <tr>
            <th scope="col">Linha</th>
            {nomes.map((nome) => (
              <th key={nome} scope="col">
                {nome}
              </th>
            ))}
            {temApoio && <th scope="col">Comparação</th>}
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ rotulo, partes, apoio }) => (
            <tr key={rotulo}>
              <th scope="row">{rotulo}</th>
              {nomes.map((nome) => (
                <td key={nome}>{emTexto(partes.find((p) => p.nome === nome)?.valor ?? null)}</td>
              ))}
              {temApoio && <td>{apoio ?? '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ItemDaBarra = { nome: string; valor: number | null; semValor?: ReactNode };

// Uma barra por item, com o valor escrito ao lado do nome. Os itens são de Orleans: o item sob o mouse ou com o foco
// fica vermelho e abre a dica. Item sem valor mostra `semValor` (ou travessão), sem barra e sem foco.
export function BarrasHorizontais<T extends ItemDaBarra>({
  itens,
  descricao,
  formatar,
  detalhar,
}: {
  itens: readonly T[];
  descricao: string;
  formatar: (valor: number) => string;
  /** Uma linha a mais na dica, como a parte do total. */
  detalhar?: (item: T) => ReactNode;
}) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const maior = Math.max(...valoresPresentes(itens), 0);
  return (
    <ul className="bh" aria-label={descricao}>
      {itens.map((item) => {
        const { nome, valor } = item;
        if (valor === null) {
          return (
            <li key={nome} className="bh-item">
              <span className="bh-cab">
                <span className="bh-nome">{nome}</span> <span className="bh-sem-valor">{item.semValor ?? '—'}</span>
              </span>
            </li>
          );
        }
        const abrir = () => setAtivo(nome);
        const fechar = () => setAtivo((atual) => (atual === nome ? null : atual));
        const largura = maior > 0 ? posicaoNaEscala(valor, { min: 0, max: maior }) : '0%';
        return (
          <li
            key={nome}
            className={`bh-item${ativo === nome ? ' is-ativa' : ''}`}
            tabIndex={0}
            onMouseEnter={abrir}
            onMouseLeave={fechar}
            onFocus={abrir}
            onBlur={fechar}
          >
            <span className="bh-cab">
              <span className="bh-nome">{nome}</span> <span className="bh-valor">{formatar(valor)}</span>
            </span>
            <span className="bh-trilho" aria-hidden="true">
              <span className="bh-barra" style={{ width: largura }} />
            </span>
            {ativo === nome && (
              <div className="bpa-dica bh-dica" aria-hidden="true">
                <strong>{nome}</strong>
                <span className="bpa-dica-valor">{formatar(valor)}</span>
                {detalhar && <span>{detalhar(item)}</span>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Um bloco do caderno: o selo fica no título, e o padrão é fonte única. `fonte` é a origem do bloco; `meta`, a coleta.
export function BlocoDoCaderno({
  titulo,
  selo = SELO_FONTE_UNICA,
  nota,
  fonte,
  ano,
  meta,
  children,
}: {
  titulo: ReactNode;
  selo?: DadosDoSelo | null;
  nota?: ReactNode;
  fonte?: FonteDoBloco | null;
  /** O ano ao lado da fonte, em texto: a transição é `2021-2022`. */
  ano?: string | number;
  meta?: Meta | null;
  children?: ReactNode;
}) {
  const idDoTitulo = useId();
  return (
    <section className="secao bloco-caderno" aria-labelledby={idDoTitulo}>
      <div className="bloco-cab">
        <h2 id={idDoTitulo} className="secao-titulo">
          {titulo}
        </h2>
        <Selo selo={selo} />
      </div>
      {children}
      {nota && <div className="bloco-nota">{nota}</div>}
      {fonte && (
        <p className="bloco-fonte">
          Fonte:{' '}
          <a href={fonte.url} target="_blank" rel="noreferrer">
            {fonte.nome}
          </a>
          {ano !== undefined && ` · ${ano}`}
        </p>
      )}
      <Fonte meta={meta} />
    </section>
  );
}

function LegendaDaComparacao() {
  return (
    <div className="caderno-legenda" aria-label="Legenda das comparações" role="group">
      <span className="rotulo">Comparação</span>
      {LUGARES.map((l) => (
        <span key={l.chave} className="caderno-legenda-item">
          <i className={`cmp-amostra ${l.classe}`} aria-hidden="true" />
          {l.nome}
        </span>
      ))}
    </div>
  );
}

// A abertura de cada aba. `semLegenda`, na aba em que nada compara os três lugares.
export function CabecalhoDoCaderno({
  titulo,
  children,
  semLegenda = false,
}: {
  titulo: ReactNode;
  children?: ReactNode;
  semLegenda?: boolean;
}) {
  return (
    <div className="caderno-cabecalho">
      {!semLegenda && <LegendaDaComparacao />}
      <h1 className="caderno-titulo">{titulo}</h1>
      {children && <p className="caderno-entrada">{children}</p>}
    </div>
  );
}

// Onde o sentido é claro (mais alfabetizados é melhor, menos abandono é melhor), Orleans diante de SC e do Brasil leva
// seta e quanto: em pontos, quando o valor já é percentual; em percentual do outro lugar, nos demais. Verde e vermelho
// só aqui, e só com o sentido declarado por quem chama; sem ele, nada é dito.
export type SentidoBom = 'maior' | 'menor';

const DIANTE_DE = [
  { chave: 'santaCatarina', de: 'de SC' },
  { chave: 'brasil', de: 'do Brasil' },
] as const;

export function SetasDiante({
  orleans,
  santaCatarina,
  brasil,
  unidade,
  sentidoBom,
}: {
  orleans: number | null;
  santaCatarina?: number | null;
  brasil?: number | null;
  unidade: UnidadeDaComparacao;
  sentidoBom: SentidoBom;
}) {
  const outros = { santaCatarina: santaCatarina ?? null, brasil: brasil ?? null };
  const em = unidade === '%' ? 'pontos' : 'percentual';
  const itens = DIANTE_DE.flatMap(({ chave, de }) => {
    const onde = posicao(orleans, outros[chave], {
      em,
      maiorEBom: sentidoBom === 'maior',
      menorEBom: sentidoBom === 'menor',
    });
    return onde ? [{ chave, de, onde }] : [];
  });
  if (itens.length === 0) return null;
  return (
    <ul className="cmp-diante">
      {itens.map(({ chave, de, onde }) => (
        <li key={chave} className={onde.tom ?? undefined}>
          <span aria-hidden="true">{SETA[onde.sentido]}</span>{' '}
          {onde.sentido === 'igual'
            ? `igual ao valor ${de}`.replace('ao valor de SC', 'a SC').replace('ao valor do Brasil', 'ao Brasil')
            : `${onde.texto} ${onde.sentido} ${de}`}
        </li>
      ))}
    </ul>
  );
}

// Nota e fonte saem do corpo e ficam aqui: um botão discreto abre o painel ao passar o mouse, focar ou tocar, e o
// clique o deixa aberto, para dar tempo de seguir um link. Esc e o toque fora fecham.
export function Detalhes({ rotulo = 'Fonte e detalhes', children }: { rotulo?: string; children: ReactNode }) {
  const [aberto, setAberto] = useState<'mouse' | 'fixo' | null>(null);
  const raiz = useRef<HTMLSpanElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idDoPainel = useId();
  const cancelar = () => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
  };
  const abrirPeloMouse = () => {
    cancelar();
    setAberto((atual) => atual ?? 'mouse');
  };
  // Um respiro antes de fechar: o mouse atravessa o vão entre o botão e o painel.
  const sairComMouse = () => {
    cancelar();
    espera.current = setTimeout(() => setAberto((atual) => (atual === 'mouse' ? null : atual)), 150);
  };

  useEffect(() => {
    if (!aberto) return;
    const aoTocar = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(null);
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(null);
    };
    document.addEventListener('pointerdown', aoTocar);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('pointerdown', aoTocar);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);
  useEffect(() => cancelar, []);

  return (
    <span
      ref={raiz}
      className={`detalhes${aberto ? ' aberto' : ''}`}
      onMouseEnter={abrirPeloMouse}
      onMouseLeave={sairComMouse}
    >
      <button
        type="button"
        className="detalhes-botao"
        aria-expanded={aberto !== null}
        aria-controls={idDoPainel}
        onClick={() => setAberto((atual) => (atual === 'fixo' ? null : 'fixo'))}
        onFocus={abrirPeloMouse}
      >
        <span aria-hidden="true">ⓘ</span> {rotulo}
      </button>
      <span id={idDoPainel} className="detalhes-painel" hidden={aberto === null}>
        {aberto !== null && children}
      </span>
    </span>
  );
}

// Tabela que não cabe esticada: um quadro por grupo (etapa, ano, rede), lado a lado, cada um com a própria tabela
// curta. A coluna em `destaque` é a de Orleans.
export type LinhaDoQuadro = { nome: ReactNode; apoio?: ReactNode; celulas: readonly ReactNode[] };

export function Quadros({
  rotulo,
  colunas,
  grupos,
}: {
  rotulo: string;
  colunas: readonly { nome: string; destaque?: boolean }[];
  grupos: readonly { titulo: string; linhas: readonly LinhaDoQuadro[]; nota?: ReactNode }[];
}) {
  return (
    <div className="quadros">
      {grupos.map((grupo) => (
        <section key={grupo.titulo} className="quadro">
          <h3 className="quadro-titulo">{grupo.titulo}</h3>
          <table aria-label={`${rotulo}, ${grupo.titulo}`}>
            <thead>
              <tr>
                <td />
                {colunas.map((c) => (
                  <th key={c.nome} scope="col" className={c.destaque ? 'quadro-col-destaque' : undefined}>
                    {c.nome}
                  </th>
                ))}
              </tr>
            </thead>
            {/* Um tbody por indicador: o indicador e o apoio dele (as setas, uma ressalva, na largura do quadro, sem
                espremer o nome) são um item só, e o realce do mouse cobre os dois. */}
            {grupo.linhas.map((linha, i) => (
              <tbody key={i} className="quadro-item">
                <tr className={linha.apoio ? 'com-apoio' : undefined}>
                  <th scope="row">{linha.nome}</th>
                  {linha.celulas.map((celula, j) => (
                    <td key={j}>
                      <span className={colunas[j]?.destaque ? 'quadro-destaque' : undefined}>{celula}</span>
                    </td>
                  ))}
                </tr>
                {linha.apoio && (
                  <tr className="quadro-linha-apoio">
                    <td colSpan={colunas.length + 1}>
                      <div className="quadro-apoio">{linha.apoio}</div>
                    </td>
                  </tr>
                )}
              </tbody>
            ))}
          </table>
          {grupo.nota && <p className="quadro-nota">{grupo.nota}</p>}
        </section>
      ))}
    </div>
  );
}
