// A varredura final: procura nas pastas publicadas os nomes e CPFs das planilhas de remuneração, além do
// padrão de CPF. Só devolve contagens: nenhum nome ou CPF sai daqui, nem para dizer onde foi achado.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pareceCpf } from '../guarda';
import { linhasDoCsv } from './arquivos';

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();

/** O miolo do CPF, que é o que a planilha mostra: `***.456.789-**` → `456.789`. */
const mioloDoCpf = (cpf: string) => /\d{3}\.\d{3}/.exec(cpf)?.[0] ?? null;

export type Procurados = { nomes: Set<string>; cpfs: Set<string> };

export async function coletarProcurados(pasta: string): Promise<Procurados> {
  const procurados: Procurados = { nomes: new Set(), cpfs: new Set() };
  for (const nome of await readdir(pasta)) {
    if (!/^Planilha.*\.csv$/.test(nome)) continue;
    for await (const campo of linhasDoCsv(path.join(pasta, nome), ['Nome', 'CPF'])) {
      const completo = normalizar(campo('Nome'));
      if (completo) {
        procurados.nomes.add(completo);
        const partes = completo.split(' ');
        if (partes.length > 2) procurados.nomes.add(partes.slice(0, 2).join(' '));
      }
      const miolo = mioloDoCpf(campo('CPF'));
      if (miolo) procurados.cpfs.add(miolo);
    }
  }
  return procurados;
}

/** Quantas ocorrências distintas de nome, CPF ou padrão de CPF há em `texto`. */
export function contarAchados(texto: string, { nomes, cpfs }: Procurados): number {
  const normalizado = normalizar(texto);
  let achados = 0;
  for (const nome of nomes) if (normalizado.includes(nome)) achados++;
  for (const cpf of cpfs) if (texto.includes(cpf)) achados++;
  if (pareceCpf(texto)) achados++;
  return achados;
}

async function textosDe(pasta: string): Promise<string[]> {
  let nomes: string[];
  try {
    nomes = await readdir(pasta);
  } catch {
    return [];
  }
  return Promise.all(nomes.filter((n) => n.endsWith('.json')).map((n) => readFile(path.join(pasta, n), 'utf8')));
}

export async function varrerPastas(origem: string, pastas: readonly string[]) {
  const dirs = await readdir(origem);
  const remuneracao = dirs.find((d) => /^remunera(ç|c)(ã|a)o$/.test(d.normalize('NFC')));
  const procurados = await coletarProcurados(remuneracao ? path.join(origem, remuneracao) : origem);
  let achados = 0;
  for (const pasta of pastas) {
    for (const texto of await textosDe(pasta)) achados += contarAchados(texto, procurados);
  }
  return { nomes: procurados.nomes.size, cpfs: procurados.cpfs.size, achados };
}
