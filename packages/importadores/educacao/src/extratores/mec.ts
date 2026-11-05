// Retrato da Educação Infantil: transcrito da tela em docs/educacao/curados/retrato-mec.json.
// É o que a Prefeitura respondeu ao MEC, não uma contagem de crianças: tudo em texto.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ORLEANS, SANTA_CATARINA } from '../vocabulario';
import { registroDeValor, type Lote } from './snapshot';

export type RetratoCurado = {
  ano: number;
  respostas: Record<string, string | null>;
  distribuicao_sc: Record<string, number>;
};

export function loteDoRetrato({ ano, respostas, distribuicao_sc }: RetratoCurado): Lote {
  const periodo = String(ano);
  return {
    chave: 'mec_retrato',
    ano,
    filtro: { arquivo: 'docs/educacao/curados/retrato-mec.json', lido: 'na tela do painel', extrato: false },
    registros: [
      ...Object.entries(respostas).map(([chave, texto]) =>
        registroDeValor({
          indicador: `retrato_${chave}`,
          lugar: ORLEANS,
          rede: 'municipal',
          periodo,
          texto,
          unidade: 'texto',
        }),
      ),
      ...Object.entries(distribuicao_sc).map(([nivel, municipios]) =>
        registroDeValor({
          indicador: 'retrato_distribuicao',
          lugar: SANTA_CATARINA,
          rede: 'municipal',
          recorte: nivel,
          periodo,
          valor: String(municipios),
          unidade: 'municipios',
        }),
      ),
    ],
  };
}

export async function extrairMec({ curados }: { curados: string }): Promise<Lote[]> {
  const curado = JSON.parse(await readFile(path.join(curados, 'retrato-mec.json'), 'utf8')) as RetratoCurado;
  return [loteDoRetrato(curado)];
}
