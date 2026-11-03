// O exercício que serve de retrato: o último já encerrado entre os publicados. Sem nenhum, nulo.
export function ultimoExercicioEncerrado(anos: readonly number[], agora: Date): number | null {
  const encerrados = anos.filter((ano) => ano < agora.getFullYear());
  return encerrados.length ? Math.max(...encerrados) : null;
}
