// O filtro da busca de empenhos: o que o usuário pede vai sempre como parâmetro.
// Roda sobre o conjunto de `empenhos.dao.ts`, em que `liquidado` e `saldo` são os publicados.
import { chaveTexto } from '../../lib/consultas';

// NULL no liquidado é ausência de informação na fonte, não zero.
const SITUACOES = new Map([
  ['pago', 'e.liquidado IS NOT NULL AND e.saldo = 0'],
  ['apagar', 'e.saldo > 0'],
  ['sem', 'e.liquidado IS NULL'],
]);

export type OpcoesDaBusca = { q?: string; entidade?: string; orgao?: string; situacao?: string };

// Busca sem acento e sem diferenciar maiúsculas em número, credor, histórico e órgão.
// `inicio`: o número do primeiro parâmetro do filtro; os anteriores são do conjunto.
export function filtroBusca({ q = '', entidade = '', orgao = '', situacao = '' }: OpcoesDaBusca, inicio = 1) {
  const [ent, termo, org] = [`$${inicio}`, `$${inicio + 1}`, `$${inicio + 2}`];
  const clausula = SITUACOES.get(situacao);
  const filtro = `(${ent} = '' OR e.entidade_codigo = ${ent})
    AND (${termo} = '' OR unaccent(concat_ws(' ', e.numero::text, e.credor, e.historico, e.orgao)) ILIKE unaccent('%' || ${termo} || '%'))
    AND (${org} = '' OR ${chaveTexto('e.orgao')} = ${org})
    ${clausula ? `AND ${clausula}` : ''}`;
  return { filtro, params: [entidade, q.trim(), orgao] };
}
