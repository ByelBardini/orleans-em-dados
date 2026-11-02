// Leitura sintática (sem type-checker) que os leitores de spec compartilham.

export function linhaDe(fonte, posicao) {
  return fonte.getLineAndCharacterOfPosition(posicao).line + 1;
}

export function nomeDoNo(ts, no) {
  if (!no) return null;
  if (ts.isIdentifier(no) || ts.isPrivateIdentifier(no)) return no.text;
  if (ts.isStringLiteral(no)) return no.text;
  return null;
}
