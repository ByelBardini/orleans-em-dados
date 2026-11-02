import {
  conferenciaSchema,
  despesasResumoSchema,
  discrepanciasSchema,
  empenhosResumoSchema,
  receitasSchema,
  type Conferencia as DadosDaConferencia,
  type Discrepancias as DadosDaSecao,
} from '@orleans-em-dados/contracts';
import { useState } from 'react';
import { useApi } from '../api';
import { Estado, Filtros } from '../components';
import { ContaDaDespesa, ContaDaReceita, ContaDosEmpenhos, FRASE_DA_DIFERENCA, SemConferencia } from '../conferido';
import { data, dataHora, MESES, MESES_LONGOS, moeda, numero } from '../format';
import { Selo } from '../selo';
import { seloDaSituacao, type SituacaoDoCaso } from '../selos';
import type { PropsDaPagina } from './props';

const N = Number;
const RELATORIO = 'https://github.com/ByelBardini/orleans-em-dados/blob/main/docs/CONFERENCIA_BETHA_TCE.md';
const CASOS_INICIAIS = 10;

type Grupo = DadosDaSecao['grupos'][number];
type Item = Grupo['itens'][number];
type Area = Grupo['area'];
type PropsDeConteudo = Pick<PropsDaPagina, 'ano' | 'entidade' | 'filtros'>;

// Receita, despesa e empenhos são visões que não se somam: cada área tem o seu bloco.
const AREAS: readonly { id: Area; titulo: string; legenda: string }[] = [
  { id: 'receita', titulo: 'Receita', legenda: 'Betha 57153 × TCE-SC · o que difere em cada natureza' },
  { id: 'despesa', titulo: 'Despesa', legenda: 'Betha 57170 × TCE-SC · empenhado, liquidado e pago' },
  { id: 'empenho', titulo: 'Empenhos', legenda: 'Betha 57140 × TCE-SC · registro a registro, em valor original' },
];

// Dinheiro soma em centavos inteiros, nunca em ponto flutuante.
const somaEmCentavos = <T,>(lista: readonly T[], valor: (item: T) => number) =>
  lista.reduce((soma, item) => soma + Math.round(valor(item) * 100), 0) / 100;

const descricaoCurta = (d: string | null | undefined) => (d ? d.replace(/\s*-\s*Principal$/i, '') : null);

// Diferença Betha − TCE dita por extenso, nunca com sinal: "R$ 1,00 a mais na Betha" / "a mais no TCE" / "igual".
function Diferenca({ valor }: { valor: number | null | undefined }) {
  if (valor === null || valor === undefined) return <span className="apagado">—</span>;
  if (N(valor) === 0) return <span className="apagado">igual</span>;
  return (
    <span>
      {moeda(Math.abs(N(valor)))}{' '}
      <span className="diferenca-lado">{N(valor) > 0 ? 'a mais na Betha' : 'a mais no TCE'}</span>
    </span>
  );
}

export default function Discrepancias({ ano, entidade, filtros }: PropsDaPagina) {
  const { dados, carregando, erro } = useApi(`/api/discrepancias?ano=${ano}`, discrepanciasSchema);
  return (
    <>
      {erro && <Filtros {...filtros} />}
      <Estado carregando={carregando} erro={erro} />
      {dados && !dados.disponivel && (
        <>
          <Filtros {...filtros} />
          <SemConferencia ano={ano} faltando={dados.faltando} />
        </>
      )}
      {dados?.disponivel && <Conteudo ano={ano} entidade={entidade} filtros={filtros} dados={dados} />}
    </>
  );
}

/** Com o filtro de entidade: só os casos dela, com o total deles. Sem filtro: o total da resposta. */
function recortar(grupo: Grupo, entidade: string): Grupo {
  if (!entidade) return grupo;
  const itens = grupo.itens.filter((i) => i.codigoEntidade === entidade);
  return { ...grupo, itens, total: somaEmCentavos(itens, (i) => i.valor) };
}

function Conteudo({ ano, entidade, filtros, dados }: PropsDeConteudo & { dados: DadosDaSecao }) {
  const grupos = dados.grupos.map((g) => recortar(g, entidade)).filter((g) => g.itens.length > 0);
  const casos = grupos.reduce((total, g) => total + g.itens.length, 0);
  const { parcial, limites } = dados;
  const mesLimite = limites?.mesReceita ? MESES_LONGOS[limites.mesReceita - 1] : null;
  const quando = parcial && mesLimite ? `Até ${mesLimite} de ${ano}` : `Em ${ano}`;

  return (
    <>
      <div className="abertura">
        <h1 className="manchete">
          {casos > 0 ? (
            <>
              {quando},{' '}
              <em>
                {numero(casos)} {casos === 1 ? 'caso' : 'casos'}
              </em>{' '}
              em que Betha e TCE-SC não coincidem.
            </>
          ) : (
            <>
              {quando}, Betha e TCE-SC mostram <em>os mesmos números</em>.
            </>
          )}
        </h1>
        <div className="abertura-lado">
          <p className="capitular">
            Esta seção mostra cada valor que ficou fora do número principal do painel, separado por tipo, com o que cada
            fonte registra. O Portal da Transparência (Betha) é o que o município publica. O Farol do TCE-SC reúne o que
            o município envia ao Tribunal de Contas. {FRASE_DA_DIFERENCA}
          </p>
        </div>
      </div>

      <Filtros {...filtros} />

      {parcial && (
        <p className="aviso-neutro">
          O TCE-SC recebe os dados com atraso: por enquanto, tem receitas até <strong>{mesLimite}</strong> e empenhos
          até <strong>{data(limites?.dataEmpenho)}</strong>. As comparações se limitam a esse período. O que veio depois
          ainda não foi conferido e não conta como diferença.
        </p>
      )}

      <ContasDoAno ano={ano} entidade={entidade} dados={dados} grupos={grupos} />

      {casos > 0 && <SignificadoDasSituacoes />}

      {AREAS.map((area) => (
        <BlocoDaArea key={area.id} {...area} grupos={grupos.filter((g) => g.area === area.id)} />
      ))}

      <Aguardando aguardando={dados.aguardando} entidade={entidade} />

      <OsTotais ano={ano} entidade={entidade} filtros={filtros} />
    </>
  );
}

// A conta do ano, uma por área: conferido + em discrepância = total da fonte.
function ContasDoAno({
  ano,
  entidade,
  dados,
  grupos,
}: {
  ano: number;
  entidade: string;
  dados: DadosDaSecao;
  grupos: readonly Grupo[];
}) {
  const consulta = new URLSearchParams({ ano: String(ano), entidade });
  const receita = useApi(`/api/receitas?${consulta}`, receitasSchema);
  const despesa = useApi(`/api/despesas/resumo?${consulta}`, despesasResumoSchema);
  const empenhos = useApi(`/api/despesas/empenhos/resumo?${consulta}`, empenhosResumoSchema);
  const erro = receita.erro ?? despesa.erro ?? empenhos.erro;
  const carregando = receita.carregando || despesa.carregando || empenhos.carregando;

  const registros = grupos.filter((g) => g.area === 'empenho').flatMap((g) => g.itens);
  const daFonte = (fonte: Item['fonte']) =>
    somaEmCentavos(
      registros.filter((i) => i.fonte === fonte),
      (i) => i.valor,
    );
  const aguardandoDaEntidade = dados.aguardando.despesa.itens.filter((i) => !entidade || i.codigoEntidade === entidade);
  const aguardando = somaEmCentavos(aguardandoDaEntidade, (i) => i.valor);
  const conferido = empenhos.dados?.totais.empenhado ?? null;
  const emDiscrepancia = daFonte('betha');
  // O totalizador da 57140 é do município: com o filtro de entidade, sobra a soma das partes.
  const totalizador = empenhos.dados?.meta.conferencia.find((c) => c.campo === 'valorEmpenho')?.fonte;
  const soma = somaEmCentavos([conferido ?? 0, emDiscrepancia, aguardando], (v) => v);
  const totalDaFonte = entidade ? soma : (totalizador ?? soma);

  return (
    <section className="secao solta" aria-label="A conta do ano">
      <div className="secao-cab">
        <h2 className="secao-titulo">A conta do ano</h2>
        <span className="legenda">
          <span>Conferido + em discrepância = total da fonte, por área. As áreas não se somam.</span>
        </span>
      </div>
      <Estado carregando={carregando && !erro} erro={erro} />
      {receita.dados && despesa.dados && empenhos.dados && (
        <>
          <div className="contas-do-ano">
            <div>
              <h3 className="rotulo">Receita arrecadada</h3>
              <ContaDaReceita conferencia={receita.dados.conferencia} semLink titulo="A conta da receita" />
            </div>
            <div>
              <h3 className="rotulo">Despesa empenhada</h3>
              {despesa.dados.conferencia.totalBetha === null ? (
                <p className="conta-nota">
                  No ano em curso, a despesa não tem esta conta: o conferido é o valor líquido do TCE-SC, e o que
                  aguarda é o valor original da Betha.
                </p>
              ) : (
                <ContaDaDespesa
                  conferido={despesa.dados.totais.empenhado}
                  conferencia={despesa.dados.conferencia}
                  semLink
                  titulo="A conta da despesa"
                />
              )}
            </div>
            <div>
              <h3 className="rotulo">Empenhos, em valor original</h3>
              <ContaDosEmpenhos
                conferido={conferido}
                emDiscrepancia={emDiscrepancia}
                aguardando={aguardando}
                total={totalDaFonte}
                soNoTce={daFonte('tce')}
                titulo="A conta dos empenhos"
              />
            </div>
          </div>
          <p className="nota-serif">
            A conta usa o sinal de cada valor; cada grupo soma os casos sem sinal, para mostrar o tamanho de cada tipo.
            Por isso, os grupos somados podem não repetir o “em discrepância” da conta.
          </p>
        </>
      )}
    </section>
  );
}

const SITUACOES_DO_CASO: readonly { situacao: SituacaoDoCaso; explicacao: string }[] = [
  {
    situacao: 'confirmada_no_portal',
    explicacao:
      'Conferido à mão no Portal da Transparência, na data indicada. Confirma o que o portal mostra, não a causa da diferença.',
  },
  {
    situacao: 'confirmada_em_parte',
    explicacao:
      'Só um exemplo foi conferido à mão, e a nota do caso diz qual. O resto do valor continua sendo cálculo.',
  },
  {
    situacao: 'calculada',
    explicacao:
      'Ninguém conferiu este caso no portal. O tipo vem do padrão dos números: é a hipótese mais provável, não uma explicação contábil.',
  },
  {
    situacao: 'rever',
    explicacao: 'Foi conferido à mão, mas o valor mudou depois. A conferência antiga não vale até ser refeita.',
  },
];

function SignificadoDasSituacoes() {
  return (
    <section className="secao solta" aria-label="O que diz a coluna Situação">
      <div className="secao-cab">
        <h2 className="secao-titulo">O que diz a coluna Situação</h2>
        <span className="legenda">
          <span>De onde vem o que se sabe de cada caso</span>
        </span>
      </div>
      <dl className="significado-situacoes">
        {SITUACOES_DO_CASO.map(({ situacao, explicacao }) => (
          <div key={situacao}>
            <dt>
              <Selo compacto selo={seloDaSituacao(situacao)} />
            </dt>
            <dd>{explicacao}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function BlocoDaArea({ titulo, legenda, grupos }: { titulo: string; legenda: string; grupos: readonly Grupo[] }) {
  if (!grupos.length) return null;
  return (
    <section className="secao solta area-das-discrepancias">
      <div className="secao-cab">
        <h2 className="secao-titulo">{titulo}</h2>
        <span className="legenda">
          <span>{legenda}</span>
        </span>
      </div>
      {grupos.map((g) => (
        <GrupoDeCasos key={`${g.area}|${g.tipo}`} grupo={g} />
      ))}
    </section>
  );
}

function GrupoDeCasos({ grupo }: { grupo: Grupo }) {
  const [todos, setTodos] = useState(false);
  const id = `grupo-${grupo.area}-${grupo.tipo}`;
  const visiveis = todos ? grupo.itens : grupo.itens.slice(0, CASOS_INICIAIS);
  return (
    <section className="grupo-de-casos" aria-labelledby={id}>
      <div className="grupo-cab">
        <h3 id={id}>{grupo.rotulo}</h3>
        <p className="grupo-total" data-testid="total-do-grupo">
          <strong>{moeda(grupo.total)}</strong>
          <span className="apagado">
            {' '}
            em {numero(grupo.itens.length)} {grupo.itens.length === 1 ? 'caso' : 'casos'}
          </span>
        </p>
      </div>
      <p className="grupo-explicacao">{grupo.explicacao}</p>
      <table className="tabela-casos">
        <thead>
          <tr>
            <th scope="col">Caso</th>
            <th scope="col">Quando</th>
            <th scope="col" className="num">
              Betha
            </th>
            <th scope="col" className="num">
              TCE-SC
            </th>
            <th scope="col" className="num">
              Diferença
            </th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {visiveis.map((item, i) => (
            <Caso key={item.id ?? `${item.entidade}|${item.natureza}|${item.numero}|${i}`} item={item} />
          ))}
        </tbody>
      </table>
      {grupo.itens.length > visiveis.length && (
        <button type="button" className="botao-texto" onClick={() => setTodos(true)}>
          Ver todos os {numero(grupo.itens.length)}
        </button>
      )}
    </section>
  );
}

const juntar = (nomes: readonly string[]) =>
  nomes.length < 2 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;

function quandoFoi(item: Item) {
  if (item.dataEmpenho) return data(item.dataEmpenho);
  const meses = item.meses.flatMap((m) => (m.mes ? [m.mes] : []));
  // Até três por extenso; mais que isso, abreviados, para caber na coluna.
  const nomes = meses.length > 3 ? MESES : MESES_LONGOS;
  if (meses.length) return juntar(meses.map((m) => nomes[m - 1] as string));
  return item.mes ? MESES_LONGOS[item.mes - 1] : 'no ano';
}

function Identificacao({ item }: { item: Item }) {
  if (item.compensacao) {
    return (
      <strong>
        <span className="mono">
          {item.compensacao.aMenos.natureza} e {item.compensacao.aMais.natureza}
        </span>{' '}
        · {item.entidade}
      </strong>
    );
  }
  if (item.area === 'empenho') {
    return (
      <>
        <strong>
          Empenho nº {item.numero} · {item.entidade}
        </strong>
        <div className="sub">{item.fonte === 'betha' ? 'só na Betha' : 'só no TCE-SC'}</div>
      </>
    );
  }
  if (item.area === 'despesa') return <strong>Despesa orçamentária · {item.entidade}</strong>;
  return (
    <>
      <strong>
        <span className="mono">{item.natureza}</span> · {item.entidade}
      </strong>
      {item.descricao && <div className="historico">{descricaoCurta(item.descricao)}</div>}
    </>
  );
}

function DiferencaDoCaso({ item }: { item: Item }) {
  if (item.compensacao) {
    return (
      <>
        <span>{moeda(item.valor)} entre rubricas</span>
        <div className="sub">sem efeito no total</div>
      </>
    );
  }
  // Em meses diferentes, a soma do ano é igual: nenhum lado registra mais.
  if (item.diferenca === 0) return <span>{moeda(item.valor)} em meses diferentes</span>;
  return (
    <>
      <Diferenca valor={item.diferenca} />
      {item.diferencaDaNatureza !== null && (
        <div className="sub">parte dos {moeda(Math.abs(item.diferencaDaNatureza))} da natureza</div>
      )}
      {item.etapas && (
        <div className="sub">
          liquidado {moeda(Math.abs(item.etapas.liquidado.diferenca ?? 0))} · pago{' '}
          {moeda(Math.abs(item.etapas.pago.diferenca ?? 0))}
        </div>
      )}
    </>
  );
}

// O valor do caso na fonte: em rubricas que se compensam, um por rubrica.
function ValorNaFonte({ item, fonte }: { item: Item; fonte: 'betha' | 'tce' }) {
  if (!item.compensacao) return moeda(item[fonte]);
  return [item.compensacao.aMenos, item.compensacao.aMais].map((r) => (
    <div key={r.natureza} className="valor-da-rubrica">
      <span className="sub">{r.natureza}:</span> {moeda(r[fonte])}
    </div>
  ));
}

function Caso({ item }: { item: Item }) {
  return (
    <tr>
      <td className="caso-descricao">
        <Identificacao item={item} />
        <p className="caso-nota">{item.nota}</p>
        {item.evidencia && <p className="caso-nota">{item.evidencia}</p>}
      </td>
      <td data-rotulo="Quando">{quandoFoi(item)}</td>
      <td className="num" data-rotulo="Betha">
        <ValorNaFonte item={item} fonte="betha" />
      </td>
      <td className="num" data-rotulo="TCE-SC">
        <ValorNaFonte item={item} fonte="tce" />
      </td>
      <td className="num caso-diferenca" data-rotulo="Diferença">
        <DiferencaDoCaso item={item} />
      </td>
      <td data-rotulo="Situação">
        <Selo compacto selo={seloDaSituacao(item.situacao, item.data)} />
      </td>
    </tr>
  );
}

// Pendência, à parte dos grupos: é atraso de remessa, e o valor entra quando ela chegar.
function Aguardando({ aguardando, entidade }: { aguardando: DadosDaSecao['aguardando']; entidade: string }) {
  const daEntidade = (itens: readonly Item[]) => itens.filter((i) => !entidade || i.codigoEntidade === entidade);
  const receita = daEntidade(aguardando.receita.itens);
  const despesa = daEntidade(aguardando.despesa.itens);
  if (!receita.length && !despesa.length) return null;
  const totalDaReceita = entidade ? somaEmCentavos(receita, (i) => i.valor) : aguardando.receita.total;
  const totalDaDespesa = entidade ? somaEmCentavos(despesa, (i) => i.valor) : aguardando.despesa.total;
  const quantidade = entidade
    ? despesa.reduce((total, i) => total + (i.quantidade ?? 0), 0)
    : aguardando.despesa.quantidade;
  return (
    <section className="secao solta aguardando-tce" aria-label={aguardando.rotulo}>
      <div className="secao-cab">
        <h2 className="secao-titulo">{aguardando.rotulo}</h2>
        <span className="legenda">
          <span>Pendência de remessa, fora dos grupos acima</span>
        </span>
      </div>
      <p className="grupo-explicacao">{aguardando.explicacao}</p>
      <div className="aguardando-colunas">
        {receita.length > 0 && (
          <div>
            <p className="aguardando-total">
              Receita: <strong>{moeda(totalDaReceita)}</strong>
            </p>
            <ul>
              {receita.map((i) => (
                <li key={`${i.codigoEntidade}|${i.mes}`}>
                  {i.entidade} · {i.mes ? MESES_LONGOS[i.mes - 1] : 'sem mês'} · {moeda(i.valor)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {despesa.length > 0 && (
          <div>
            <p className="aguardando-total">
              Empenhos: <strong>{moeda(totalDaDespesa)}</strong> em {numero(quantidade)}{' '}
              {quantidade === 1 ? 'empenho' : 'empenhos'}
            </p>
            <ul>
              {despesa.map((i) => (
                <li key={i.codigoEntidade}>
                  {i.entidade} · {numero(i.quantidade ?? 0)} {i.quantidade === 1 ? 'empenho' : 'empenhos'} ·{' '}
                  {moeda(i.valor)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// A comparação neutra, por entidade e mês: a diferença de cada total, sem classificar.
function OsTotais({ ano, entidade, filtros }: PropsDeConteudo) {
  const { dados, carregando, erro } = useApi(`/api/conferencias?ano=${ano}`, conferenciaSchema);
  const sigla = filtros.entidades.find((e) => e.codigo === entidade)?.sigla;
  return (
    <>
      <section className="secao solta dupla">
        <div className="secao-cab">
          <h2 className="secao-titulo">Os totais, para conferir</h2>
          <span className="legenda">
            <span>A comparação direta entre as fontes, por entidade e por mês, sem classificar a diferença</span>
          </span>
        </div>
        <Estado carregando={carregando} erro={erro} />
      </section>
      {dados && (
        <>
          <Despesa dados={dados} sigla={sigla} />
          <ReceitaEntidades dados={dados} sigla={sigla} />
          <Empenhos dados={dados} sigla={sigla} />
          <div className="colunas dupla">
            <ReceitaMeses dados={dados} entidade={entidade} />
            <ComoLer dados={dados} filtrado={Boolean(entidade)} />
          </div>
          <Coletas coletas={dados.coletas} />
        </>
      )}
    </>
  );
}

const SITUACOES = {
  igual: { texto: 'Igual', classe: '', amostra: '' },
  diverge: { texto: 'Diverge', classe: '', amostra: 'cinza' },
  soTce: { texto: 'Só no TCE', classe: 'sem', amostra: 'cinza' },
  aguardando: { texto: 'Aguardando TCE', classe: 'sem', amostra: 'cinza' },
};

function Situacao({ tipo }: { tipo: keyof typeof SITUACOES }) {
  const s = SITUACOES[tipo];
  return (
    <span className={`situacao ${s.classe}`}>
      <span className={`amostra ${s.amostra}`} aria-hidden="true" />
      {s.texto}
    </span>
  );
}

type LinhaDeDespesa = DadosDaConferencia['despesaPorEntidade'][number];
type PropsDosTotais = { dados: DadosDaConferencia; sigla: string | undefined };

function Despesa({ dados, sigla }: PropsDosTotais) {
  const linhas = dados.despesaPorEntidade.filter((r) => !sigla || r.sigla === sigla);
  const soma = (k: keyof LinhaDeDespesa) => somaEmCentavos(linhas, (r) => N(r[k] ?? 0));
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
          {!sigla && (
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
          )}
        </table>
      </div>
    </section>
  );
}

function ReceitaEntidades({ dados, sigla }: PropsDosTotais) {
  const linhas = dados.receitaPorEntidade.filter((r) => !sigla || r.sigla === sigla);
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
            {linhas.map((r) => (
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

function Empenhos({ dados, sigla }: PropsDosTotais) {
  const linhas = dados.empenhos.filter((e) => !sigla || e.entidade === sigla);
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
            {linhas.map((e) => (
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

// Cada mês com as rubricas que formam a sua diferença, em letra pequena. O total do mês é do município:
// com o filtro de entidade, a diferença do mês é a soma das rubricas dela.
function ReceitaMeses({ dados, entidade }: { dados: DadosDaConferencia; entidade: string }) {
  const meses = dados.receitaPorMes
    .filter((m) => m.mes)
    .map((m) => {
      if (!entidade) return m;
      const parcelas = m.parcelas.filter((p) => p.ent === entidade);
      return { ...m, parcelas, diferenca: m.diferenca === null ? null : somaEmCentavos(parcelas, (p) => p.diferenca) };
    });
  const max = Math.max(...meses.map((m) => Math.abs(N(m.diferenca ?? 0))), 1);
  const mil = (v: number) => `${(Math.abs(v) / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  const descricao = (p: { natureza: string; entidade: string }) =>
    descricaoCurta(
      dados.receitaPorNatureza.find((r) => r.natureza === p.natureza && r.entidade === p.entidade)?.descricao,
    );
  return (
    <section className="secao media">
      <h2 className="secao-titulo">Receita mês a mês</h2>
      <p className="legenda-secao">Quanto uma fonte registra a mais que a outra, e de quais rubricas vem</p>
      <ul className="lista-pontos">
        {meses.map((m) => (
          <li key={m.mes}>
            <div className="lp-linha">
              <span className="lp-cod">{MESES[(m.mes as number) - 1]}</span>
              <span className="lp-nome apagado">{m.diferenca === null ? 'TCE ainda não recebeu' : ''}</span>
              <span className="lp-pontos" aria-hidden="true" />
              <span className="lp-valor">
                <Diferenca valor={m.diferenca} />
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

function ComoLer({ dados, filtrado }: { dados: DadosDaConferencia; filtrado: boolean }) {
  const { camara } = dados;
  return (
    <aside className="secao media com-fio como-ler">
      {!filtrado && (
        <>
          <h2 className="secao-titulo italico" style={{ border: 0, padding: 0 }}>
            Câmara Municipal
          </h2>
          <p>
            A Câmara não está no portal Betha da Prefeitura. Os números dela vêm só do TCE-SC
            {camara.empenhos > 0 &&
              ` (${moeda(camara.empenhado)} empenhados e ${moeda(camara.pago)} pagos em ${numero(camara.empenhos)} empenhos, dados até ${data(camara.ultimo)})`}{' '}
            e já fazem parte do total municipal do Tribunal: somar a Câmara ao total do TCE contaria duas vezes. Ela não
            tem receita própria: recebe repasses da Prefeitura, que não são lançados como receita orçamentária. Por isso
            não aparece na comparação de receitas.
          </p>
        </>
      )}
      <h2 className="secao-titulo italico com-fio" style={{ border: 0, padding: 0, marginTop: filtrado ? 0 : 12 }}>
        Como ler esta página
      </h2>
      <p>
        <strong>Igual</strong> significa idêntico ao centavo. Quando não é igual, a diferença diz qual fonte registra
        mais: “a mais na Betha” ou “a mais no TCE”.
      </p>
      <p>
        <strong>Despesa</strong> compara a consulta 57170 da Betha (empenhado, liquidado e pago já descontadas as
        anulações). <strong>Empenhos</strong> compara a lista 57140, um a um, por entidade, número, data e valor
        original. <strong>Rubricas</strong> são comparadas pelos 8 primeiros dígitos do código da receita, o nível comum
        às duas fontes.{' '}
        <a href={RELATORIO} target="_blank" rel="noreferrer">
          Relatório completo da conferência
        </a>
        .
      </p>
    </aside>
  );
}

const NOME_FONTE: Record<string, string> = { betha: 'Betha', tcesc: 'TCE-SC' };

function Coletas({ coletas }: { coletas: DadosDaConferencia['coletas'] }) {
  const recarga = coletas
    .map((c) => c.recargaTce)
    .filter(Boolean)
    .sort()
    .at(-1);
  return (
    <details className="fonte">
      <summary>
        Coletas comparadas · {coletas.length} consultas
        {recarga ? ` · painéis do TCE atualizados em ${dataHora(recarga)}` : ''}
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
