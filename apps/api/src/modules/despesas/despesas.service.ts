// A despesa das páginas: valores de `dadosConferidos().despesa`. Entidade não conferida sai sem
// número e fora da soma; a Câmara fica à parte. Coleta de exemplo mantém os números fictícios.
import { dadosConferidos } from '@orleans-em-dados/db/conferencias';
import type { ColetaPublicada } from '../coletas/coletas.dao';
import { camaraDoAno, catalogoDeEntidades, orcadoDaDespesa, resumoDespesas } from './despesas.dao';

const FONTE_UNICA = ['orcadoAtualizado'] as const;

type Dados = Awaited<ReturnType<typeof dadosConferidos>>;
type Disponiveis = Extract<Dados, { disponivel: true }>;

const semConferencia = (faltando: readonly string[]) => ({
  disponivel: false,
  parcial: null,
  limites: null,
  aguardandoTce: null,
  diferencaBetha: null,
  totalBetha: null,
  entidadesConferidas: null,
  entidadesFora: null,
  faltando,
});

const emCentavos = (v: number | null | undefined) => Math.round((v ?? 0) * 100);

/** Conferido + em discrepância = total da 57170, no empenhado. Entidade fora sai com o valor inteiro
 *  da Betha; a duplicidade, só com as linhas retiradas. No ano em curso não há conta: o que aguarda é
 *  valor original da Betha, e o conferido é líquido do TCE-SC. */
function contaDoEmpenhado(
  { parcial, discrepancias }: Disponiveis,
  entidade: string,
  conferido: number | null | undefined,
) {
  if (parcial) return { diferencaBetha: null, totalBetha: null };
  const retirado = discrepancias
    .filter((d) => d.area === 'despesa' && (!entidade || d.codigoEntidade === entidade))
    .reduce((soma, d) => soma + emCentavos(d.tipo === 'despesa_duplicada' ? d.diferenca : d.betha), 0);
  return { diferencaBetha: retirado / 100, totalBetha: (emCentavos(conferido) + retirado) / 100 };
}

async function despesasConferidas(coleta: ColetaPublicada, dados: Disponiveis, ano: number, entidade: string) {
  const { despesa, parcial, limites } = dados;
  const [orcadoAtualizado, catalogo, camara] = await Promise.all([
    orcadoDaDespesa(coleta.coletaId, entidade),
    catalogoDeEntidades(),
    entidade ? null : camaraDoAno(ano, false),
  ]);
  const daEntidade = despesa.porEntidade.find((e) => e.codigoEntidade === entidade);
  const totais = entidade ? daEntidade : despesa.totais;
  return {
    meta: coleta.meta,
    fonteUnica: FONTE_UNICA,
    conferencia: {
      disponivel: true,
      parcial,
      limites,
      aguardandoTce: entidade ? (daEntidade?.aguardandoTce ?? null) : despesa.totais.aguardandoTce,
      ...contaDoEmpenhado(dados, entidade, totais?.empenhado),
      entidadesConferidas: despesa.totais.entidadesConferidas,
      entidadesFora: despesa.totais.entidadesFora,
    },
    totais: {
      orcadoAtualizado,
      empenhado: totais?.empenhado ?? null,
      liquidado: totais?.liquidado ?? null,
      pago: totais?.pago ?? null,
    },
    porEntidade: despesa.porEntidade.map((e) => ({
      chave: e.codigoEntidade,
      entidade: (e.codigoEntidade ? catalogo.get(e.codigoEntidade) : null) ?? {
        nome: e.nome,
        sigla: e.entidade,
        status: null,
      },
      fonte: e.fonte,
      conferida: e.conferida,
      dataCorte: e.dataCorte ?? null,
      aguardandoTce: e.aguardandoTce,
      empenhado: e.empenhado,
      liquidado: e.liquidado,
      pago: e.pago,
    })),
    camara,
  };
}

export async function despesasDoAno(coleta: ColetaPublicada, ano: number, entidade: string) {
  const dados = await dadosConferidos(ano);
  if (dados.disponivel) return despesasConferidas(coleta, dados, ano, entidade);
  if (dados.exemplo && coleta.meta.exemplo) {
    return {
      ...(await resumoDespesas(coleta, { entidade, ano })),
      fonteUnica: FONTE_UNICA,
      conferencia: semConferencia(dados.faltando),
    };
  }
  return {
    meta: coleta.meta,
    fonteUnica: FONTE_UNICA,
    conferencia: semConferencia(dados.faltando),
    totais: {
      orcadoAtualizado: await orcadoDaDespesa(coleta.coletaId, entidade),
      empenhado: null,
      liquidado: null,
      pago: null,
    },
    porEntidade: [],
    camara: null,
  };
}
