import {
  despesasResumoSchema,
  empenhosResumoSchema,
  receitasSchema,
  type DespesasResumo,
  type EmpenhosResumo,
  type Receitas,
} from '@orleans-em-dados/contracts';
import { useApi } from '../api';
import { BarrasMensais, Estado, Filtros, Fonte, ListaPontos, Mi, Numero, Numeros } from '../components';
import {
  data,
  decimal,
  diaEMes,
  emMilhoes,
  MESES,
  MESES_LONGOS,
  milhoes,
  nomeProprio,
  numero,
  pct,
  porExtenso,
} from '../format';
import {
  ateOMes,
  ContaDaDespesa,
  ContaDaReceita,
  SecaoDaConta,
  LINK_DISCREPANCIAS,
  SemConferencia,
} from '../conferido';
import { AvisoDeAtraso, Selo } from '../selo';
import { SELO_EXEMPLO, SELO_FONTE_UNICA, seloConferidoComTce, seloDaDespesa } from '../selos';
import { GLOSSARIO, ORIGEM_CIDADAO, ORIGENS_DE_FORA, sujeito } from '../referencias';
import { usePopulacao, type Populacao } from '../usePopulacao';
import type { PropsDaPagina } from './props';

const qs = (ano: number, entidade: string) => new URLSearchParams({ ano: String(ano), entidade }).toString();
const N = Number;

export default function Financas({ ano, entidade, filtros }: PropsDaPagina) {
  const rec = useApi(`/api/receitas?${qs(ano, entidade)}`, receitasSchema);
  const emp = useApi(`/api/despesas/empenhos/resumo?${qs(ano, entidade)}`, empenhosResumoSchema);
  const desp = useApi(`/api/despesas/resumo?${qs(ano, entidade)}`, despesasResumoSchema);
  const r = rec.dados;
  const d = emp.dados;
  const o = desp.dados;
  const pop = usePopulacao(ano);

  return (
    <>
      <Filtros {...filtros} />
      <Estado
        carregando={rec.carregando || emp.carregando || desp.carregando}
        erro={rec.erro || emp.erro || desp.erro}
      />
      {r && d && o && !r.meta.exemplo && !r.conferencia.disponivel && (
        <SemConferencia ano={ano} faltando={r.conferencia.faltando} />
      )}
      {r && d && o && (r.meta.exemplo || r.conferencia.disponivel) && (
        <Conteudo ano={ano} entidade={entidade} r={r} d={d} o={o} pop={pop} entidades={filtros.entidades} />
      )}
    </>
  );
}

// `r` e `o`: só o conferido; em dados de exemplo, os números fictícios, sem selo de conferido.
// `o`: despesa conferida, já descontadas as anulações: os totais oficiais.
// `d`: empenhos casados com o TCE-SC, pelo valor original: só para as divisões por órgão e por mês,
// que a despesa não tem.
function Conteudo({
  ano,
  entidade,
  r,
  d,
  o,
  pop,
  entidades,
}: {
  ano: number;
  entidade: string;
  r: Receitas;
  d: EmpenhosResumo;
  o: DespesasResumo;
  pop: Populacao | null;
  entidades: readonly { codigo: string; sigla: string }[];
}) {
  const arrecadado = N(r.totais.arrecadadoNoMes);
  const previsto = N(r.totais.orcadoAtualizado);
  // Nulo: a entidade do recorte não fechou entre as fontes e está fora da soma.
  const temDespesa = o.totais.empenhado !== null;
  const empenhado = N(o.totais.empenhado);
  const pago = N(o.totais.pago ?? 0);
  const original = N(d.totais.empenhado);
  const camara = o.camara;
  const exemplo = r.meta.exemplo;
  const { parcial, limites } = r.conferencia;
  const mesReceita = limites?.mesReceita;
  const dataCorte = o.conferencia.limites?.dataEmpenho;
  const ate = ateOMes(parcial, mesReceita, ano);
  const ateDespesa = parcial ? `até ${data(dataCorte)}` : '';
  const quem = sujeito(entidade, entidades);
  const anoEncerrado = ano < new Date().getFullYear();

  const origens = r.porOrigem.filter((o) => N(o.arrecadadoNoMes) > 0);
  const deFora = origens.filter((o) => ORIGENS_DE_FORA.has(o.chave)).reduce((s, o) => s + N(o.arrecadadoNoMes), 0);
  // Empréstimos (21, 23) não são arrecadação da cidade nem repasse.
  const emprestimos = r.porOrigem
    .filter((o) => o.chave === '21' || o.chave === '23')
    .reduce((s, o) => s + N(o.arrecadadoNoMes), 0);
  const propria = arrecadado - deFora - emprestimos;
  const principalOrigem = origens[0] && (ORIGEM_CIDADAO[origens[0].chave] ?? origens[0].descricao);
  const [org1, org2] = d.porOrgao;

  // Meses: arrecadado (receitas) e empenhado (empenhos), cada um da sua consulta.
  const meses = MESES.map((rotulo, i) => ({
    rotulo,
    nome: MESES_LONGOS[i] as string,
    a: N(r.porMes.find((m) => m.chave === i + 1)?.arrecadadoNoMes ?? 0),
    b: N(d.porMes.find((m) => m.chave === i + 1)?.empenhado ?? 0),
  }));
  const pico = meses.reduce((m, x, i) => (x.b > (meses[m]?.b ?? 0) ? i : m), 0);
  const noPico = meses[pico] as (typeof meses)[number];
  const anotacao = noPico.b > 0 && {
    texto: `${nomeProprio(noPico.nome)}: R$ ${milhoes(noPico.b)} mi empenhados, o maior valor do ano.${
      pico === 0 ? ' Contratos do ano inteiro costumam ser empenhados logo no início.' : ''
    }`,
    posicao: pico < 6 ? { left: `${((pico + 1) / 12) * 100}%`, top: 4 } : { left: '4%', top: 4 },
  };
  const maiorCada100 = N(d.porOrgao[0]?.empenhado ?? 0);

  const outros = d.porOrgao.slice(8);
  const cada100: { nome: string; valor: number; outro?: boolean }[] = [
    ...d.porOrgao
      .slice(0, 8)
      .map((x) => ({ nome: nomeProprio(x.nome) ?? 'Sem órgão informado', valor: N(x.empenhado) })),
    ...(outros.length
      ? [{ nome: `Outros ${outros.length} órgãos`, valor: outros.reduce((s, x) => s + N(x.empenhado), 0), outro: true }]
      : []),
  ];

  return (
    <>
      <div className="abertura">
        <h1 className="manchete">
          {ate ? ate.charAt(0).toLocaleUpperCase('pt-BR') + ate.slice(1) : `Em ${ano}`}, {quem} arrecadou{' '}
          <em>{porExtenso(arrecadado)}</em>
          {temDespesa ? (
            <>
              {parcial ? ` e, até ${diaEMes(dataCorte)}, empenhou ` : ' e empenhou '}
              <em>{porExtenso(empenhado)}</em> em despesas.
            </>
          ) : (
            '. A despesa deste recorte está fora da soma conferida.'
          )}
        </h1>
        <div className="abertura-lado">
          <p className="capitular">
            {principalOrigem && (
              <>
                O dinheiro veio principalmente de{' '}
                {principalOrigem.charAt(0).toLocaleLowerCase('pt-BR') + principalOrigem.slice(1)}.{' '}
              </>
            )}
            {org1 && (
              <>
                {org2 ? (
                  <>
                    Quem mais empenhou foram {nomeProprio(org1.nome)} e {nomeProprio(org2.nome)}.{' '}
                  </>
                ) : (
                  <>Quem mais empenhou foi {nomeProprio(org1.nome)}. </>
                )}
              </>
            )}
            {temDespesa && (
              <>
                Do que foi empenhado, {pct(pago, empenhado)} já estava pago
                {parcial ? ` até ${diaEMes(dataCorte)}` : anoEncerrado ? ' no fim do ano' : ' até agora'}.
              </>
            )}
            {camara && (
              <>
                {' '}
                A Câmara Municipal fica à parte: {porExtenso(N(camara.empenhado))} empenhados, dados do TCE-SC
                {anoEncerrado ? '' : ` até ${data(camara.ultimoEmpenho)}`}, fonte única e sem conferência.
              </>
            )}
          </p>
          <a href="#metodologia" className="botao-link">
            Como estes dados são feitos →
          </a>
        </div>
      </div>

      <Numeros rotulo="Totais do ano">
        <Numero
          rotulo={`Arrecadado${ate ? ` ${ate}` : ''}`}
          detalhe={
            previsto > 0
              ? `${pct(arrecadado, previsto)} dos ${emMilhoes(previsto)} previstos para o ano (orçamento: fonte única, sem conferência)`
              : 'sem previsão'
          }
          barra={previsto > 0 ? (arrecadado / previsto) * 100 : undefined}
          selo={
            <>
              {exemplo ? (
                <Selo selo={SELO_EXEMPLO} />
              ) : (
                <Selo semLink selo={seloConferidoComTce(parcial ? mesReceita : null)} />
              )}
              <AvisoDeAtraso indicador="receita-arrecadada" ano={ano} />
            </>
          }
        >
          <Mi valor={arrecadado} />
        </Numero>
        {temDespesa ? (
          <>
            <Numero
              rotulo={`Empenhado${ateDespesa ? ` ${ateDespesa}` : ''}`}
              detalhe={`já descontadas as anulações · ${numero(d.totais.quantidade)} empenhos, ${numero(d.totais.credores)} credores`}
              selo={
                <>
                  {exemplo ? (
                    <Selo selo={SELO_EXEMPLO} />
                  ) : (
                    <Selo semLink={o.conferencia.totalBetha !== null} selo={seloDaDespesa(o.conferencia)} />
                  )}
                  <AvisoDeAtraso indicador="despesa-empenhada-liquida" ano={ano} />
                </>
              }
            >
              <Mi valor={empenhado} />
            </Numero>
            <Numero
              rotulo={`Pago${ateDespesa ? ` ${ateDespesa}` : ''}`}
              detalhe={`${pct(pago, empenhado)} do empenhado`}
              barra={(pago / empenhado) * 100}
              vermelho
            >
              <Mi valor={pago} />
            </Numero>
          </>
        ) : (
          <Numero
            rotulo="Empenhado"
            detalhe={
              <>
                Fora da soma: as fontes não fecham neste recorte. <a href={LINK_DISCREPANCIAS}>Ver discrepâncias</a>
              </>
            }
          >
            —
          </Numero>
        )}
        {pop && (
          <Numero
            rotulo={`Arrecadado aqui, por morador${ate ? `, ${ate}` : ''}`}
            detalhe={`impostos, taxas e tarifas da cidade ÷ ${numero(pop.pessoas)} moradores (${pop.fonte}). Com os repasses, R$ ${numero(Math.round(arrecadado / pop.pessoas))}`}
          >
            R$ {numero(Math.round(propria / pop.pessoas))}
          </Numero>
        )}
      </Numeros>

      {!exemplo && (
        <SecaoDaConta titulo="Como se chega a estes números">
          <ContaDaReceita explicada titulo="A conta da receita" conferencia={r.conferencia} />
          {temDespesa && (
            <ContaDaDespesa
              explicada
              titulo="A conta da despesa"
              conferido={o.totais.empenhado}
              conferencia={o.conferencia}
            />
          )}
        </SecaoDaConta>
      )}

      <div className="colunas">
        <section className="secao larga">
          <div className="secao-cab">
            <h2 className="secao-titulo">Mês a mês</h2>
            <span className="legenda">
              <span>
                <span className="amostra" aria-hidden="true" />
                Arrecadado
              </span>
              <span>
                <span className="amostra vermelho" aria-hidden="true" />
                Empenhado
              </span>
              <span>R$ milhões · empenhos pelo valor original</span>
            </span>
          </div>
          <BarrasMensais
            meses={meses}
            series={['Arrecadado', 'Empenhado']}
            descricao={`Barras mensais de arrecadado e empenhado em ${ano}`}
            anotacao={anotacao || null}
          />
        </section>

        <section className="secao estreita">
          <h2 className="secao-titulo">De onde vem</h2>
          <ListaPontos
            comUnidade
            itens={origens.map((o) => ({
              chave: o.chave,
              nome: ORIGEM_CIDADAO[o.chave] ?? o.descricao,
              valor: o.arrecadadoNoMes,
              dica: `${o.descricao}: ${emMilhoes(o.arrecadadoNoMes)}`,
            }))}
          />
          {deFora > 0 && (
            <p className="nota-serif com-fio">
              {pct(deFora, arrecadado)} do que entrou veio de fora: repasses da União e do Estado.
            </p>
          )}
          <a href="#receitas" className="botao-link">
            Todas as receitas →
          </a>
        </section>
      </div>

      <section className="secao dupla">
        <div className="secao-cab">
          <h2 className="secao-titulo">Para onde vai cada R$ 100</h2>
          <span className="legenda-secao">
            Valor original dos empenhos por órgão{pop ? ' · e quanto isso dá por morador no ano' : ''}
          </span>
        </div>
        <ul className="cada-100">
          {cada100.map((o) => (
            <li key={o.nome}>
              <span className={`serif${o.outro ? ' apagado' : ''}`}>
                <span style={{ fontSize: '0.55em' }}>R$ </span>
                {decimal((o.valor / original) * 100)}
              </span>
              <span>{o.nome}</span>
              <div className="trilho" aria-hidden="true">
                <span
                  className={o.outro ? '' : 'vermelho'}
                  style={{
                    width: `${(o.valor / maiorCada100) * 100}%`,
                    background: o.outro ? 'var(--pontilhado)' : undefined,
                  }}
                />
              </div>
              <span className="lp-extra">
                {emMilhoes(o.valor)}
                {pop && ` · R$ ${numero(Math.round(o.valor / pop.pessoas))} por morador`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="colunas dupla">
        <section className="secao estreita">
          <h2 className="secao-titulo">Quem gasta</h2>
          <ListaPontos
            vermelho
            comUnidade
            itens={[
              ...o.porEntidade.map((e) => {
                const qtd = d.porEntidade.find((x) => x.chave === e.chave)?.quantidade;
                return {
                  chave: e.chave,
                  nome: e.entidade.nome ?? `Entidade ${e.chave}`,
                  valor: e.empenhado,
                  selecionado: e.chave === entidade,
                  extra:
                    e.empenhado === null ? (
                      <>
                        fora da soma: <a href={LINK_DISCREPANCIAS}>ver discrepâncias</a>
                      </>
                    ) : qtd ? (
                      `${numero(qtd)} empenhos`
                    ) : undefined,
                  dica:
                    e.empenhado === null
                      ? `${e.entidade.nome}: fora da soma conferida`
                      : `${e.entidade.nome}: ${emMilhoes(e.empenhado)} empenhados, já descontadas as anulações`,
                };
              }),
              ...(camara
                ? [
                    {
                      chave: 'camara',
                      nome: camara.nome,
                      valor: camara.empenhado,
                      extra: (
                        <>
                          {numero(camara.quantidade)} empenhos · fonte TCE-SC
                          {anoEncerrado ? '' : `, até ${data(camara.ultimoEmpenho)}`} · à parte da soma
                          <Selo compacto selo={SELO_FONTE_UNICA} />
                        </>
                      ),
                      dica: `${camara.nome}: ${emMilhoes(camara.empenhado)} (TCE-SC; não está no portal Betha)`,
                    },
                  ]
                : []),
            ]}
          />
          <a href="#despesas" className="botao-link">
            Todas as despesas →
          </a>
        </section>

        <section className="secao larga">
          <h2 className="secao-titulo">Pequeno glossário</h2>
          <dl className="glossario">
            {GLOSSARIO.map(([termo, def]) => (
              <div key={termo}>
                <dt>{termo}</dt>
                <dd>{def}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <p className="nota" style={{ marginTop: 32 }}>
        Abrangência: Prefeitura, Fundo Municipal de Saúde, SAMAE e Fundação Ambiental.{' '}
        {parcial
          ? `Empenhado e pago são os valores do TCE-SC nos empenhos casados com a Betha até ${data(dataCorte)}.`
          : 'Empenhado e pago são a despesa orçamentária (consulta 57170), já descontadas as anulações.'}{' '}
        As divisões por órgão e por mês usam o valor original de cada empenho (consulta 57140)
        {exemplo ? '' : ', só dos empenhos casados com o TCE-SC'}. A Câmara Municipal não está no portal Betha: seus
        valores vêm do TCE-SC, sem conferência, e aparecem à parte.
      </p>
      <Fonte meta={r.meta} />
      <Fonte meta={o.meta} />
      <Fonte meta={d.meta} />
    </>
  );
}
