// As respostas gravadas da API como fixture de tela: o mesmo JSON que a suíte de paridade confere.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conferenciaSchema, type Conferencia } from '@orleans-em-dados/contracts';

const PASTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../api/test/paridade/respostas');

export const respostaGravada = (arquivo: string) =>
  JSON.parse(readFileSync(path.join(PASTA, `${arquivo}.json`), 'utf8')).corpo;

export const ANO = 2025;

export const FILTROS = {
  anos: [2025],
  ano: ANO,
  setAno: () => {},
  entidades: [
    { codigo: '728', nome: 'Prefeitura Municipal', sigla: 'Prefeitura' },
    { codigo: '319', nome: 'Fundo Municipal de Saúde', sigla: 'FMS' },
  ],
  entidade: '',
  setEntidade: () => {},
};

export const ROTAS = {
  receitas: '/api/receitas?ano=2025&entidade=',
  empenhosResumo: '/api/despesas/empenhos/resumo?ano=2025&entidade=',
  despesas: '/api/despesas/resumo?ano=2025&entidade=',
  conferencia: '/api/conferencias?ano=2025',
  busca: (q = '', orgao = '', situacao = '', offset = 0) =>
    `/api/despesas/empenhos?ano=2025&q=${q}&entidade=&orgao=${orgao}&situacao=${situacao}&offset=${offset}&limit=25`,
};

type CamposDeCausa = { causa: string | null; explicada: boolean };
type LinhaDeMes = Omit<Conferencia['receitaPorMes'][number], 'parcelas'> & { parcelas?: unknown };

const CAUSA_DA_RUBRICA: Record<string, CamposDeCausa> = {
  // A nota gravada diz que o lançamento fora do acumulado "explica toda a diferença".
  '17135011': { causa: 'Lançamento fora do acumulado', explicada: true },
};
const CAUSA_DO_EMPENHO: Record<string, CamposDeCausa> = {
  '211:728:1003': { causa: 'Provável renumeração', explicada: true },
  '5003': { causa: 'Provável renumeração', explicada: true },
  '211:728:900': { causa: 'Registro repetido', explicada: true },
};
const PARCELAS_DO_MES: Record<number, Conferencia['receitaPorMes'][number]['parcelas']> = {
  2: [{ mes: 2, ent: '319', entidade: 'FMS', natureza: '17135011', diferenca: 50000 }],
};

/**
 * A conferência gravada, com os campos de causa que a gravação da paridade ainda não traz.
 * O que a gravação já tiver vale sobre o escrito aqui, e o schema recusa fixture fora do contrato.
 */
export function conferenciaGravada(campos: Partial<Conferencia> = {}): Conferencia {
  const gravada = respostaGravada('api_conferencias_ano_2025');
  return conferenciaSchema.parse({
    semExplicacao: [],
    ...gravada,
    receitaPorNatureza: gravada.receitaPorNatureza.map((r: { natureza: string }) => ({
      ...CAUSA_DA_RUBRICA[r.natureza],
      ...r,
    })),
    empenhosSemPar: gravada.empenhosSemPar.map((e: { id: string }) => ({ ...CAUSA_DO_EMPENHO[e.id], ...e })),
    receitaPorMes: gravada.receitaPorMes.map((m: LinhaDeMes) => ({
      parcelas: PARCELAS_DO_MES[m.mes ?? 0] ?? [],
      ...m,
    })),
    resumo: { semExplicacao: 0, comCausaProvavel: 4, conhecidas: 0, ...gravada.resumo },
    ...campos,
  });
}
