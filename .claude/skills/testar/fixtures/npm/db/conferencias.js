// Classifica a diferença entre duas fontes do mesmo valor.
export function classificar(betha, tce) {
  const diferenca = Math.abs(betha - tce);
  if (diferenca === 0) return 'confere';
  if (diferenca <= 0.01) return 'arredondamento';
  return 'diverge';
}
