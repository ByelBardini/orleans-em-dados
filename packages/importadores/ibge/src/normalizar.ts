// Resposta dos agregados → registros → linhas de ibge_valores. Valor fica em texto até o
// NUMERIC, e símbolo do SIDRA nunca vira número, salvo `-`, que a nota define como zero absoluto.
import type { RegistroBruto } from '@orleans-em-dados/importador-nucleo';
import { IBGE } from './config';

type ResultadoDoAgregado = {
  classificacoes: { categoria: Record<string, string> }[];
  series: { localidade: { id: string }; serie: Record<string, string> }[];
};

export type VariavelDoAgregado = { id: string; unidade: string; resultados: ResultadoDoAgregado[] };

export type RespostaDoAgregado = unknown;

export type LinhaDoIbge = {
  idExterno: string;
  localidade: string;
  tabela: string;
  variavel: string;
  periodo: string;
  categoria: string;
  valor: string | null;
  unidade: string;
  simbolo: string | null;
};

const SEM_VALOR = new Set(['...', '..', 'X']);
const NUMERO = /^-?\d+(\.\d+)?$/;

// O Total de uma classificação não entra: categoria vazia é o total da tabela.
const categoriaDo = ({ classificacoes }: ResultadoDoAgregado) =>
  classificacoes
    .flatMap((c) => Object.values(c.categoria))
    .filter((nome) => nome !== 'Total')
    .join('|');

export function registrosDaResposta(tabela: string, resposta: RespostaDoAgregado): RegistroBruto[] {
  if (!Array.isArray(resposta)) {
    throw new Error(`IBGE: a tabela ${tabela} não devolveu a lista de variáveis: ${JSON.stringify(resposta)}`);
  }
  return (resposta as VariavelDoAgregado[]).flatMap(({ id: variavel, unidade, resultados }) =>
    resultados.flatMap((resultado) => {
      const categoria = categoriaDo(resultado);
      return resultado.series.flatMap(({ localidade, serie }) =>
        Object.entries(serie).map(([periodo, valor]) => ({
          // Só Brasil e Santa Catarina dividem um lote: o id de Orleans não precisa da localidade.
          id: `${localidade.id === IBGE.municipio ? '' : `${localidade.id}:`}${tabela}:${variavel}:${periodo}:${categoria}`,
          tabela,
          variavel,
          unidade,
          periodo,
          categoria,
          localidade: localidade.id,
          valor,
        })),
      );
    }),
  );
}

export function normalizarValor(registro: RegistroBruto, aceitas: readonly string[] = [IBGE.municipio]): LinhaDoIbge {
  const { id, tabela, variavel, unidade, periodo, categoria, localidade, valor } = registro as RegistroBruto &
    Omit<LinhaDoIbge, 'idExterno' | 'simbolo'>;
  if (!aceitas.includes(localidade)) {
    throw new Error(`localidade ${localidade} recebida; esperado ${aceitas.join(' ou ')}`);
  }
  const base = { idExterno: id, localidade, tabela, variavel, periodo, categoria, unidade };
  if (typeof valor === 'string' && SEM_VALOR.has(valor)) return { ...base, valor: null, simbolo: valor };
  if (valor === '-') return { ...base, valor: '0', simbolo: '-' };
  if (typeof valor !== 'string' || !NUMERO.test(valor)) {
    throw new Error(`valor ${JSON.stringify(valor)} não é número nem símbolo conhecido do SIDRA`);
  }
  return { ...base, valor, simbolo: null };
}
