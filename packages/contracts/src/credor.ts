// O portal da Betha não informa CPF nem CNPJ do credor, então não dá para saber quem é pessoa física.
// O nome é publicado (a LC 131 manda divulgar o beneficiário do pagamento), mas o histórico de quem
// pode ser pessoa física não: ele pode trazer dado de saúde ou de assistência (LGPD, art. 7º, §§ 3º e 7º,
// e art. 11). Na dúvida, o nome é tratado como de pessoa: errar para esse lado só esconde uma descrição.

// Palavras inteiras, já sem acento e em maiúsculas. Ficam fora as que também são sobrenome ("SÁ" sem
// pontos, "CÂMARA").
const MARCAS = [
  'LTDA',
  'LIMITADA',
  'EIRELI',
  'ME',
  'EPP',
  'S\\.A',
  'S/A',
  'CIA',
  'COMPANHIA',
  'ASSOCIACAO',
  'COOPERATIVA',
  'FUNDACAO',
  'FUNDO',
  'INSTITUTO',
  'SINDICATO',
  'FEDERACAO',
  'CONSORCIO',
  'BANCO',
  'CAIXA',
  'PREFEITURA',
  'MUNICIPIO',
  'MUNICIPAL',
  'ESTADO',
  'SECRETARIA',
  'MINISTERIO',
  'TRIBUNAL',
  'HOSPITAL',
  'MITRA',
  'PAROQUIA',
  'IGREJA',
  'CONSELHO',
  'COMERCIO',
  'INDUSTRIA',
  'SERVICOS',
  'DISTRIBUIDORA',
  'CONSTRUTORA',
  'EMPRESA',
];

// CNPJ, cru ou formatado, como o MEI costuma aparecer ("FULANO 12345678000190").
const CNPJ = '[0-9]{14}|[0-9]{2}\\.[0-9]{3}\\.[0-9]{3}/[0-9]{4}-[0-9]{2}';

/**
 * A regra em regex que o JavaScript e o Postgres (`~`) leem igual, sobre o nome sem acento e em
 * maiúsculas. A borda é qualquer caractere que não seja letra ou dígito, para não depender de `\b`.
 */
export const PADRAO_DE_ORGANIZACAO = `(^|[^A-Z0-9])(${MARCAS.join('|')}|${CNPJ})([^A-Z0-9]|$)`;

const PADRAO = new RegExp(PADRAO_DE_ORGANIZACAO);

const normalizar = (nome: string) => nome.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();

/** O nome tem marca de empresa, órgão ou entidade. Vazio ou nulo não tem. */
export function pareceOrganizacao(nome: string | null): boolean {
  return nome !== null && PADRAO.test(normalizar(nome));
}

/** A API não mandou o histórico porque o credor pode ser pessoa física, e não por falta na fonte. */
export function historicoOmitido({ credor, historico }: { credor: string | null; historico: string | null }) {
  return historico === null && credor !== null && credor.trim() !== '' && !pareceOrganizacao(credor);
}
