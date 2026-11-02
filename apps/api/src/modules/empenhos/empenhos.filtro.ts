// O filtro da busca de empenhos: o que o usuário pede vai sempre como parâmetro.
import { chaveTexto } from '../../lib/consultas';

// Situação a partir dos valores publicados. NULL em liquidado/pago é ausência de
// informação na fonte, não zero.
const SITUACOES = new Map([
  ['pago', 'valor_liquidado IS NOT NULL AND coalesce(saldo_a_pagar, 0) = 0'],
  ['apagar', 'saldo_a_pagar > 0'],
  ['sem', 'valor_liquidado IS NULL'],
]);

export type OpcoesDaBusca = { q?: string; entidade?: string; orgao?: string; situacao?: string };

// Busca sem acento e sem diferenciar maiúsculas em número, credor, histórico e órgão.
export function filtroBusca({ q = '', entidade = '', orgao = '', situacao = '' }: OpcoesDaBusca) {
  const clausula = SITUACOES.get(situacao);
  const filtro = `coleta_id = $1
    AND ($2 = '' OR e.entidade_codigo = $2)
    AND ($3 = '' OR unaccent(concat_ws(' ', numero::text, credor, historico, orgao)) ILIKE unaccent('%' || $3 || '%'))
    AND ($4 = '' OR ${chaveTexto('orgao')} = $4)
    ${clausula ? `AND ${clausula}` : ''}`;
  return { filtro, params: [entidade, q.trim(), orgao] };
}
