// Caminho do alvo → os docs/context que o agente lê ANTES de abrir fonte
// (regra do AGENTS.md). Sem tabela de apelidos: o doc de uma área tem o nome
// da pasta dela no código (`collectors/betha` → `betha.md`), e o hub de cada
// workspace tem o nome do workspace (`backend.md`, `db.md`).
import fs from 'node:fs';
import path from 'node:path';
import { paraBarras } from './ambiente.mjs';

const SEGMENTOS_ESTRUTURAIS = new Set(['src', 'test', 'modules', 'features', 'paginas', 'integration', 'support']);

/** Os docs de contexto que existem para o alvo, do hub do workspace para a
 *  área mais específica.
 *
 *  Example: `contextosDoAlvo(ambiente) // ['docs/context/collectors.md', 'docs/context/betha.md']` */
export function contextosDoAlvo(ambiente) {
  const hub = ambiente.app.nome;
  const relativo = paraBarras(path.relative(ambiente.app.raiz, ambiente.alvo));
  const pastas = relativo
    .split('/')
    .slice(0, -1)
    .concat(ehPasta(ambiente.alvo) ? relativo.split('/').slice(-1) : []);
  const areas = pastas.filter((segmento) => segmento && !SEGMENTOS_ESTRUTURAIS.has(segmento));
  const candidatos = [`${hub}.md`, ...areas.flatMap((area) => [`${area}.md`, `${hub}/${area}.md`])];
  const docs = path.join(ambiente.repo, 'docs', 'context');
  return [...new Set(candidatos)]
    .filter((candidato) => fs.existsSync(path.join(docs, candidato)))
    .map((candidato) => `docs/context/${candidato}`);
}

function ehPasta(caminho) {
  return fs.statSync(caminho).isDirectory();
}
