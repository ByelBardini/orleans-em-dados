// O build do web, em miniatura: o index com o bloco do head, um asset com hash no nome e um arquivo público.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function distFalso() {
  const pasta = mkdtempSync(path.join(tmpdir(), 'orleans-dist-'));
  mkdirSync(path.join(pasta, 'assets'));
  writeFileSync(
    path.join(pasta, 'index.html'),
    '<!doctype html><html><head><!--head:inicio--><title>Orleans em Dados</title><!--head:fim--></head>' +
      '<body><div id="root"></div></body></html>',
  );
  writeFileSync(path.join(pasta, 'assets', 'index-abc123.js'), 'console.log(1)');
  writeFileSync(path.join(pasta, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  return pasta;
}
