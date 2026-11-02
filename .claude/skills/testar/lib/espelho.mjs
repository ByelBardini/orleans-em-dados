// Onde o spec de um arquivo de produção mora, e vice-versa. Todo workspace tem
// os specs em test/ espelhando a raiz das fontes: src/ quando ela existe
// (backend, frontend), a própria raiz do workspace quando não (db, collectors).
// Integração (test/integration/) e as pastas de apoio (test/support/,
// test/setup.*) não têm espelho por desenho.
import fs from 'node:fs';
import path from 'node:path';

const EXTENSOES = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const EXTENSAO = /\.(ts|tsx|js|jsx|mjs)$/;
const SUFIXO_DE_SPEC = /\.(spec|test)\.(ts|tsx|js|jsx|mjs)$/;
const RAIZ_DOS_SPECS = 'test';
const APOIO = [/^test\/support\//, /^test\/setup\.[jt]sx?$/, /^test\/integration\//];

// Produção que não pede spec próprio: entrada e barril, configuração de
// ferramenta, migração, código gerado, fiação (provada pela integração) e
// declaração de tabela (provada pelo DAO).
const FONTES_SEM_SPEC = [
  /(^|\/)index\.[jt]sx?$/,
  /\.d\.ts$/,
  /^(src\/)?main\.[jt]sx?$/,
  /(^|\/)[\w-]+\.config\.[cm]?[jt]s$/,
  /(^|\/)migrations\//,
  /^src\/generated\//,
  /^src\/components\/ui\//,
  /^src\/lib\/utils\.ts$/,
  /\.plugin\.[jt]s$/,
  /\.po\.[jt]s$/,
];

// DTO é forma: `z.string().min(1)` puro é testar o zod. Só pede spec o DTO
// que acrescenta regra própria ao schema.
const DTO_COM_REGRA = /\.(?:refine|superRefine|transform|check|pipe)\(/;

export function ehSpec(relativo) {
  return SUFIXO_DE_SPEC.test(relativo) || /(^|\/)__tests__\//.test(relativo);
}

export function ehIntegracao(relativo) {
  return /^test\/integration\//.test(relativo);
}

export function ehApoioDeTeste(relativo) {
  return APOIO.some((padrao) => padrao.test(relativo));
}

export function ehDeTeste(relativo) {
  return relativo === RAIZ_DOS_SPECS || relativo.startsWith(`${RAIZ_DOS_SPECS}/`);
}

/** Se o caminho (relativo ao workspace) está dentro da raiz das fontes.
 *
 *  Example: `ehDeProducao({ fontes: '' }, 'conferencias.js') // true` */
export function ehDeProducao(app, relativo) {
  if (ehDeTeste(relativo)) return false;
  return app.fontes === '' || relativo.startsWith(`${app.fontes}/`);
}

/** Se a fonte dispensa spec espelhado (wiring, gerado, DTO sem regra própria).
 *
 *  Example: `fonteDispensaSpec('vite.config.js', '') // true` */
export function fonteDispensaSpec(relativo, texto = '') {
  if (FONTES_SEM_SPEC.some((padrao) => padrao.test(relativo))) return true;
  return /\.dto\.ts$/.test(relativo) && !DTO_COM_REGRA.test(texto);
}

export function aliasDeProducao(app) {
  return app.aliases[0]?.prefixo ?? null;
}

function baseSemSufixo(nomeDoArquivo) {
  return nomeDoArquivo.replace(SUFIXO_DE_SPEC, '').replace(EXTENSAO, '');
}

function listarFontes(pastaAbsoluta) {
  if (!fs.existsSync(pastaAbsoluta)) return [];
  return fs
    .readdirSync(pastaAbsoluta)
    .filter((arquivo) => EXTENSOES.has(path.extname(arquivo)) && !ehSpec(arquivo))
    .map((arquivo) => ({ arquivo, base: baseSemSufixo(arquivo) }));
}

// 'a/b' na raiz das fontes; '' é a própria raiz do workspace.
function juntar(...partes) {
  return partes.filter(Boolean).join('/');
}

function pastaDaFonteDoSpec(app, relativoDoSpec) {
  const pastaDoSpec = path.posix.dirname(relativoDoSpec);
  if (pastaDoSpec === RAIZ_DOS_SPECS) return app.fontes;
  if (!pastaDoSpec.startsWith(`${RAIZ_DOS_SPECS}/`)) return null;
  return juntar(app.fontes, pastaDoSpec.slice(RAIZ_DOS_SPECS.length + 1));
}

// 'test/x/a-sem-dono.spec.js' → a fonte 'src/x/a.js' (o prefixo mais longo
// ganha: um arquivo pode ter mais de um spec). Sem nome parecido, vale o
// primeiro import que aponte para a mesma pasta das fontes.
export function fonteDoSpec(app, relativoDoSpec, importsResolvidos = []) {
  const pastaDaFonte = pastaDaFonteDoSpec(app, relativoDoSpec);
  if (pastaDaFonte === null) return null;
  const nomeDoSpec = path.posix.basename(relativoDoSpec);
  const base = baseSemSufixo(nomeDoSpec);
  const fontes = listarFontes(path.join(app.raiz, pastaDaFonte));
  const porNome = fontes
    .filter(
      (fonte) =>
        base === fonte.base ||
        base.startsWith(`${fonte.base}-`) ||
        base.startsWith(`${fonte.base}.`),
    )
    .sort((a, b) => b.base.length - a.base.length)[0];
  const porImport = fontes.find((fonte) =>
    importsResolvidos.includes(juntar(pastaDaFonte, fonte.base)),
  );
  const escolhida = porNome ?? porImport ?? null;
  const extensao = nomeDoSpec.match(SUFIXO_DE_SPEC)?.[2] ?? 'ts';
  return {
    pastaDaFonte: pastaDaFonte || '.',
    canonico: juntar(pastaDaFonte, `${base}.${extensao}`),
    fonte: escolhida ? juntar(pastaDaFonte, escolhida.arquivo) : null,
    porNome: Boolean(porNome),
  };
}

// 'src/x/a.js' → os specs existentes que o espelham (pelo nome ou por
// importar o arquivo) e o caminho canônico do novo.
export function specsDaFonte(app, relativoDaFonte, importsDoSpec = () => []) {
  const pastaDaFonte = path.posix.dirname(relativoDaFonte);
  const dentroDasFontes =
    app.fontes === ''
      ? pastaDaFonte === '.'
        ? ''
        : pastaDaFonte
      : pastaDaFonte.slice(app.fontes.length + 1);
  const pastaDosSpecs = juntar(RAIZ_DOS_SPECS, dentroDasFontes);
  const base = baseSemSufixo(path.posix.basename(relativoDaFonte));
  const pastaAbsoluta = path.join(app.raiz, pastaDosSpecs);
  const existentes = !fs.existsSync(pastaAbsoluta)
    ? []
    : fs
        .readdirSync(pastaAbsoluta)
        .filter((arquivo) => ehSpec(arquivo))
        .map((arquivo) => `${pastaDosSpecs}/${arquivo}`)
        .filter(
          (spec) =>
            fonteDoSpec(app, spec)?.fonte === relativoDaFonte ||
            importsDoSpec(spec).includes(semExtensao(relativoDaFonte)),
        );
  const extensao = path.posix.extname(relativoDaFonte).slice(1);
  return { canonico: `${pastaDosSpecs}/${base}.spec.${extensao}`, existentes };
}

// Especificador de import/mock → caminho relativo à raiz do workspace, sem
// extensão ('@/lib/x' → 'src/lib/x'; '../../src/x.js' → 'src/x'); null para pacote.
export function resolverEspecificador(app, relativoDoSpec, especificador) {
  const alias = app.aliases.find((item) => especificador.startsWith(item.prefixo));
  if (alias) {
    const destino = path.resolve(alias.destino, especificador.slice(alias.prefixo.length));
    return semExtensao(path.relative(app.raiz, destino));
  }
  if (!especificador.startsWith('.')) return null;
  const destino = path.resolve(app.raiz, path.posix.dirname(relativoDoSpec), especificador);
  return semExtensao(path.relative(app.raiz, destino));
}

export function semExtensao(caminho) {
  return caminho.split(path.sep).join('/').replace(EXTENSAO, '');
}
