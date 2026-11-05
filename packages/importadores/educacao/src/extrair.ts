// CLI dos extratores: arquivos baixados → snapshots em docs/educacao/snapshots. Não toca no banco.
//
//   pnpm extrair educacao inep --origem <pasta> [--de-extratos]
//   pnpm extrair educacao siope --origem <pasta>
//   pnpm extrair educacao enem --origem <pasta>
//   pnpm extrair educacao superior --origem <pasta>
//   pnpm extrair educacao mec
//   pnpm extrair educacao varrer --origem <pasta>
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { extrairEnem } from './extratores/enem';
import { extrairInep } from './extratores/inep';
import { extrairMec } from './extratores/mec';
import { gravarLotes, type Lote } from './extratores/snapshot';
import { extrairSiope } from './extratores/siope';
import { extrairSuperior } from './extratores/superior';
import { varrerPastas } from './extratores/varredura';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const SNAPSHOTS = path.join(RAIZ, 'docs/educacao/snapshots');
const CURADOS = path.join(RAIZ, 'docs/educacao/curados');
const EXTRATOS = path.join(RAIZ, 'docs/educacao/extratos');

const USO = `uso:
  pnpm extrair educacao <inep|siope|enem|superior> --origem <pasta> [--de-extratos] [--destino <pasta>]
  pnpm extrair educacao mec [--destino <pasta>]
  pnpm extrair educacao varrer --origem <pasta>`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    origem: { type: 'string' },
    destino: { type: 'string' },
    'de-extratos': { type: 'boolean', default: false },
  },
});

const noCwd = (caminho: string) => path.resolve(process.env.INIT_CWD ?? process.cwd(), caminho);

function origemExigida(): string {
  if (!values.origem) throw new Error(USO);
  return noCwd(values.origem);
}

async function lotesDe(alvo: string | undefined): Promise<Lote[]> {
  switch (alvo) {
    case 'inep':
      return extrairInep({ origem: origemExigida(), deExtratos: values['de-extratos'] ? EXTRATOS : undefined });
    case 'siope':
      return extrairSiope({ origem: origemExigida(), curados: CURADOS });
    case 'enem':
      return extrairEnem({ origem: origemExigida() });
    case 'superior':
      return extrairSuperior({ origem: origemExigida() });
    case 'mec':
      return extrairMec({ curados: CURADOS });
    default:
      throw new Error(USO);
  }
}

const veioDoExtrato = ({ filtro }: Lote) => filtro.extrato === true;

async function principal() {
  const [fonte, alvo] = positionals;
  if (fonte !== 'educacao') throw new Error(USO);
  if (alvo === 'varrer') {
    const { nomes, cpfs, achados } = await varrerPastas(origemExigida(), [SNAPSHOTS, CURADOS]);
    console.log(`Varredura: ${nomes} nomes e ${cpfs} CPFs procurados; ${achados} achados.`);
    if (achados) process.exitCode = 1;
    return;
  }
  const lotes = await lotesDe(alvo);
  const destino = values.destino ? noCwd(values.destino) : SNAPSHOTS;
  const arquivos = await gravarLotes(lotes, destino, new Date());
  lotes.forEach((lote, i) => {
    const origem = veioDoExtrato(lote) ? ' (Orleans a partir de extrato)' : '';
    console.log(`${path.relative(RAIZ, arquivos[i] as string)}: ${lote.registros.length} registros${origem}`);
  });
  const deExtrato = lotes.filter(veioDoExtrato).map((l) => `${l.chave}-${l.ano}`);
  if (deExtrato.length) console.log(`Lotes com Orleans vindo de extrato: ${deExtrato.join(', ')}`);
}

try {
  await principal();
} catch (erro) {
  console.error((erro as Error).message);
  process.exitCode = 1;
}
