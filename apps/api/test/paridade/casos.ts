// Cada pedido que o dashboard faz (ou pode fazer) à API, comparado com a resposta
// gravada em respostas/. A suíte roda contra qualquer API pela URL base.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'respostas');

export const CASOS = [
  '/api/anos',
  '/api/conferencias?ano=2025',
  '/api/conferencias?ano=2019',
  '/api/conferencias?ano=abc',
  '/api/receitas?ano=2025',
  '/api/receitas?ano=2025&entidade=319',
  '/api/receitas?ano=2019',
  '/api/receitas?ano=abc',
  '/api/receitas',
  '/api/receitas.csv?ano=2025',
  '/api/receitas.csv?ano=2025&entidade=728',
  '/api/receitas.csv?ano=2019',
  '/api/despesas/resumo?ano=2025',
  '/api/despesas/resumo?ano=2025&entidade=728',
  '/api/despesas/resumo?ano=2019',
  '/api/despesas/empenhos/resumo?ano=2025',
  '/api/despesas/empenhos/resumo?ano=2025&entidade=319',
  '/api/despesas/empenhos/resumo?ano=2019',
  '/api/despesas/empenhos?ano=2025',
  '/api/despesas/empenhos?ano=2025&q=merenda',
  '/api/despesas/empenhos?ano=2025&q=saude',
  '/api/despesas/empenhos?ano=2025&q=11',
  '/api/despesas/empenhos?ano=2025&entidade=319',
  '/api/despesas/empenhos?ano=2025&orgao=SECRETARIA%20MUNICIPAL%20DE%20OBRAS',
  '/api/despesas/empenhos?ano=2025&situacao=pago',
  '/api/despesas/empenhos?ano=2025&situacao=apagar',
  '/api/despesas/empenhos?ano=2025&situacao=sem',
  '/api/despesas/empenhos?ano=2025&situacao=desconhecida',
  '/api/despesas/empenhos?ano=2025&offset=2&limit=2',
  '/api/despesas/empenhos?ano=2025&offset=-5&limit=999',
  '/api/despesas/empenhos?ano=2025&offset=abc&limit=abc',
  '/api/despesas/empenhos?ano=2019',
  '/api/despesas/empenhos.csv?ano=2025',
  '/api/despesas/empenhos.csv?ano=2025&q=construtora',
  '/api/despesas/empenhos.csv?ano=2019',
  '/api/inexistente',
];

const arquivoDo = (caso: string) => path.join(PASTA, `${caso.slice(1).replace(/[^\w.-]+/g, '_')}.json`);

// `geradoEm` da conferência é a hora da chamada; o resto é determinístico.
function semHoraDaChamada(corpo: unknown) {
  if (corpo && typeof corpo === 'object' && 'geradoEm' in corpo) return { ...corpo, geradoEm: '<hora da chamada>' };
  return corpo;
}

// O corpo é comparado com a resposta gravada: a forma dele é da resposta, não do teste.
export async function pedir(
  base: string,
  caso: string,
  opcoes?: RequestInit,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ status: number; tipo: string | null; disposicao: string | null; corpo: any }> {
  const resposta = await fetch(`${base}${caso}`, opcoes);
  // Sem tirar o BOM do CSV: ele é parte do contrato.
  const texto = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await resposta.arrayBuffer());
  const tipo = resposta.headers.get('content-type');
  return {
    status: resposta.status,
    tipo,
    disposicao: resposta.headers.get('content-disposition'),
    corpo: tipo?.includes('json') ? semHoraDaChamada(JSON.parse(texto)) : texto,
  };
}

export function gravarResposta(caso: string, resposta: unknown) {
  mkdirSync(PASTA, { recursive: true });
  writeFileSync(arquivoDo(caso), `${JSON.stringify(resposta, null, 2)}\n`);
}

export function respostaGravada(caso: string) {
  const arquivo = arquivoDo(caso);
  if (!existsSync(arquivo)) throw new Error(`Sem resposta gravada para ${caso} (${path.basename(arquivo)})`);
  return JSON.parse(readFileSync(arquivo, 'utf8'));
}
