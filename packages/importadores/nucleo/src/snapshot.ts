// Snapshot JSON já coletado ({ meta, registros }): os exemplos fictícios e os arquivos
// salvos com --json. Vai ao banco sem passar pela fonte; quem aprovou foi a coleta original.
import { deCentavos, dinheiro } from '@orleans-em-dados/contracts';
import { hashDosRegistros, normalizarTudo } from './executor.service';
import type {
  ConsultaImportada,
  ItemDeConferencia,
  Origem,
  RegistroBruto,
  RepositorioDeLotes,
  StatusDoLote,
} from './importador';

type ItemDoArquivo = {
  campo: string;
  titulo?: string | null;
  descricao?: string | null;
  fonte?: number | string | null;
  calculado: number | string;
  diferenca?: number | string | null;
};

export type Snapshot = {
  meta: {
    consultaId: number;
    ano: number;
    filtro: unknown;
    iniciadoEm: string;
    coletadoEm: string;
    totalHits: number;
    capturados: number;
    idsUnicos: number;
    camposAusentes?: Record<string, number>;
    conferencia?: ItemDoArquivo[];
    status: StatusDoLote;
    erros?: string[];
  };
  registros: RegistroBruto[];
};

const decimal = (v: number | string) => dinheiro(typeof v === 'number' ? deCentavos(BigInt(Math.round(v * 100))) : v);
const decimalOuNulo = (v: number | string | null | undefined) => (v === null || v === undefined ? null : decimal(v));

const paraConferencia = (item: ItemDoArquivo): ItemDeConferencia => ({
  campo: item.campo,
  titulo: item.titulo ?? null,
  descricao: item.descricao ?? null,
  fonte: decimalOuNulo(item.fonte),
  calculado: decimal(item.calculado),
  diferenca: decimalOuNulo(item.diferenca),
});

export async function gravarSnapshot(
  consulta: ConsultaImportada,
  { meta, registros }: Snapshot,
  origem: Origem,
  repositorio: RepositorioDeLotes,
) {
  const { linhas, erros } = normalizarTudo(consulta, registros);
  if (erros.length) throw new Error(erros.join('; '));

  const lote = {
    consultaId: meta.consultaId,
    tabela: consulta.tabela,
    ano: meta.ano,
    filtro: meta.filtro,
    iniciadoEm: new Date(meta.iniciadoEm),
    coletadoEm: new Date(meta.coletadoEm),
    origem,
    status: meta.status,
    totalHits: meta.totalHits,
    capturados: meta.capturados,
    idsUnicos: meta.idsUnicos,
    camposAusentes: meta.camposAusentes ?? {},
    conferencia: (meta.conferencia ?? []).map(paraConferencia),
    erros: meta.erros ?? [],
    hash: hashDosRegistros(registros),
    registros,
    linhas,
  };
  const coletaId = await repositorio.gravar(lote);
  const publicada = meta.status === 'rejeitado' ? false : await repositorio.publicar(lote, coletaId);
  return { coletaId, publicada, linhas: linhas.length };
}
