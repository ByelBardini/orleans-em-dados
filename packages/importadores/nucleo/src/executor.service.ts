// Executa um importador num exercício: coletar → normalizar → validar → gravar → publicar,
// consulta por consulta, com a execução registrada. Lote reprovado fica gravado para
// análise e a publicação anterior continua. Falha numa consulta não impede a seguinte.
import { createHash } from 'node:crypto';
import type {
  Coleta,
  ConsultaImportada,
  Importador,
  Lote,
  RegistroBruto,
  RepositorioDeLotes,
  ResultadoDaConsulta,
  ResultadoDaExecucao,
  StatusDaExecucao,
} from './importador';

export type Dependencias = { repositorio: RepositorioDeLotes; relogio: () => Date };

const MAX_ERROS_DE_NORMALIZACAO = 10;

export function ocultarSegredos(texto: string): string {
  return texto
    .replace(/Bearer\s+[^\s,;]+/g, 'Bearer [oculto]')
    .replace(/access_token=[^&\s#]+/g, 'access_token=[oculto]');
}

export const hashDosRegistros = (registros: readonly RegistroBruto[]) =>
  createHash('sha256').update(JSON.stringify(registros)).digest('hex');

function errosDeIntegridade(coleta: Coleta): string[] {
  const erros = [...(coleta.erros ?? [])];
  const capturados = coleta.registros.length;
  const unicos = new Set(coleta.registros.map((r) => r.id)).size;
  if (capturados !== coleta.totalHits) erros.push(`capturados ${capturados} de ${coleta.totalHits}`);
  if (unicos !== capturados) erros.push(`${capturados - unicos} IDs repetidos`);
  return erros;
}

// Repetidos não viram duas linhas: a primeira ocorrência é a que fica, como no bruto.
export function normalizarTudo(consulta: ConsultaImportada, registros: readonly RegistroBruto[]) {
  const vistos = new Set<string>();
  const linhas: Record<string, unknown>[] = [];
  const erros: string[] = [];
  for (const registro of registros) {
    if (vistos.has(registro.id)) continue;
    vistos.add(registro.id);
    try {
      linhas.push(consulta.normalizar(registro));
    } catch (erro) {
      if (erros.length < MAX_ERROS_DE_NORMALIZACAO) erros.push(`registro ${registro.id}: ${(erro as Error).message}`);
    }
  }
  return erros.length ? { linhas: [], erros } : { linhas, erros };
}

function montarLote(
  consulta: ConsultaImportada,
  ano: number,
  coleta: Coleta,
  iniciadoEm: Date,
  coletadoEm: Date,
): Lote {
  const { linhas, erros: errosDeNormalizacao } = normalizarTudo(consulta, coleta.registros);
  const validacao = errosDeNormalizacao.length ? { conferencia: [], erros: [] } : consulta.validar(coleta, linhas);
  const erros = [...errosDeIntegridade(coleta), ...errosDeNormalizacao, ...validacao.erros];
  return {
    consultaId: consulta.id,
    tabela: consulta.tabela,
    ano,
    filtro: coleta.filtro,
    iniciadoEm,
    coletadoEm,
    origem: 'api',
    status: erros.length ? 'rejeitado' : 'totalizador_conciliado',
    totalHits: coleta.totalHits,
    capturados: coleta.registros.length,
    idsUnicos: new Set(coleta.registros.map((r) => r.id)).size,
    camposAusentes: coleta.camposAusentes ?? {},
    conferencia: validacao.conferencia,
    erros,
    hash: hashDosRegistros(coleta.registros),
    registros: coleta.registros,
    linhas,
  };
}

async function executarConsulta(
  consulta: ConsultaImportada,
  ano: number,
  { repositorio, relogio }: Dependencias,
): Promise<ResultadoDaConsulta> {
  const base = { consultaId: consulta.id, chave: consulta.chave };
  let linhasLidas = 0;
  try {
    const iniciadoEm = relogio();
    const coleta = await consulta.coletar({ ano });
    linhasLidas = coleta.registros.length;
    const lote = montarLote(consulta, ano, coleta, iniciadoEm, relogio());

    if (lote.status === 'rejeitado') {
      const coletaId = await repositorio.gravar(lote);
      return {
        ...base,
        status: 'rejeitada',
        coletaId,
        linhasLidas,
        linhasGravadas: lote.linhas.length,
        erros: lote.erros,
      };
    }

    // A entrega é at-least-once e o dado muda pouco: mesmo conteúdo não vira outra coleta.
    const publicada = await repositorio.publicada(consulta.id, ano);
    if (publicada?.hash === lote.hash) {
      await repositorio.reconfirmar(publicada.coletaId, lote.coletadoEm);
      return {
        ...base,
        status: 'sem_mudanca',
        coletaId: publicada.coletaId,
        linhasLidas,
        linhasGravadas: 0,
        erros: [],
      };
    }

    const coletaId = await repositorio.gravar(lote);
    const foiPublicada = await repositorio.publicar(lote, coletaId);
    return {
      ...base,
      status: foiPublicada ? 'publicada' : 'nao_publicada',
      coletaId,
      linhasLidas,
      linhasGravadas: lote.linhas.length,
      erros: [],
    };
  } catch (erro) {
    const mensagem = ocultarSegredos(erro instanceof Error ? erro.message : String(erro));
    return { ...base, status: 'falhou', linhasLidas, linhasGravadas: 0, erros: [mensagem] };
  }
}

function statusDaExecucao(consultas: readonly ResultadoDaConsulta[]): StatusDaExecucao {
  if (consultas.some((c) => c.status === 'falhou')) return 'falhou';
  if (consultas.some((c) => c.status === 'rejeitada')) return 'rejeitada';
  return 'sucesso';
}

export async function executar(
  importador: Importador,
  ano: number,
  dependencias: Dependencias,
  chaves?: readonly string[],
): Promise<ResultadoDaExecucao> {
  const { repositorio, relogio } = dependencias;
  const execucaoId = await repositorio.abrirExecucao(importador.id, ano, relogio());
  const consultas: ResultadoDaConsulta[] = [];
  for (const consulta of importador.consultas) {
    if (chaves && !chaves.includes(consulta.chave)) continue;
    consultas.push(await executarConsulta(consulta, ano, dependencias));
  }
  const resultado: ResultadoDaExecucao = {
    execucaoId,
    importador: importador.id,
    ano,
    status: statusDaExecucao(consultas),
    consultas,
  };
  await repositorio.fecharExecucao(execucaoId, resultado, relogio());
  return resultado;
}
