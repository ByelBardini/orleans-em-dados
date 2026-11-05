// Leitura em fluxo dos arquivos baixados: planilha do INEP e CSV. Nada aqui guarda linha, e o
// erro diz o arquivo e a coluna, nunca o conteúdo da linha.
import { createReadStream, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { inflateRawSync } from 'node:zlib';
import ExcelJS from 'exceljs';

export type Celula = string | number | null;
export type LinhaDaPlanilha = { aba: string; numero: number; celulas: Celula[] };
export type RegistroDaPlanilha = {
  aba: string;
  numero: number;
  campos: Record<string, Celula>;
  celulas: Celula[];
  /** Os códigos da linha de cabeçalho, por posição; vazio onde a fonte não pôs código. */
  cabecalho: readonly string[];
};

const ASSINATURA_DO_FIM_DO_ZIP = 0x06054b50;
const BOM = String.fromCharCode(0xfeff);

const decodificar = (xml: string) =>
  xml
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');

/**
 * Os textos compartilhados da planilha. O leitor em fluxo do exceljs devolve `{ sharedString: n }` em
 * parte dos arquivos do INEP, em que a tabela vem depois das abas no zip; o modo `emit` dele não
 * entrega os textos. A tabela é pequena: vai para a memória, e só neste caso.
 */
export function textosCompartilhados(caminho: string): string[] {
  const zip = readFileSync(caminho);
  let fim = zip.length - 22;
  while (fim >= 0 && zip.readUInt32LE(fim) !== ASSINATURA_DO_FIM_DO_ZIP) fim--;
  if (fim < 0) throw new Error(`${path.basename(caminho)}: não é um xlsx`);
  let posicao = zip.readUInt32LE(fim + 16);
  for (let i = 0; i < zip.readUInt16LE(fim + 10); i++) {
    const tamanhoDoNome = zip.readUInt16LE(posicao + 28);
    const nome = zip.toString('utf8', posicao + 46, posicao + 46 + tamanhoDoNome);
    if (nome === 'xl/sharedStrings.xml') {
      const local = zip.readUInt32LE(posicao + 42);
      const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const dados = zip.subarray(inicio, inicio + zip.readUInt32LE(posicao + 20));
      const xml = (zip.readUInt16LE(posicao + 10) ? inflateRawSync(dados) : dados).toString('utf8');
      return [...xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map(([, si = '']) =>
        decodificar([...si.matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map(([, t = '']) => t).join('')),
      );
    }
    posicao += 46 + tamanhoDoNome + zip.readUInt16LE(posicao + 30) + zip.readUInt16LE(posicao + 32);
  }
  return [];
}

function celulaDe(bruto: unknown, textos: () => string[]): Celula {
  if (bruto === null || bruto === undefined) return null;
  if (typeof bruto === 'string' || typeof bruto === 'number') return bruto;
  if (typeof bruto === 'object') {
    const objeto = bruto as { sharedString?: number; richText?: { text: string }[]; result?: unknown };
    if (objeto.sharedString !== undefined) return textos()[objeto.sharedString] ?? null;
    if (objeto.richText) return objeto.richText.map((t) => t.text).join('');
    if ('result' in objeto) return celulaDe(objeto.result, textos);
  }
  return String(bruto);
}

/** Todas as linhas de todas as abas, em fluxo: os arquivos municipais têm dezenas de MB. */
export async function* linhasDaPlanilha(caminho: string): AsyncGenerator<LinhaDaPlanilha> {
  let tabela: string[] | null = null;
  const textos = () => (tabela ??= textosCompartilhados(caminho));
  const leitor = new ExcelJS.stream.xlsx.WorkbookReader(caminho, {
    sharedStrings: 'cache',
    worksheets: 'emit',
    styles: 'ignore',
    hyperlinks: 'ignore',
    entries: 'ignore',
  });
  for await (const aba of leitor) {
    const nome = (aba as unknown as { name: string }).name.trim();
    let numero = 0;
    for await (const linha of aba) {
      numero++;
      const valores = linha.values as unknown[];
      const celulas: Celula[] = [];
      for (let i = 1; i < valores.length; i++) celulas.push(celulaDe(valores[i], textos));
      yield { aba: nome, numero, celulas };
    }
  }
}

const rotulo = (celula: Celula) => (typeof celula === 'string' ? celula.trim() : '');

/**
 * Registros por código de coluna. O cabeçalho é a primeira linha de cada aba com todos os `codigos`, e
 * código repetido ganha `#2`. Aba sem o cabeçalho é ignorada; arquivo inteiro sem ele é layout novo, e falha.
 */
export async function* registrosPorCodigo(
  caminho: string,
  codigos: readonly string[],
  { abas }: { abas?: RegExp } = {},
): AsyncGenerator<RegistroDaPlanilha> {
  let abaAtual: string | null = null;
  let cabecalho: string[] | null = null;
  let achou = false;
  for await (const { aba, numero, celulas } of linhasDaPlanilha(caminho)) {
    if (abas && !abas.test(aba)) continue;
    if (aba !== abaAtual) {
      abaAtual = aba;
      cabecalho = null;
    }
    if (!cabecalho) {
      const rotulos = celulas.map(rotulo);
      if (codigos.every((codigo) => rotulos.includes(codigo))) {
        const vistos = new Map<string, number>();
        cabecalho = rotulos.map((r) => {
          const vezes = (vistos.get(r) ?? 0) + 1;
          vistos.set(r, vezes);
          return vezes > 1 ? `${r}#${vezes}` : r;
        });
        achou = true;
      }
      continue;
    }
    const campos: Record<string, Celula> = {};
    cabecalho.forEach((codigo, i) => {
      if (codigo) campos[codigo] = celulas[i] ?? null;
    });
    yield { aba, numero, campos, celulas, cabecalho };
  }
  if (!achou) {
    throw new Error(`${path.basename(caminho)}: layout inesperado, sem linha de cabeçalho com ${codigos.join(', ')}`);
  }
}

function separar(linha: string, separador: string): string[] {
  if (!linha.includes('"')) return linha.split(separador);
  const campos: string[] = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else aspas = !aspas;
    } else if (c === separador && !aspas) {
      campos.push(atual);
      atual = '';
    } else atual += c;
  }
  campos.push(atual);
  return campos;
}

export type OpcoesDoCsv = { codificacao?: BufferEncoding; separador?: string };

/** CSV em fluxo, com as colunas conferidas no cabeçalho. Devolve um leitor por nome de coluna. */
export async function* linhasDoCsv(
  caminho: string,
  obrigatorias: readonly string[],
  { codificacao = 'utf8', separador = ';' }: OpcoesDoCsv = {},
): AsyncGenerator<(coluna: string) => string> {
  const linhas = createInterface({ input: createReadStream(caminho, { encoding: codificacao }), crlfDelay: Infinity });
  let indice: Map<string, number> | null = null;
  for await (const bruta of linhas) {
    if (!indice) {
      const nomes = separar(bruta.startsWith(BOM) ? bruta.slice(1) : bruta, separador).map((n) => n.trim());
      const faltam = obrigatorias.filter((o) => !nomes.includes(o));
      if (faltam.length) throw new Error(`${path.basename(caminho)}: layout inesperado, faltam ${faltam.join(', ')}`);
      indice = new Map(nomes.map((n, i) => [n, i]));
      continue;
    }
    if (!bruta) continue;
    const campos = separar(bruta, separador);
    const mapa = indice;
    yield (coluna) => campos[mapa.get(coluna) as number] ?? '';
  }
  if (!indice) throw new Error(`${path.basename(caminho)}: arquivo vazio`);
}

/** Acha o arquivo pelo nome, na pasta e nas subpastas. Nulo se não houver; temporário do Excel (`~$`) não conta. */
export function acharArquivo(pasta: string, nome: RegExp): string | null {
  for (const entrada of readdirSync(pasta).sort()) {
    const caminho = path.join(pasta, entrada);
    if (statSync(caminho).isDirectory()) {
      const achado = acharArquivo(caminho, nome);
      if (achado) return achado;
    } else if (nome.test(entrada) && !entrada.startsWith('~$')) return caminho;
  }
  return null;
}
