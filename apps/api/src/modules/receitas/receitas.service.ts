// A receita das páginas: os valores vêm de `dadosConferidos`, e a Betha só completa o orçado e a
// quantidade de linhas. Coleta de exemplo mantém os números fictícios; ano real sem as coletas do
// TCE-SC não tem número de arrecadação.
import { dadosConferidos } from '@orleans-em-dados/db/conferencias';
import type { ColetaPublicada } from '../coletas/coletas.dao';
import { complementosDaReceita, descricaoDaOrigem, resumoReceitas, type DoRecorte } from './receitas.dao';

const FONTE_UNICA = ['orcadoAtualizado', 'orcadoDeducoes'] as const;
const VAZIO: DoRecorte = { quantidade: 0, orcadoAtualizado: null };

type Dados = Awaited<ReturnType<typeof dadosConferidos>>;
type Disponiveis = Extract<Dados, { disponivel: true }>;
type Indisponiveis = Extract<Dados, { disponivel: false }>;

const semConferencia = ({ faltando }: Indisponiveis) => ({
  disponivel: false,
  parcial: null,
  limites: null,
  conferido: null,
  diferencaBetha: null,
  diferencaTce: null,
  aguardandoTce: null,
  totalBetha: null,
  totalTce: null,
  faltando,
});

// O que só existe depois do corte não é conferido nem diferença: a linha não sai no agregado.
const temAlgoConferido = (l: { conferido: number; diferencaBetha: number; diferencaTce: number }) =>
  l.conferido !== 0 || l.diferencaBetha !== 0 || l.diferencaTce !== 0;

async function receitasConferidas({ coletaId, meta }: ColetaPublicada, dados: Disponiveis, entidade: string) {
  const { receita, parcial, limites } = dados;
  const complementos = await complementosDaReceita(coletaId, entidade, limites.mesReceita);
  const doMes = new Map(complementos.porMes.map((l) => [l.chave, l]));
  const daOrigem = new Map(complementos.porOrigem.map((l) => [l.chave, l]));
  const daRubrica = new Map(complementos.rubricas.map((l) => [l.chave, l]));
  const daNatureza = new Map(complementos.naturezas.map((l) => [l.chave, l]));
  const daEntidade = new Map(complementos.porEntidade.map((l) => [l.chave, l]));

  const recorte = entidade ? receita.recortes[entidade] : receita;
  const contaDaEntidade = receita.porEntidade.find((e) => e.codigoEntidade === entidade);
  const conta = entidade ? contaDaEntidade : receita.totais;
  const naturezas = receita.naturezas.filter((n) => !entidade || n.codigoEntidade === entidade);

  return {
    meta,
    fonteUnica: FONTE_UNICA,
    conferencia: {
      disponivel: true,
      parcial,
      limites,
      conferido: conta?.conferido ?? null,
      diferencaBetha: conta?.diferencaBetha ?? null,
      diferencaTce: conta?.diferencaTce ?? null,
      aguardandoTce: conta?.aguardandoTce ?? null,
      totalBetha: conta?.totalBetha ?? null,
      totalTce: conta?.totalTce ?? null,
    },
    totais: {
      quantidade: complementos.totais.quantidade,
      orcadoAtualizado: complementos.totais.orcadoAtualizado,
      orcadoDeducoes: complementos.totais.orcadoDeducoes,
      arrecadadoNoMes: conta?.conferido ?? null,
      negativos: complementos.totais.negativos,
      rubricas: complementos.totais.rubricas,
    },
    porMes: (recorte?.porMes ?? [])
      .filter((m) => m.mes === null || m.mes <= (limites.mesReceita ?? 0))
      .map((m) => ({ chave: m.mes, quantidade: doMes.get(m.mes)?.quantidade ?? 0, arrecadadoNoMes: m.conferido })),
    porEntidade: receita.porEntidade.filter(temAlgoConferido).map((e) => {
      const complemento = daEntidade.get(e.codigoEntidade);
      return {
        chave: e.codigoEntidade,
        entidade: complemento?.entidade ?? { nome: null, sigla: null, status: null },
        quantidade: complemento?.quantidade ?? 0,
        orcadoAtualizado: complemento?.orcadoAtualizado ?? null,
        arrecadadoNoMes: e.conferido,
      };
    }),
    porOrigem: (recorte?.porOrigem ?? []).filter(temAlgoConferido).map((o) => ({
      chave: o.origem,
      ...(daOrigem.get(o.origem) ?? VAZIO),
      arrecadadoNoMes: o.conferido,
      descricao: descricaoDaOrigem(o.origem),
    })),
    naturezas: naturezas.map((n) => {
      const chave = `${n.codigoEntidade}|${n.natureza}`;
      const { quantidade, orcadoAtualizado } = (n.nivel === 14 ? daRubrica : daNatureza).get(chave) ?? VAZIO;
      return {
        chave,
        rubrica: n.natureza,
        nivel: n.nivel,
        descricao: n.descricao ?? '',
        entidade: n.entidade,
        quantidade,
        orcadoAtualizado,
        arrecadadoNoMes: n.conferido,
      };
    }),
  };
}

// Sem as coletas do TCE-SC, nada de arrecadação: o orçado continua, porque é fonte única.
async function receitasSemConferencia(coleta: ColetaPublicada, dados: Indisponiveis, entidade: string) {
  const { totais } = await complementosDaReceita(coleta.coletaId, entidade, null);
  return {
    meta: coleta.meta,
    fonteUnica: FONTE_UNICA,
    conferencia: semConferencia(dados),
    totais: {
      quantidade: 0,
      orcadoAtualizado: totais.orcadoAtualizado,
      orcadoDeducoes: totais.orcadoDeducoes,
      arrecadadoNoMes: null,
      negativos: 0,
      rubricas: 0,
    },
    porMes: [],
    porEntidade: [],
    porOrigem: [],
    naturezas: [],
  };
}

export async function receitasDoAno(coleta: ColetaPublicada, ano: number, entidade: string) {
  const dados = await dadosConferidos(ano);
  if (dados.disponivel) return receitasConferidas(coleta, dados, entidade);
  if (dados.exemplo && coleta.meta.exemplo) {
    return {
      ...(await resumoReceitas(coleta, { entidade })),
      fonteUnica: FONTE_UNICA,
      conferencia: semConferencia(dados),
    };
  }
  return receitasSemConferencia(coleta, dados, entidade);
}
