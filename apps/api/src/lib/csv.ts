// CSV no formato que o Excel em português abre direto: BOM, `;` e vírgula decimal.
export type ColunaCsv = readonly [campo: string, titulo: string];

function celula(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  const texto =
    typeof valor === 'number' || /^-?\d+\.\d+$/.test(String(valor)) ? String(valor).replace('.', ',') : String(valor);
  return /[";\n\r]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

export function gerarCsv(colunas: readonly ColunaCsv[], linhas: readonly object[]): string {
  const corpo = [
    colunas.map(([, titulo]) => titulo),
    ...linhas.map((linha) => colunas.map(([campo]) => (linha as Record<string, unknown>)[campo])),
  ]
    .map((valores) => valores.map(celula).join(';'))
    .join('\r\n');
  return `﻿${corpo}\r\n`;
}
