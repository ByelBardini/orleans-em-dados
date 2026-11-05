// Censo da Educação Superior, IGC, CPC e Enade → oferta em Orleans. Presencial detalhado; a distância só
// em total, porque o INEP avisa que o dado por município é limitado. Conta oferta, não moradores.
import path from 'node:path';
import type { RegistroBruto } from '@orleans-em-dados/importador-nucleo';
import { contagemPublicavel, decimalDaFonte } from '../validacoes';
import { ORLEANS, SANTA_CATARINA } from '../vocabulario';
import { acharArquivo, linhasDaPlanilha, linhasDoCsv, type Celula } from './arquivos';
import { pessoas, registroDeValor, type Lote } from './snapshot';

const ANO_DO_CENSO = '2024';
const REDE = 'todas' as const;
const PRESENCIAL = '1';
const A_DISTANCIA = '2';
const MINIMO_PARA_CORTE = 10;

// O campo TP_CATEGORIA_ADMINISTRATIVA, como no dicionário do Censo.
const CATEGORIA_ADMINISTRATIVA: Record<string, string> = {
  '1': 'Pública Federal',
  '2': 'Pública Estadual',
  '3': 'Pública Municipal',
  '4': 'Privada com fins lucrativos',
  '5': 'Privada sem fins lucrativos',
  '6': 'Privada - Particular em sentido estrito',
  '7': 'Especial',
  '8': 'Privada comunitária',
  '9': 'Privada confessional',
};
const GRAU: Record<string, string> = {
  '1': 'bacharelado',
  '2': 'licenciatura',
  '3': 'tecnologico',
  '4': 'bacharelado e licenciatura',
};

const COLUNAS_DE_CURSO = [
  'CO_MUNICIPIO',
  'TP_DIMENSAO',
  'TP_GRAU_ACADEMICO',
  'NO_CURSO',
  'CO_IES',
  'QT_CURSO',
  'QT_VG_TOTAL',
  'QT_INSCRITO_TOTAL',
  'QT_ING',
  'QT_MAT',
  'QT_CONC',
  'QT_MAT_FEM',
  'QT_MAT_NOTURNO',
  'QT_MAT_18_24',
  'QT_MAT_PROCESCPUBLICA',
  'QT_MAT_PROUNII',
  'QT_MAT_PROUNIP',
  'QT_MAT_FIES',
];

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em']);
const nomeDoCurso = (texto: string) =>
  texto
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');

const numero = (texto: string) => (texto ? Number(texto) : 0);

type Curso = {
  curso: string;
  grau: string;
  vagas: number;
  ingressantes: number;
  matriculas: number;
  concluintes: number;
  mulheres: number;
  noturno: number;
};

export type Oferta = {
  cursos: Curso[];
  quantidade: number;
  inscritos: number;
  perfil: { de_18_a_24: number; escola_publica: number; prouni: number; fies: number };
  distancia: { instituicoes: Set<string>; matriculas: number; ingressantes: number };
  instituicoes: Set<string>;
};

export async function lerOferta(caminho: string): Promise<Oferta> {
  const porCurso = new Map<string, Curso>();
  const oferta: Oferta = {
    cursos: [],
    quantidade: 0,
    inscritos: 0,
    perfil: { de_18_a_24: 0, escola_publica: 0, prouni: 0, fies: 0 },
    distancia: { instituicoes: new Set(), matriculas: 0, ingressantes: 0 },
    instituicoes: new Set(),
  };
  for await (const campo of linhasDoCsv(caminho, COLUNAS_DE_CURSO, { codificacao: 'latin1' })) {
    if (campo('CO_MUNICIPIO') !== ORLEANS) continue;
    const dimensao = campo('TP_DIMENSAO');
    if (dimensao === A_DISTANCIA) {
      oferta.distancia.instituicoes.add(campo('CO_IES'));
      oferta.distancia.matriculas += numero(campo('QT_MAT'));
      oferta.distancia.ingressantes += numero(campo('QT_ING'));
      continue;
    }
    if (dimensao !== PRESENCIAL) continue;
    oferta.instituicoes.add(campo('CO_IES'));
    const grau = GRAU[campo('TP_GRAU_ACADEMICO')] ?? 'outro';
    const nome = nomeDoCurso(campo('NO_CURSO').trim());
    const chave = `${nome}|${grau}`;
    const curso = porCurso.get(chave) ?? {
      curso: nome,
      grau,
      vagas: 0,
      ingressantes: 0,
      matriculas: 0,
      concluintes: 0,
      mulheres: 0,
      noturno: 0,
    };
    curso.vagas += numero(campo('QT_VG_TOTAL'));
    curso.ingressantes += numero(campo('QT_ING'));
    curso.matriculas += numero(campo('QT_MAT'));
    curso.concluintes += numero(campo('QT_CONC'));
    curso.mulheres += numero(campo('QT_MAT_FEM'));
    curso.noturno += numero(campo('QT_MAT_NOTURNO'));
    porCurso.set(chave, curso);
    oferta.quantidade += numero(campo('QT_CURSO'));
    oferta.inscritos += numero(campo('QT_INSCRITO_TOTAL'));
    oferta.perfil.de_18_a_24 += numero(campo('QT_MAT_18_24'));
    oferta.perfil.escola_publica += numero(campo('QT_MAT_PROCESCPUBLICA'));
    oferta.perfil.prouni += numero(campo('QT_MAT_PROUNII')) + numero(campo('QT_MAT_PROUNIP'));
    oferta.perfil.fies += numero(campo('QT_MAT_FIES'));
  }
  oferta.cursos = [...porCurso.values()].sort((a, b) => b.matriculas - a.matriculas);
  return oferta;
}

export type Instituicao = {
  sigla: string;
  nome: string;
  categoria: string;
  tecnicos: number;
  docentes: number;
  doutores: number;
  mestres: number;
  especialistas: number;
  tempoIntegral: number;
};

export async function lerInstituicao(caminho: string, codigo: string): Promise<Instituicao> {
  const colunas = [
    'CO_IES',
    'NO_IES',
    'SG_IES',
    'TP_CATEGORIA_ADMINISTRATIVA',
    'QT_TEC_TOTAL',
    'QT_DOC_EXE',
    'QT_DOC_EX_DOUT',
    'QT_DOC_EX_MEST',
    'QT_DOC_EX_ESP',
    'QT_DOC_EX_INT',
  ];
  for await (const campo of linhasDoCsv(caminho, colunas, { codificacao: 'latin1' })) {
    if (campo('CO_IES') !== codigo) continue;
    const categoria = CATEGORIA_ADMINISTRATIVA[campo('TP_CATEGORIA_ADMINISTRATIVA')];
    if (!categoria) throw new Error(`${path.basename(caminho)}: categoria administrativa inesperada`);
    return {
      sigla: campo('SG_IES').trim(),
      nome: campo('NO_IES').trim(),
      categoria,
      tecnicos: numero(campo('QT_TEC_TOTAL')),
      docentes: numero(campo('QT_DOC_EXE')),
      doutores: numero(campo('QT_DOC_EX_DOUT')),
      mestres: numero(campo('QT_DOC_EX_MEST')),
      especialistas: numero(campo('QT_DOC_EX_ESP')),
      tempoIntegral: numero(campo('QT_DOC_EX_INT')),
    };
  }
  throw new Error(`${path.basename(caminho)}: sem a instituição ${codigo}`);
}

const rotuloDaColuna = (c: Celula) =>
  String(c ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[*¹²]+/g, '')
    .trim();

/** Linhas da aba que tem as colunas pedidas, com as células pelo nome da coluna. */
async function* linhasPorRotulo(caminho: string, rotulos: readonly string[]) {
  let cabecalho: string[] | null = null;
  let abaDoCabecalho = '';
  for await (const { aba, celulas } of linhasDaPlanilha(caminho)) {
    if (!cabecalho) {
      const nomes = celulas.map(rotuloDaColuna);
      if (rotulos.every((r) => nomes.includes(r))) {
        cabecalho = nomes;
        abaDoCabecalho = aba;
      }
      continue;
    }
    if (aba !== abaDoCabecalho) continue;
    const mapa = cabecalho;
    yield (rotulo: string) => celulas[mapa.indexOf(rotulo)] ?? null;
  }
  if (!cabecalho)
    throw new Error(`${path.basename(caminho)}: layout inesperado, faltam as colunas ${rotulos.join(', ')}`);
}

export type Igc = {
  continuo: Celula;
  faixa: string;
  distribuicaoSc: Record<string, number>;
  /** Instituições de SC com faixa numérica. */
  totalSc: number;
  semFaixaSc: number;
};

export async function lerIgc(caminho: string, codigo: string): Promise<Igc> {
  const igc: Igc = { continuo: null, faixa: '', distribuicaoSc: {}, totalSc: 0, semFaixaSc: 0 };
  let achou = false;
  for await (const campo of linhasPorRotulo(caminho, [
    'Código da IES',
    'Sigla da UF',
    'IGC (Contínuo)',
    'IGC (Faixa)',
  ])) {
    const faixa = String(campo('IGC (Faixa)') ?? '').trim();
    if (String(campo('Código da IES')) === codigo) {
      achou = true;
      igc.continuo = campo('IGC (Contínuo)');
      igc.faixa = faixa;
    }
    if (campo('Sigla da UF') !== 'SC') continue;
    if (/^[1-5]$/.test(faixa)) {
      igc.distribuicaoSc[faixa] = (igc.distribuicaoSc[faixa] ?? 0) + 1;
      igc.totalSc++;
    } else igc.semFaixaSc++;
  }
  if (!achou) throw new Error(`${path.basename(caminho)}: sem a instituição ${codigo}`);
  return igc;
}

type NotaDaArea = { area: string; participantes: number; continuo?: Celula; faixa: string };

const limpar = (c: Celula) => String(c ?? '').trim();

async function lerPorMunicipio(
  caminho: string,
  colunaDoMunicipio: string,
  rotulos: { area: string; participantes: string; faixa: string; continuo?: string; proficiencia?: string },
) {
  const notas: (NotaDaArea & { proficiencia?: Celula })[] = [];
  const pedidas = [colunaDoMunicipio, rotulos.area, rotulos.participantes, rotulos.faixa];
  for await (const campo of linhasPorRotulo(caminho, pedidas)) {
    if (String(campo(colunaDoMunicipio)) !== ORLEANS) continue;
    notas.push({
      area: limpar(campo(rotulos.area)),
      participantes: Number(campo(rotulos.participantes)),
      continuo: rotulos.continuo ? campo(rotulos.continuo) : undefined,
      faixa: limpar(campo(rotulos.faixa)),
      proficiencia: rotulos.proficiencia ? campo(rotulos.proficiencia) : undefined,
    });
  }
  return notas;
}

export type DadosDoSuperior = {
  oferta: Oferta;
  instituicao: Instituicao;
  igc: Igc;
  cpc: NotaDaArea[];
  enade: NotaDaArea[];
  licenciaturas: (NotaDaArea & { proficiencia?: Celula })[];
  arquivos: string[];
};

const faixaEmTexto = (
  base: { lugar: string; rede: typeof REDE; indicador: string; recorte: string; periodo: string },
  faixa: string,
) =>
  /^[1-5]$/.test(faixa)
    ? registroDeValor({ ...base, valor: faixa, unidade: 'indice' })
    : registroDeValor({ ...base, valor: null, texto: faixa || null, unidade: 'indice' });

export function loteDoSuperior({
  oferta,
  instituicao,
  igc,
  cpc,
  enade,
  licenciaturas,
  arquivos,
}: DadosDoSuperior): Lote {
  const noCenso = { lugar: ORLEANS, rede: REDE, periodo: ANO_DO_CENSO };
  const contagem = (indicador: string, n: number, recorte = '') =>
    pessoas({ ...noCenso, indicador, recorte }, contagemPublicavel(n));
  const registros: RegistroBruto[] = [
    registroDeValor({ ...noCenso, indicador: 'superior_instituicao', texto: instituicao.sigla, unidade: 'texto' }),
    registroDeValor({ ...noCenso, indicador: 'superior_natureza', texto: instituicao.categoria, unidade: 'texto' }),
    registroDeValor({ ...noCenso, indicador: 'superior_cursos', valor: String(oferta.quantidade), unidade: 'cursos' }),
    registroDeValor({
      ...noCenso,
      indicador: 'superior_vagas',
      valor: String(oferta.cursos.reduce((s, c) => s + c.vagas, 0)),
      unidade: 'vagas',
    }),
    contagem('superior_inscritos', oferta.inscritos),
    contagem(
      'superior_ingressantes',
      oferta.cursos.reduce((s, c) => s + c.ingressantes, 0),
    ),
    contagem(
      'superior_matriculas',
      oferta.cursos.reduce((s, c) => s + c.matriculas, 0),
    ),
    contagem(
      'superior_concluintes',
      oferta.cursos.reduce((s, c) => s + c.concluintes, 0),
    ),
    contagem(
      'superior_perfil',
      oferta.cursos.reduce((s, c) => s + c.mulheres, 0),
      'mulheres',
    ),
    contagem(
      'superior_perfil',
      oferta.cursos.reduce((s, c) => s + c.noturno, 0),
      'noturno',
    ),
    ...Object.entries(oferta.perfil).map(([recorte, n]) => contagem('superior_perfil', n, recorte)),
    registroDeValor({
      ...noCenso,
      indicador: 'superior_ead_instituicoes',
      valor: String(oferta.distancia.instituicoes.size),
      unidade: 'instituicoes',
    }),
    contagem('superior_ead_matriculas', oferta.distancia.matriculas),
    contagem('superior_ead_ingressantes', oferta.distancia.ingressantes),
    contagem('superior_docentes', instituicao.docentes),
    contagem('superior_docentes', instituicao.doutores, 'doutores'),
    contagem('superior_docentes', instituicao.mestres, 'mestres'),
    contagem('superior_docentes', instituicao.especialistas, 'especialistas'),
    contagem('superior_docentes', instituicao.tempoIntegral, 'tempo_integral'),
    contagem('superior_tecnicos', instituicao.tecnicos),
  ];

  for (const curso of oferta.cursos) {
    const recorte = `${curso.curso} (${curso.grau})`;
    registros.push(
      registroDeValor({
        ...noCenso,
        indicador: 'superior_curso_vagas',
        recorte,
        valor: String(curso.vagas),
        unidade: 'vagas',
      }),
      contagem('superior_curso_ingressantes', curso.ingressantes, recorte),
      contagem('superior_curso_matriculas', curso.matriculas, recorte),
      contagem('superior_curso_concluintes', curso.concluintes, recorte),
    );
    if (curso.matriculas >= MINIMO_PARA_CORTE) {
      registros.push(
        contagem('superior_curso_mulheres', curso.mulheres, recorte),
        contagem('superior_curso_noturno', curso.noturno, recorte),
      );
    }
  }

  const naAvaliacao = (periodo: string) => ({ lugar: ORLEANS, rede: REDE, periodo });
  registros.push(
    registroDeValor({
      ...naAvaliacao('2023'),
      indicador: 'superior_igc_continuo',
      valor: decimalDaFonte(igc.continuo, 2),
      unidade: 'indice',
    }),
    faixaEmTexto({ ...naAvaliacao('2023'), indicador: 'superior_igc_faixa', recorte: '' }, igc.faixa),
    ...Object.entries(igc.distribuicaoSc).map(([faixa, n]) =>
      registroDeValor({
        lugar: SANTA_CATARINA,
        rede: REDE,
        periodo: '2023',
        indicador: 'superior_igc_distribuicao',
        recorte: `faixa_${faixa}`,
        valor: String(n),
        unidade: 'instituicoes',
      }),
    ),
  );
  for (const { area, participantes, continuo, faixa } of cpc) {
    const base = { ...naAvaliacao('2023'), recorte: area };
    registros.push(
      pessoas({ ...base, indicador: 'superior_cpc_participantes' }, contagemPublicavel(participantes)),
      registroDeValor({
        ...base,
        indicador: 'superior_cpc_continuo',
        valor: decimalDaFonte(continuo, 2),
        unidade: 'indice',
      }),
      faixaEmTexto({ ...base, indicador: 'superior_cpc_faixa' }, faixa),
    );
  }
  for (const { area, faixa } of enade) {
    registros.push(faixaEmTexto({ ...naAvaliacao('2023'), recorte: area, indicador: 'superior_enade_faixa' }, faixa));
  }
  for (const { area, participantes, proficiencia, faixa } of licenciaturas) {
    const base = { ...naAvaliacao('2025'), recorte: area };
    const fracao = proficiencia === null || proficiencia === undefined ? null : Number(proficiencia);
    registros.push(
      pessoas({ ...base, indicador: 'superior_licenciatura_participantes' }, contagemPublicavel(participantes)),
      registroDeValor({
        ...base,
        indicador: 'superior_licenciatura_proficiencia',
        valor: fracao === null ? null : (fracao * 100).toFixed(1),
        unidade: '%',
      }),
      faixaEmTexto({ ...base, indicador: 'superior_licenciatura_faixa' }, faixa),
    );
  }
  return {
    chave: 'inep_superior',
    ano: Number(ANO_DO_CENSO),
    registros,
    filtro: {
      arquivos,
      recorte: 'cursos oferecidos em Orleans; a distância só em total',
      minimoParaCorte: MINIMO_PARA_CORTE,
      extrato: false,
    },
  };
}

function exigir(pasta: string, nome: RegExp): string {
  const achado = acharArquivo(pasta, nome);
  if (!achado) throw new Error(`Arquivo não encontrado em ${pasta}: ${nome.source}`);
  return achado;
}

export async function extrairSuperior({ origem }: { origem: string }): Promise<Lote[]> {
  const cursos = exigir(origem, /^MICRODADOS_CADASTRO_CURSOS_2024\.CSV$/i);
  const ies = exigir(origem, /^MICRODADOS_ED_SUP_IES_2024\.CSV$/i);
  const igc = exigir(origem, /^IGC_2023\.xlsx$/i);
  const cpc = exigir(origem, /^CPC_2023\.xlsx$/i);
  const enade = exigir(origem, /^conceito_enade_2023\.xlsx$/i);
  const licenciaturas = exigir(origem, /^conceito_enade_licenciaturas\.xlsx$/i);

  const oferta = await lerOferta(cursos);
  if (oferta.instituicoes.size !== 1) {
    throw new Error(`Esperada uma instituição presencial em Orleans; há ${oferta.instituicoes.size}`);
  }
  const codigo = [...oferta.instituicoes][0] as string;
  return [
    loteDoSuperior({
      oferta,
      instituicao: await lerInstituicao(ies, codigo),
      igc: await lerIgc(igc, codigo),
      cpc: await lerPorMunicipio(cpc, 'Código do Município', {
        area: 'Área de Avaliação',
        participantes: 'Nº de Concluintes Participantes',
        continuo: 'CPC (Contínuo)',
        faixa: 'CPC (Faixa)',
      }),
      enade: await lerPorMunicipio(enade, 'Código do Município', {
        area: 'Área de Avaliação',
        participantes: 'Nº de Concluintes Participantes',
        faixa: 'Conceito Enade (Faixa)',
      }),
      licenciaturas: await lerPorMunicipio(licenciaturas, 'Código do Município', {
        area: 'Área de Avaliação',
        participantes: 'Nº de Concluintes Participantes',
        proficiencia: 'Percentual de Concluintes Igual ou Acima do Padrão 1 de Proficiência',
        faixa: 'Conceito Enade (Faixa)',
      }),
      arquivos: [cursos, ies, igc, cpc, enade, licenciaturas].map((a) => path.basename(a)),
    }),
  ];
}
