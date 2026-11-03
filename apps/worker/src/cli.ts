// CLI dos importadores. Argumentos vão direto depois do script: o pnpm repassa `--` literalmente.
//
//   pnpm importar betha --ano 2025 [--consulta receitas] [--consulta empenhos] [--json]
//   pnpm importar tcesc --ano 2025 [--consulta empenhos] [--json]
//   pnpm importar ibge --ano 2026 [--consulta ibge_censo] [--json]
//   pnpm importar siconfi --ano 2025 [--json]
//   pnpm importar --arquivo data/betha/receitas-2025.json [--arquivo outro.json]
//   pnpm importar --exemplos
//   pnpm conferir --ano 2025 [--json]
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { pool } from '@orleans-em-dados/db';
import { RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { importarArquivos, importarDaFonte, salvarSnapshot } from './comandos';
import { conferirNoConsole } from './conferir';
import { criarImportadores } from './registro';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PASTA_DE_DADOS = path.resolve(RAIZ, process.env.DATA_DIR ?? 'data');

const USO = `uso:
  pnpm importar <${criarImportadores()
    .map((i) => i.id)
    .join('|')}> --ano <ano> [--consulta <chave>] [--json]
  pnpm importar --arquivo <snapshot.json>
  pnpm importar --exemplos
  pnpm conferir --ano <ano> [--json]`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    ano: { type: 'string' },
    consulta: { type: 'string', multiple: true },
    arquivo: { type: 'string', multiple: true },
    exemplos: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
});

const repositorio = new RepositorioDeLotesPostgres();

async function importarDeArquivos(arquivos: string[]): Promise<boolean> {
  const resultados = await importarArquivos(arquivos, criarImportadores(), repositorio);
  for (const r of resultados) {
    const nome = path.relative(RAIZ, r.arquivo);
    if (r.erro) console.error(`${nome}: ${r.erro}`);
    else
      console.log(
        `${nome} → coleta ${r.coletaId} (${r.linhas} linhas)${r.publicada ? ', publicada' : ', não publicada'}`,
      );
  }
  return resultados.every((r) => !r.erro);
}

async function importar([fonte]: string[]): Promise<boolean> {
  if (values.exemplos) {
    const pasta = path.join(RAIZ, 'examples', 'betha');
    const nomes = (await readdir(pasta)).filter((f) => f.endsWith('.json'));
    return importarDeArquivos(nomes.map((f) => path.join(pasta, f)));
  }
  if (values.arquivo?.length) {
    return importarDeArquivos(values.arquivo.map((f) => path.resolve(process.env.INIT_CWD ?? process.cwd(), f)));
  }
  if (!fonte) throw new Error(USO);

  const ano = Number(values.ano ?? new Date().getFullYear());
  const resultado = await importarDaFonte(criarImportadores(), fonte, ano, values.consulta, {
    repositorio,
    relogio: () => new Date(),
    aoMontarLote: values.json
      ? async (lote, consulta) => {
          const destino = await salvarSnapshot(PASTA_DE_DADOS, fonte, consulta.chave, lote);
          console.log(`  JSON → ${path.relative(RAIZ, destino)}`);
        }
      : undefined,
  });
  for (const c of resultado.consultas) {
    const detalhe = c.erros.length ? `: ${c.erros.join('; ')}` : '';
    console.log(
      `[${fonte}] ${c.chave} ${ano}: ${c.status}, ${c.linhasLidas} registros, coleta ${c.coletaId ?? '—'}${detalhe}`,
    );
  }
  return resultado.status === 'sucesso';
}

async function principal(): Promise<boolean> {
  const [comando, ...resto] = positionals;
  if (comando === 'importar') return importar(resto);
  if (comando === 'conferir') {
    const ano = Number(values.ano ?? new Date().getFullYear() - 1);
    return conferirNoConsole(ano, values.json ? path.join(PASTA_DE_DADOS, 'conferencias') : null);
  }
  throw new Error(USO);
}

let ok = false;
try {
  ok = await principal();
} catch (erro) {
  console.error((erro as Error).message);
}
await pool.end();
process.exit(ok ? 0 : 1);
