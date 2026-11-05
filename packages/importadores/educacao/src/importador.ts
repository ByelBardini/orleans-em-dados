// Os importadores por arquivo: INEP, SIOPE e MEC. Não têm agenda nem coletam: `pnpm extrair educacao`
// gera os snapshots a partir dos arquivos baixados, e `pnpm importar --arquivo` os carrega.
import { tabelas } from '@orleans-em-dados/db';
import type {
  Coleta,
  ConsultaImportada,
  Importador,
  RegistroBruto,
  Validacao,
} from '@orleans-em-dados/importador-nucleo';
import { CAMPOS_DE_FINANCAS, CAMPOS_DE_VALORES, recusarDadoPessoal } from './guarda';
import { MENOS_DE_5, rendimentoFecha, somaDoRendimento } from './validacoes';
import { ETAPAS, LUGARES, REDES, UNIDADES } from './vocabulario';

export type LinhaDeValor = {
  idExterno: string;
  periodo: string;
  indicador: string;
  lugar: string;
  rede: string;
  etapa: string;
  recorte: string;
  valor: string | null;
  texto: string | null;
  unidade: string;
};

export type LinhaDeFinanca = {
  idExterno: string;
  periodo: string;
  indicador: string;
  lugar: string;
  rede: string;
  recorte: string;
  valor: string | null;
  percentual: string | null;
};

const DECIMAL = /^-?\d+(\.\d+)?$/;
const DINHEIRO = /^-?\d+(\.\d{1,2})?$/;

function textoDe(registro: RegistroBruto, campo: string): string {
  const valor = registro[campo];
  if (typeof valor !== 'string') throw new Error(`campo ${campo} não é texto`);
  return valor;
}

function noVocabulario(registro: RegistroBruto, campo: string, lista: ReadonlySet<string>): string {
  const valor = textoDe(registro, campo);
  if (!lista.has(valor)) throw new Error(`${campo} fora do vocabulário: ${valor}`);
  return valor;
}

function decimalOuNulo(registro: RegistroBruto, campo: string, formato = DECIMAL): string | null {
  const valor = registro[campo] ?? null;
  if (valor !== null && (typeof valor !== 'string' || !formato.test(valor))) {
    throw new Error(`${campo} não é decimal em texto`);
  }
  return valor as string | null;
}

function conferirId(registro: RegistroBruto, partes: string[]) {
  if (registro.id !== partes.join(':')) throw new Error('id não é a junção dos campos');
}

export function normalizarValor(registro: RegistroBruto): LinhaDeValor {
  recusarDadoPessoal(registro, CAMPOS_DE_VALORES);
  const lugar = noVocabulario(registro, 'lugar', LUGARES);
  const rede = noVocabulario(registro, 'rede', REDES);
  const etapa = noVocabulario(registro, 'etapa', ETAPAS);
  const unidade = noVocabulario(registro, 'unidade', UNIDADES);
  const indicador = textoDe(registro, 'indicador');
  const recorte = textoDe(registro, 'recorte');
  const periodo = textoDe(registro, 'periodo');
  const valor = decimalOuNulo(registro, 'valor');
  const texto = registro.texto === null || registro.texto === undefined ? null : textoDe(registro, 'texto');
  if (unidade === 'pessoas' && valor !== null && Number(valor) > 0 && Number(valor) < 5) {
    throw new Error(`contagem abaixo de 5 só sai como "${MENOS_DE_5}"`);
  }
  conferirId(registro, [lugar, rede, etapa, recorte, indicador, periodo]);
  return { idExterno: registro.id, periodo, indicador, lugar, rede, etapa, recorte, valor, texto, unidade };
}

export function normalizarFinanca(registro: RegistroBruto): LinhaDeFinanca {
  recusarDadoPessoal(registro, CAMPOS_DE_FINANCAS);
  const lugar = noVocabulario(registro, 'lugar', LUGARES);
  const rede = noVocabulario(registro, 'rede', REDES);
  const indicador = textoDe(registro, 'indicador');
  const recorte = textoDe(registro, 'recorte');
  const periodo = textoDe(registro, 'periodo');
  conferirId(registro, [lugar, rede, recorte, indicador, periodo]);
  return {
    idExterno: registro.id,
    periodo,
    indicador,
    lugar,
    rede,
    recorte,
    valor: decimalOuNulo(registro, 'valor', DINHEIRO),
    percentual: decimalOuNulo(registro, 'percentual', DINHEIRO),
  };
}

const semErros = (): Validacao => ({ conferencia: [], erros: [] });

function validarRendimento(_coleta: Coleta, linhas: readonly LinhaDeValor[]): Validacao {
  const grupos = new Map<string, Record<string, string | null>>();
  for (const { lugar, rede, etapa, indicador, valor } of linhas) {
    const chave = `${lugar}/${rede}/${etapa}`;
    grupos.set(chave, { ...grupos.get(chave), [indicador]: valor });
  }
  const erros: string[] = [];
  for (const [chave, { aprovacao = null, reprovacao = null, abandono = null }] of grupos) {
    if (!rendimentoFecha(aprovacao, reprovacao, abandono)) {
      const soma = somaDoRendimento([aprovacao, reprovacao, abandono] as string[]);
      erros.push(`${chave}: aprovação + reprovação + abandono = ${soma}`);
    }
  }
  return { conferencia: [], erros };
}

type Declaracao = { id: number; chave: string; validar?: (coleta: Coleta, linhas: readonly never[]) => Validacao };

function consultaDeArquivo<Linha extends Record<string, unknown>>(
  tabela: ConsultaImportada['tabela'],
  normalizar: (registro: RegistroBruto) => Linha,
  { id, chave, validar }: Declaracao,
): ConsultaImportada<Linha> {
  return {
    id,
    chave,
    tabela,
    coletar: async () => {
      throw new Error(
        `${chave} não coleta da fonte: gere o snapshot com pnpm extrair e carregue com pnpm importar --arquivo`,
      );
    },
    normalizar,
    validar: (validar ?? semErros) as ConsultaImportada<Linha>['validar'],
  };
}

const deValores = (d: Declaracao) => consultaDeArquivo(tabelas.educacaoValores, normalizarValor, d);
const deFinancas = (d: Declaracao) => consultaDeArquivo(tabelas.educacaoFinancas, normalizarFinanca, d);

const importadorDeArquivo = (id: string, fonte: string, consultas: Importador['consultas']): Importador => ({
  id,
  fonte,
  anosDaRodada: () => [],
  consultas,
});

export const criarImportadorInep = () =>
  importadorDeArquivo('inep', 'INEP — indicadores e microdados', [
    deValores({ id: 900301, chave: 'inep_rendimento', validar: validarRendimento }),
    deValores({ id: 900302, chave: 'inep_transicao' }),
    deValores({ id: 900303, chave: 'inep_distorcao' }),
    deValores({ id: 900304, chave: 'inep_turmas' }),
    deValores({ id: 900305, chave: 'inep_horas' }),
    deValores({ id: 900306, chave: 'inep_docentes_superior' }),
    deValores({ id: 900307, chave: 'inep_adequacao' }),
    deValores({ id: 900308, chave: 'inep_regularidade' }),
    deValores({ id: 900309, chave: 'inep_esforco' }),
    deFinancas({ id: 900310, chave: 'inep_remuneracao' }),
    deValores({ id: 900311, chave: 'inep_inse' }),
    deValores({ id: 900312, chave: 'inep_alfabetizacao' }),
    deValores({ id: 900313, chave: 'inep_ideb' }),
    deValores({ id: 900314, chave: 'inep_enem' }),
    deValores({ id: 900315, chave: 'inep_superior' }),
  ]);

// Uma consulta tem uma tabela: o que o relatório mistura vira duas consultas (0005_educacao_consultas.sql).
export const criarImportadorSiope = () =>
  importadorDeArquivo('siope', 'SIOPE — FNDE', [
    deValores({ id: 900401, chave: 'siope_indicadores' }),
    deFinancas({ id: 900404, chave: 'siope_indicadores_valores' }),
    deFinancas({ id: 900402, chave: 'siope_anexo8' }),
    deFinancas({ id: 900403, chave: 'siope_remuneracao' }),
    deValores({ id: 900405, chave: 'siope_remuneracao_carga' }),
  ]);

export const criarImportadorMec = () =>
  importadorDeArquivo('mec', 'MEC — Retrato da Educação Infantil', [deValores({ id: 900501, chave: 'mec_retrato' })]);

export const criarImportadoresDeEducacao = (): Importador[] => [
  criarImportadorInep(),
  criarImportadorSiope(),
  criarImportadorMec(),
];
