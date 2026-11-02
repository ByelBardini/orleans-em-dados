// A rodada agendada de um importador: todos os exercícios dele. Falha relança, para a
// fila repetir; lote rejeitado não, porque repetir na hora traria o mesmo dado.
import {
  executar,
  type Dependencias,
  type Importador,
  type ResultadoDaExecucao,
} from '@orleans-em-dados/importador-nucleo';

export class RodadaComFalha extends Error {
  override name = 'RodadaComFalha';
}

const descreverFalhas = (resultado: ResultadoDaExecucao) =>
  resultado.consultas
    .filter((c) => c.status === 'falhou')
    .map((c) => `${resultado.importador} ${resultado.ano}: ${c.chave}: ${c.erros.join('; ')}`);

export async function rodarImportador(
  importador: Importador,
  dependencias: Dependencias,
): Promise<ResultadoDaExecucao[]> {
  const resultados: ResultadoDaExecucao[] = [];
  for (const ano of importador.anosDaRodada(dependencias.relogio())) {
    resultados.push(await executar(importador, ano, dependencias));
  }
  const falhas = resultados.filter((r) => r.status === 'falhou').flatMap(descreverFalhas);
  if (falhas.length) throw new RodadaComFalha(falhas.join(' | '));
  return resultados;
}
