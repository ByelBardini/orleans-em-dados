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
import { IbgeClienteHttp, type ClienteDePesquisas, type ClienteIbge } from './cliente';
import {
  CENSO,
  COMPARACAO,
  EDUCACAO_CENSO,
  EDUCACAO_COMPARACAO,
  IBGE,
  LUGARES_DA_COMPARACAO,
  LUGARES_DAS_PESQUISAS,
  PESQUISAS_DE_EDUCACAO,
  PIB,
  POPULACAO,
  VARIAVEIS_DO_PIB,
  type ConsultaDeAgregado,
} from './config';
import {
  normalizarPesquisa,
  normalizarValor,
  registrosDaPesquisa,
  registrosDaResposta,
  semRepetidos,
  type LinhaDoIbge,
} from './normalizar';

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

type Validador = (coleta: Coleta, linhas: readonly LinhaDoIbge[]) => Validacao;

// Cada lugar passa pelas mesmas validações de Orleans; o erro e o item dizem de qual lugar são.
const validarPorLugar =
  (lugares: readonly { localidade: string; nome: string; campo: string }[], validadores: readonly Validador[]) =>
  (coleta: Coleta, linhas: readonly LinhaDoIbge[]): Validacao => {
    const validacoes = lugares.flatMap(({ localidade, nome, campo }) => {
      const doLugar = linhas.filter((l) => l.localidade === localidade);
      return validadores.map((validar) => {
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
  };

const validarComparacao = validarPorLugar(LUGARES_DA_COMPARACAO, [validarPopulacao, validarCenso, validarPib]);

// Censo de educação. Alfabetização é universo: fecha exato. O resto é amostra: cada parte e o total vêm arredondados
// em até meia pessoa, e a soma pode diferir em até (partes + 1) / 2. Na 10324, o total ainda passa da soma das partes
// além do arredondamento: 0,28% na graduação de SC, 0,37% na pós do Brasil, 0,05% no total de SC. O IBGE não abre
// esse pedaço em nenhuma categoria de local; a folga vale só nesse sentido e só nessa tabela.
const FOLGA_DO_LOCAL_EM_MILESIMOS = 5n;
const GRADUACAO = 'Superior de graduação';
const POS_GRADUACAO = 'Especialização de nível superior, mestrado ou doutorado';
const LOCAIS = ['Município de residência', 'Outro município', 'País estrangeiro'];
const OUTRO_MUNICIPIO = 'Outro município';
const IDADE = /^\d+ a \d+ anos$/;
const VINTE_E_CINCO_MAIS = '25 anos ou mais';

const TABELAS_DA_EDUCACAO: readonly [tabela: string, variavel: string, categoria: string, periodo: string][] = [
  ['10091', '2513', '', '2022'],
  ['10092', '950', '', '2022'],
  ['10056', '3795', '', '2022'],
  ['10057', '13282', '', '2022'],
  ['10058', '13283', '', '2022'],
  ['10059', '13284', '', '2022'],
  ['10061', '2667', VINTE_E_CINCO_MAIS, '2022'],
  ['10062', '13285', '', '2022'],
  ['10324', '2021', '', '2022'],
  ['1549', '93', '', '2010'],
];

type ContaDaAmostra = {
  campo: string;
  descricao: string;
  tabela: string;
  variavel: string;
  categoria: string;
  periodo: string;
  ehParte: (categoria: string) => boolean;
  /** O total pode passar da soma além do arredondamento, até 0,5%. */
  folgaDoLocal?: boolean;
};

const semQuebra = (categoria: string) => categoria !== '' && !categoria.includes('|');

const CONTAS_DA_AMOSTRA: readonly ContaDaAmostra[] = [
  {
    campo: 'local_total',
    descricao: 'Município de residência + outro município + país estrangeiro = quem estuda, na tabela 10324',
    tabela: '10324',
    variavel: '2021',
    categoria: '',
    periodo: '2022',
    ehParte: (c) => LOCAIS.includes(c),
    folgaDoLocal: true,
  },
  ...[
    ['local_graduacao', GRADUACAO, 'na graduação'],
    ['local_pos_graduacao', POS_GRADUACAO, 'na pós-graduação'],
  ].map(([campo, curso, onde]): ContaDaAmostra => ({
    campo: campo!,
    descricao: `Os três locais = quem estuda ${onde}, na tabela 10324`,
    tabela: '10324',
    variavel: '2021',
    categoria: curso!,
    periodo: '2022',
    ehParte: (c) => LOCAIS.some((local) => c === `${local}|${curso}`),
    folgaDoLocal: true,
  })),
  {
    campo: 'local_outro_municipio_por_curso',
    descricao: 'Cursos = quem estuda em outro município, na tabela 10324',
    tabela: '10324',
    variavel: '2021',
    categoria: OUTRO_MUNICIPIO,
    periodo: '2022',
    ehParte: (c) => c.startsWith(`${OUTRO_MUNICIPIO}|`),
  },
  ...[
    ['nivel_ate_5_anos', '10057', '13282'],
    ['nivel_6_a_17_anos', '10058', '13283'],
    ['nivel_18_anos_ou_mais', '10059', '13284'],
  ].map(([campo, tabela, variavel]): ContaDaAmostra => ({
    campo: campo!,
    descricao: `Níveis de ensino = quem estuda, na tabela ${tabela}`,
    tabela: tabela!,
    variavel: variavel!,
    categoria: '',
    periodo: '2022',
    ehParte: (c) => semQuebra(c) && !IDADE.test(c),
  })),
  {
    campo: 'instrucao_25_anos_ou_mais',
    descricao: 'Níveis de instrução = pessoas de 25 anos ou mais, na tabela 10061',
    tabela: '10061',
    variavel: '2667',
    categoria: VINTE_E_CINCO_MAIS,
    periodo: '2022',
    ehParte: (c) => c.endsWith(`|${VINTE_E_CINCO_MAIS}`),
  },
  ...[
    ['populacao_2010', '93', 'População'],
    ['frequencia_2010', '364', 'Quem frequentava escola'],
  ].map(([campo, variavel, quem]): ContaDaAmostra => ({
    campo: campo!,
    descricao: `${quem}: faixas de idade = total, na tabela 1549`,
    tabela: '1549',
    variavel: variavel!,
    categoria: '',
    periodo: '2010',
    ehParte: (c) => c !== '',
  })),
];

function compararComAAmostra(conta: ContaDaAmostra, linhas: readonly LinhaDoIbge[]) {
  const total = comValor(linhas, conta.tabela, conta.variavel, conta.categoria, conta.periodo);
  const partes = linhas.filter(
    (l) =>
      l.tabela === conta.tabela &&
      l.variavel === conta.variavel &&
      l.periodo === conta.periodo &&
      conta.ehParte(l.categoria),
  );
  // Parte em `X` ou `...`: a conta não fecha com o que se vê, e a falta não é zero.
  if (!total || !partes.length || partes.some((p) => p.valor === null)) return null;

  const fonte = emCentavos(total);
  const calculado = partes.reduce((soma, parte) => soma + emCentavos(parte), 0n);
  const arredondamento = (BigInt(partes.length + 2) / 2n) * 100n;
  const folga = conta.folgaDoLocal ? (fonte * FOLGA_DO_LOCAL_EM_MILESIMOS) / 1000n : 0n;
  const diferenca = deCentavos(calculado - fonte);
  const dentro = calculado >= fonte ? calculado - fonte <= arredondamento : fonte - calculado <= arredondamento + folga;
  const item: ItemDeConferencia = {
    campo: conta.campo,
    descricao: conta.descricao,
    fonte: deCentavos(fonte),
    calculado: deCentavos(calculado),
    diferenca,
  };
  return {
    item,
    erro: dentro ? null : `${conta.campo}: as partes diferem do total em ${diferenca}, além da tolerância`,
  };
}

function validarEducacaoCenso(_coleta: Coleta, linhas: readonly LinhaDoIbge[]): Validacao {
  const faltando = TABELAS_DA_EDUCACAO.filter(
    ([tabela, variavel, categoria, periodo]) => !comValor(linhas, tabela, variavel, categoria, periodo),
  );
  if (faltando.length) {
    return { conferencia: [], erros: faltando.map(([tabela]) => `falta o Censo de educação (tabela ${tabela})`) };
  }

  const dasPessoas = (categoria: string) =>
    linhas.filter((l) => l.tabela === '10092' && l.variavel === '950' && l.categoria === categoria && l.valor !== null);
  const alfabetizacao = compararComOTotal(
    'alfabetizacao_pessoas',
    'Alfabetizadas + não alfabetizadas = pessoas de 15 anos ou mais, na tabela 10092',
    comValor(linhas, '10092', '950')!,
    [...dasPessoas('Alfabetizadas'), ...dasPessoas('Não alfabetizadas')],
  );
  const contas = CONTAS_DA_AMOSTRA.map((conta) => compararComAAmostra(conta, linhas)).filter((c) => c !== null);
  return {
    conferencia: [alfabetizacao.item, ...contas.map((c) => c.item)],
    erros: [alfabetizacao.erro, ...contas.map((c) => c.erro)].filter((e) => e !== null),
  };
}

const validarEducacaoComparacao = validarPorLugar(LUGARES_DA_COMPARACAO, [validarEducacaoCenso]);

// Rede escolar. A matrícula por rede só existe por etapa e série: a soma das folhas (série × rede, ou etapa × rede na
// educação infantil) tem de ser o total da etapa, sem tolerância, porque é contagem do Censo Escolar. A linha da série
// não entra: no fundamental de 2021 ela vem vazia, com série × rede preenchida. Docentes não somam: contam em mais de
// uma etapa.
const ETAPAS_DE_MATRICULA = [
  ['creche', 'Matrículas > Ensino infantil > Creche'],
  ['pre_escola', 'Matrículas > Ensino infantil > Pré-escolar'],
  ['fundamental', 'Matrículas > Ensino fundamental'],
  ['medio', 'Matrículas > Ensino médio'],
] as const;
const FOLHA_DE_REDE = / > (Municipal|Estadual|Federal|Privado)$/;

function validarRedeDoLugar(_coleta: Coleta, linhas: readonly LinhaDoIbge[]): Validacao {
  const erros: string[] = [];
  if (!linhas.some((l) => l.tabela === 'pesquisa-40' && l.valor !== null)) erros.push('falta o IDEB (pesquisa 40)');
  const conferencia: ItemDeConferencia[] = [];
  const matriculas = linhas.filter((l) => l.tabela === 'pesquisa-13' && l.valor !== null);
  if (!matriculas.some((l) => l.categoria === ETAPAS_DE_MATRICULA[2][1])) {
    erros.push('falta a matrícula do fundamental (pesquisa 13)');
  }
  for (const [chave, etapa] of ETAPAS_DE_MATRICULA) {
    const folhas = matriculas.filter((l) => l.categoria.startsWith(`${etapa} > `) && FOLHA_DE_REDE.test(l.categoria));
    for (const total of matriculas.filter((l) => l.categoria === etapa)) {
      const { item, erro } = compararComOTotal(
        `matriculas_${chave}_${total.periodo}`,
        `Séries por rede = total da etapa: ${etapa}`,
        total,
        folhas.filter((l) => l.periodo === total.periodo),
      );
      conferencia.push(item);
      if (erro) erros.push(erro);
    }
  }
  return { conferencia, erros };
}

const validarRedeEscolar = validarPorLugar(LUGARES_DAS_PESQUISAS, [validarRedeDoLugar]);

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
      const coletados = [];
      for (const agregado of agregados) {
        coletados.push(...registrosDaResposta(agregado.tabela, await cliente.agregado(agregado)));
      }
      const registros = semRepetidos(coletados);
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

function consultaDaRedeEscolar(pesquisas: ClienteDePesquisas): ConsultaImportada<LinhaDoIbge> {
  const locais = LUGARES_DAS_PESQUISAS.map((l) => l.localidade);
  return {
    id: 900107,
    chave: 'ibge_rede_escolar',
    tabela: tabelas.ibgeValores,
    async coletar() {
      const registros = [];
      for (const pesquisa of PESQUISAS_DE_EDUCACAO) {
        const arvore = await pesquisas.arvore(pesquisa);
        for (const local of locais) {
          registros.push(...registrosDaPesquisa(pesquisa, arvore, await pesquisas.resultados(pesquisa, local)));
        }
      }
      return {
        filtro: { localidade: locais.join(','), pesquisas: PESQUISAS_DE_EDUCACAO },
        totalHits: registros.length,
        registros,
      };
    },
    normalizar: (registro) => normalizarPesquisa(registro, locais),
    validar: validarRedeEscolar,
  };
}

export function criarImportadorIbge({
  cliente = new IbgeClienteHttp(),
  pesquisas = new IbgeClienteHttp(),
}: { cliente?: ClienteIbge; pesquisas?: ClienteDePesquisas } = {}): Importador {
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
      consultaDoIbge(
        { id: 900105, chave: 'ibge_educacao_censo', agregados: EDUCACAO_CENSO },
        validarEducacaoCenso,
        cliente,
      ),
      consultaDoIbge(
        {
          id: 900106,
          chave: 'ibge_educacao_comparacao',
          agregados: EDUCACAO_COMPARACAO,
          localidades: LUGARES_DA_COMPARACAO.map((l) => l.localidade),
        },
        validarEducacaoComparacao,
        cliente,
      ),
      consultaDaRedeEscolar(pesquisas),
    ],
  };
}
