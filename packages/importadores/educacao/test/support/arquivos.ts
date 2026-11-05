// Arquivos fictícios gerados no teste, numa pasta temporária: planilhas no formato do INEP e CSVs.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { afterEach } from 'vitest';
import type { Lote } from '../../src/extratores/snapshot';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const COMPRIMIDO = 8;

const pastas: string[] = [];

afterEach(() => {
  while (pastas.length) rmSync(pastas.pop() as string, { recursive: true, force: true });
});

export function pastaTemporaria(): string {
  const pasta = mkdtempSync(path.join(tmpdir(), 'orleans-educacao-'));
  pastas.push(pasta);
  return pasta;
}

type Aba = { nome: string; linhas: (string | number | null)[][] };

const escapar = (texto: string) => texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const colunaDe = (i: number): string =>
  i < 26 ? String.fromCharCode(65 + i) : `${colunaDe(Math.floor(i / 26) - 1)}${colunaDe(i % 26)}`;

// A ordem das entradas é a dos arquivos do INEP: as abas antes dos textos
// compartilhados. O escritor do exceljs grava a ordem inversa, que o leitor em fluxo dele não lê.
function zip(entradas: [string, string][]): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let posicao = 0;
  for (const [nome, conteudo] of entradas) {
    const original = Buffer.from(conteudo);
    const dados = deflateRawSync(original);
    const nomeEmBytes = Buffer.from(nome);
    const crc = crc32(original);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(COMPRIMIDO, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(original.length, 22);
    local.writeUInt16LE(nomeEmBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(COMPRIMIDO, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt32LE(original.length, 24);
    central.writeUInt16LE(nomeEmBytes.length, 28);
    central.writeUInt32LE(posicao, 42);
    locais.push(local, nomeEmBytes, dados);
    centrais.push(central, nomeEmBytes);
    posicao += local.length + nomeEmBytes.length + dados.length;
  }
  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(entradas.length, 8);
  fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(posicao, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}

/** Uma planilha xlsx fictícia, no formato e na ordem de entradas dos arquivos do INEP. */
export async function planilha(pasta: string, arquivo: string, abas: Aba[]): Promise<string> {
  const textos: string[] = [];
  const indice = (texto: string) => {
    const achado = textos.indexOf(texto);
    if (achado >= 0) return achado;
    textos.push(texto);
    return textos.length - 1;
  };
  const folha = ({ linhas }: Aba) => {
    const corpo = linhas
      .map((linha, l) => {
        const celulas = linha
          .map((valor, c) => {
            const ref = `${colunaDe(c)}${l + 1}`;
            if (valor === null) return '';
            return typeof valor === 'number'
              ? `<c r="${ref}"><v>${valor}</v></c>`
              : `<c r="${ref}" t="s"><v>${indice(valor)}</v></c>`;
          })
          .join('');
        return `<row r="${l + 1}">${celulas}</row>`;
      })
      .join('');
    return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}"><sheetData>${corpo}</sheetData></worksheet>`;
  };
  const folhas = abas.map(folha);
  const textosCompartilhadosXml = (): [string, string] => [
    'xl/sharedStrings.xml',
    `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="${NS}">${textos
      .map((t) => `<si><t>${escapar(t)}</t></si>`)
      .join('')}</sst>`,
  ];
  const caminho = path.join(pasta, arquivo);
  writeFileSync(
    caminho,
    zip([
      [
        '[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
      ],
      [
        'xl/workbook.xml',
        `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets>${abas
          .map((a, i) => `<sheet name="${escapar(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join('')}</sheets></workbook>`,
      ],
      [
        'xl/_rels/workbook.xml.rels',
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas
          .map(
            (_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('')}</Relationships>`,
      ],
      // Com mais de uma aba, o leitor em fluxo só entrega todas se os textos vierem antes delas.
      ...(abas.length > 1 ? [textosCompartilhadosXml()] : []),
      ...folhas.map((xml, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, xml]),
      ...(abas.length > 1 ? [] : [textosCompartilhadosXml()]),
    ]),
  );
  return caminho;
}

export function csv(pasta: string, arquivo: string, linhas: string[]): string {
  mkdirSync(pasta, { recursive: true });
  const caminho = path.join(pasta, arquivo);
  writeFileSync(caminho, `${linhas.join('\n')}\n`);
  return caminho;
}

type Registro = Record<string, unknown> & { id: string };

export const registroDe = (lote: Lote, id: string) => (lote.registros as Registro[]).find((r) => r.id === id);
export const idsDe = (lote: Lote) => (lote.registros as Registro[]).map((r) => r.id);
