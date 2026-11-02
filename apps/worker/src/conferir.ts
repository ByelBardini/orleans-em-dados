// Relatório da conferência Betha × TCE-SC no console. As consultas e a regra ficam em
// @orleans-em-dados/db/conferencias, compartilhadas com a API.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { conferencia } from '@orleans-em-dados/db/conferencias';

/** Devolve falso se faltar alguma coleta publicada. */
export async function conferirNoConsole(ano: number, pastaDeSaida: string | null): Promise<boolean> {
  const r = await conferencia(ano);

  console.log(`\nConferência Betha × TCE-SC — ${r.ano}`);
  console.table(r.coletas);
  if (!r.disponivel) {
    console.error(`Faltam coletas publicadas: ${r.faltando.join(', ')}`);
    return false;
  }
  if (r.parcial) {
    console.log(
      `Exercício incompleto no TCE: receitas até o mês ${r.limites.mesReceita}, empenhos até ${r.limites.dataEmpenho}.`,
    );
    console.log('As comparações de receita e de empenhos se limitam a esse período; a de despesa total não se aplica.');
  }
  console.log('Despesa (Betha 57170 × TCE por UG)');
  console.table(
    r.despesaPorEntidade.map(({ sigla, bethaEmpenhado, tceEmpenhado, difEmpenhado, difLiquidado, difPago }) => ({
      sigla,
      bethaEmpenhado,
      tceEmpenhado,
      difEmpenhado,
      difLiquidado,
      difPago,
    })),
  );
  console.log('Receita arrecadada por entidade (Betha 57153 × TCE)');
  console.table(r.receitaPorEntidade);
  console.log('Receita por mês');
  console.table(r.receitaPorMes);
  console.log(
    `Receita por natureza (8 dígitos × entidade): ${r.resumo.naturezasIguais}/${r.resumo.naturezasComparadas} iguais; divergentes:`,
  );
  console.table(
    r.receitaPorNatureza.map(({ descricao, nota, ...x }) => ({
      ...x,
      descricao: descricao?.slice(0, 40),
      nota: nota.slice(0, 60),
    })),
  );
  console.log('Empenhos (Betha 57140 × TCE, por entidade + número + data + valor original)');
  console.table(r.empenhos);
  if (r.empenhosSemPar.length) {
    console.log('Empenhos sem par');
    console.table(r.empenhosSemPar.slice(0, 30).map(({ id: _id, ...x }) => x));
  }

  if (pastaDeSaida) {
    await mkdir(pastaDeSaida, { recursive: true });
    const destino = path.join(pastaDeSaida, `${r.ano}.json`);
    await writeFile(destino, JSON.stringify(r, null, 2));
    console.log(`JSON → ${destino}`);
  }
  return true;
}
