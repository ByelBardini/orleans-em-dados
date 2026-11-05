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

// Só Brasil e Santa Catarina dividem um lote com Orleans: o id de Orleans não precisa da localidade.
const idDoRegistro = (localidade: string, tabela: string, variavel: string, periodo: string, categoria: string) =>
  `${localidade === IBGE.municipio ? '' : `${localidade}:`}${tabela}:${variavel}:${periodo}:${categoria}`;

export function registrosDaResposta(tabela: string, resposta: RespostaDoAgregado): RegistroBruto[] {
  if (!Array.isArray(resposta)) {
    throw new Error(`IBGE: a tabela ${tabela} não devolveu a lista de variáveis: ${JSON.stringify(resposta)}`);
  }
  return (resposta as VariavelDoAgregado[]).flatMap(({ id: variavel, unidade, resultados }) =>
    resultados.flatMap((resultado) => {
      const categoria = categoriaDo(resultado);
      return resultado.series.flatMap(({ localidade, serie }) =>
        Object.entries(serie).map(([periodo, valor]) => ({
          id: idDoRegistro(localidade.id, tabela, variavel, periodo, categoria),
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

// Recortes da mesma tabela repetem linhas (o total, por exemplo). Só sai a repetição exata: o mesmo id com outro
// conteúdo fica, e o executor recusa o lote por id repetido.
export function semRepetidos(registros: readonly RegistroBruto[]): RegistroBruto[] {
  const vistos = new Set<string>();
  return registros.filter((registro) => {
    const conteudo = JSON.stringify(registro);
    if (vistos.has(conteudo)) return false;
    vistos.add(conteudo);
    return true;
  });
}

// Pesquisas (API v1): a resposta só traz o id do indicador; o nome e a unidade estão na árvore.
type NoDaArvore = { id: number; indicador: string; unidade?: { id: string } | null; children?: NoDaArvore[] };
type ResultadoDaPesquisa = { id: number; res: { localidade: string; res: Record<string, string | null> }[] };

// As raízes que não distinguem nada. "Ensino superior" fica: sem ela, "Matrículas > Municipal" não diria a etapa.
const RAIZES_OMITIDAS = new Set(['Ensino básico', 'Índice de Desenvolvimento da Educação Básica']);
const UNIDADE_DO_IDEB = 'índice'; // os nós da pesquisa 40 não trazem unidade
const SEPARADOR_DA_ARVORE = ' > ';
// A API de pesquisas identifica o município sem o dígito verificador.
const ORLEANS_NA_PESQUISA = IBGE.municipio.slice(0, 6);

function indicadoresDaArvore(nos: readonly NoDaArvore[], caminho: readonly string[] = []) {
  const indicadores = new Map<number, { categoria: string; unidade: string }>();
  for (const no of nos) {
    const omitida = caminho.length === 0 && RAIZES_OMITIDAS.has(no.indicador);
    const proximo = omitida ? caminho : [...caminho, no.indicador];
    indicadores.set(no.id, {
      categoria: proximo.join(SEPARADOR_DA_ARVORE),
      unidade: no.unidade?.id ?? UNIDADE_DO_IDEB,
    });
    for (const [id, indicador] of indicadoresDaArvore(no.children ?? [], proximo)) indicadores.set(id, indicador);
  }
  return indicadores;
}

export function registrosDaPesquisa(pesquisa: string, arvore: unknown, resultados: unknown): RegistroBruto[] {
  if (!Array.isArray(arvore) || !Array.isArray(resultados)) {
    throw new Error(`IBGE: a pesquisa ${pesquisa} não devolveu a lista esperada: ${JSON.stringify(resultados)}`);
  }
  const indicadores = indicadoresDaArvore(arvore as NoDaArvore[]);
  const tabela = `pesquisa-${pesquisa}`;
  return (resultados as ResultadoDaPesquisa[]).flatMap(({ id, res }) => {
    const indicador = indicadores.get(id);
    return res.flatMap(({ localidade, res: serie }) => {
      const lugar = localidade === ORLEANS_NA_PESQUISA ? IBGE.municipio : localidade;
      return Object.entries(serie).map(([periodo, valor]) => ({
        id: idDoRegistro(lugar, tabela, String(id), periodo, indicador?.categoria ?? ''),
        tabela,
        variavel: String(id),
        unidade: indicador?.unidade ?? null,
        periodo,
        categoria: indicador?.categoria ?? null,
        localidade: lugar,
        valor,
      }));
    });
  });
}

// Nas pesquisas, `-` e vazio são falta de dado: nulo, nunca zero. É diferente do `-` dos agregados.
export function normalizarPesquisa(registro: RegistroBruto, aceitas: readonly string[]): LinhaDoIbge {
  const { id, tabela, variavel, unidade, periodo, categoria, localidade, valor } = registro as RegistroBruto &
    Omit<LinhaDoIbge, 'idExterno' | 'simbolo'>;
  if (!aceitas.includes(localidade)) {
    throw new Error(`localidade ${localidade} recebida; esperado ${aceitas.join(' ou ')}`);
  }
  if (typeof categoria !== 'string') throw new Error(`indicador ${variavel} fora da árvore da pesquisa`);
  const base = { idExterno: id, localidade, tabela, variavel, periodo, categoria, unidade };
  if (valor === null || (valor as string) === '') return { ...base, valor: null, simbolo: null };
  if (valor === '-' || SEM_VALOR.has(valor)) return { ...base, valor: null, simbolo: valor };
  if (typeof valor !== 'string' || !NUMERO.test(valor)) {
    throw new Error(`valor ${JSON.stringify(valor)} não é número nem símbolo conhecido`);
  }
  return { ...base, valor, simbolo: null };
}
