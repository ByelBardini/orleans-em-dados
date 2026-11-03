// O importador do IBGE: população, Censo 2022 e PIB de Orleans, e os mesmos dados do Brasil e de Santa Catarina
// para a comparação, cada lote com a série inteira. O IBGE publica
// séries, não exercícios: `coletas.ano` é o ano da coleta, e `periodo`, o ano de referência de cada linha.
// Não há outra fonte para conferir; a validação é a coerência interna (partes = total da própria fonte).
import { centavos, deCentavos, dinheiro } from '@orleans-em-dados/contracts';
import { tabelas } from '@orleans-em-dados/db';
import type {
  Coleta,
  ConsultaImportada,
  Importador,
  ItemDeConferencia,
  Validacao,
} from '@orleans-em-dados/importador-nucleo';
import { IbgeClienteHttp, type ClienteIbge } from './cliente';
import {
  CENSO,
  COMPARACAO,
  IBGE,
  LUGARES_DA_COMPARACAO,
  PIB,
  POPULACAO,
  VARIAVEIS_DO_PIB,
  type ConsultaDeAgregado,
} from './config';
import { normalizarValor, registrosDaResposta, type LinhaDoIbge } from './normalizar';

// As cinco parcelas e o total vêm arredondados, cada um em até 0,5 mil reais: a soma pode diferir do total em até 3 mil.
// Na série real da 5938 (2002 a 2021), o maior desvio é de 2 mil reais, em Santa Catarina, em 2019.
const TOLERANCIA_DO_PIB = 300n; // 3 mil reais, com o valor em mil reais tratado como dinheiro: 3.00
const COMPOSICAO_DO_PIB = [
  VARIAVEIS_DO_PIB.agropecuaria,
  VARIAVEIS_DO_PIB.industria,
  VARIAVEIS_DO_PIB.servicos,
  VARIAVEIS_DO_PIB.administracao,
  VARIAVEIS_DO_PIB.impostos,
];
const FAIXA_POR_SEXO = /^(Homens|Mulheres)\|/;

const emCentavos = (linha: LinhaDoIbge) => centavos(dinheiro(linha.valor as string));

const comValor = (linhas: readonly LinhaDoIbge[], tabela: string, variavel: string, categoria = '', periodo = '2022') =>
  linhas.find(
    (l) =>
      l.tabela === tabela &&
      l.variavel === variavel &&
      l.categoria === categoria &&
      l.periodo === periodo &&
      l.valor !== null,
  );

function compararComOTotal(campo: string, descricao: string, total: LinhaDoIbge, partes: readonly LinhaDoIbge[]) {
  const fonte = emCentavos(total);
  const calculado = partes.reduce((soma, parte) => soma + emCentavos(parte), 0n);
  const diferenca = deCentavos(calculado - fonte);
  const item: ItemDeConferencia = {
    campo,
    descricao,
    fonte: deCentavos(fonte),
    calculado: deCentavos(calculado),
    diferenca,
  };
  return { item, erro: calculado === fonte ? null : `${campo}: as partes diferem do total em ${diferenca}` };
}

function validarPopulacao(_coleta: Coleta, linhas: readonly LinhaDoIbge[]): Validacao {
  return { conferencia: [], erros: comValor(linhas, '4709', '93') ? [] : ['falta o Censo 2022 (tabela 4709)'] };
}

function validarCenso(_coleta: Coleta, linhas: readonly LinhaDoIbge[]): Validacao {
  const faltando = [
    ['4714', '93'],
    ['4714', '6318'],
    ['9923', '93'],
    ['9514', '93'],
    ['10295', '13431'],
    ['10295', '13534'],
  ].filter(([tabela, variavel]) => !comValor(linhas, tabela!, variavel!));
  if (faltando.length) {
    return {
      conferencia: [],
      erros: [...new Set(faltando.map(([tabela]) => `falta o Censo 2022 (tabela ${tabela})`))],
    };
  }

  const situacao = compararComOTotal(
    'situacao_domicilio',
    'Urbana + rural = população da tabela 9923',
    comValor(linhas, '9923', '93')!,
    linhas.filter((l) => l.tabela === '9923' && l.categoria !== '' && l.valor !== null),
  );
  const piramide = compararComOTotal(
    'piramide_etaria',
    'Homens + mulheres nas faixas de idade = população da tabela 9514',
    comValor(linhas, '9514', '93')!,
    linhas.filter((l) => l.tabela === '9514' && FAIXA_POR_SEXO.test(l.categoria) && l.valor !== null),
  );
  return {
    conferencia: [situacao.item, piramide.item],
    erros: [situacao.erro, piramide.erro].filter((e) => e !== null),
  };
}

function validarPib(_coleta: Coleta, linhas: readonly LinhaDoIbge[]): Validacao {
  const totais = linhas.filter((l) => l.tabela === '5938' && l.variavel === VARIAVEIS_DO_PIB.pib && l.valor !== null);
  if (!totais.length) return { conferencia: [], erros: ['falta o PIB (tabela 5938)'] };

  const conferencia: ItemDeConferencia[] = [];
  const erros: string[] = [];
  for (const total of totais) {
    const partes = COMPOSICAO_DO_PIB.map((v) => comValor(linhas, '5938', v, '', total.periodo));
    // A composição sai depois do total: 2022 e 2023 ainda vêm com `...`.
    if (partes.some((parte) => !parte)) continue;
    const fonte = emCentavos(total);
    const calculado = partes.reduce((soma, parte) => soma + emCentavos(parte!), 0n);
    const distancia = calculado > fonte ? calculado - fonte : fonte - calculado;
    const campo = `pib_${total.periodo}`;
    const diferenca = deCentavos(calculado - fonte);
    conferencia.push({
      campo,
      descricao: 'Composição do PIB, em mil reais: parcelas arredondadas pelo IBGE',
      fonte: deCentavos(fonte),
      calculado: deCentavos(calculado),
      diferenca,
    });
    if (distancia > TOLERANCIA_DO_PIB) erros.push(`${campo}: a composição difere do PIB em ${diferenca} mil reais`);
  }
  return { conferencia, erros };
}

// Cada lugar passa pelas mesmas validações de Orleans; o erro e o item dizem de qual lugar são.
function validarComparacao(coleta: Coleta, linhas: readonly LinhaDoIbge[]): Validacao {
  const validacoes = LUGARES_DA_COMPARACAO.flatMap(({ localidade, nome, campo }) => {
    const doLugar = linhas.filter((l) => l.localidade === localidade);
    return [validarPopulacao, validarCenso, validarPib].map((validar) => {
      const { conferencia, erros } = validar(coleta, doLugar);
      return {
        conferencia: conferencia.map((item) => ({ ...item, campo: `${campo}_${item.campo}` })),
        erros: erros.map((erro) => `${nome}: ${erro}`),
      };
    });
  });
  return {
    conferencia: validacoes.flatMap((v) => v.conferencia),
    erros: validacoes.flatMap((v) => v.erros),
  };
}

function consultaDoIbge(
  declaracao: {
    id: number;
    chave: string;
    agregados: readonly ConsultaDeAgregado[];
    localidades?: readonly string[];
  },
  validar: (coleta: Coleta, linhas: readonly LinhaDoIbge[]) => Validacao,
  cliente: ClienteIbge,
): ConsultaImportada<LinhaDoIbge> {
  const { id, chave, agregados, localidades = [IBGE.municipio] } = declaracao;
  return {
    id,
    chave,
    tabela: tabelas.ibgeValores,
    async coletar() {
      const registros = [];
      for (const agregado of agregados) {
        registros.push(...registrosDaResposta(agregado.tabela, await cliente.agregado(agregado)));
      }
      return {
        filtro: { localidade: localidades.join(','), agregados },
        totalHits: registros.length,
        registros,
      };
    },
    normalizar: (registro) => normalizarValor(registro, localidades),
    validar,
  };
}

export function criarImportadorIbge({ cliente = new IbgeClienteHttp() }: { cliente?: ClienteIbge } = {}): Importador {
  return {
    id: 'ibge',
    fonte: 'ibge',
    agenda: '0 5 3 * *',
    anosDaRodada: (agora) => [agora.getUTCFullYear()],
    consultas: [
      consultaDoIbge({ id: 900101, chave: 'ibge_populacao', agregados: POPULACAO }, validarPopulacao, cliente),
      consultaDoIbge({ id: 900102, chave: 'ibge_censo', agregados: CENSO }, validarCenso, cliente),
      consultaDoIbge({ id: 900103, chave: 'ibge_pib', agregados: PIB }, validarPib, cliente),
      consultaDoIbge(
        {
          id: 900104,
          chave: 'ibge_comparacao',
          agregados: COMPARACAO,
          localidades: LUGARES_DA_COMPARACAO.map((l) => l.localidade),
        },
        validarComparacao,
        cliente,
      ),
    ],
  };
}
