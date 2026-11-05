// Microdados do ENEM → agregados. Lê em fluxo, guarda só somas e o conjunto de códigos de escola por
// rede em Orleans, que serve para contar escolas e nunca sai daqui. Rede de Orleans com menos de 2
// escolas não publica nada de nota nem de "quem fez a prova": seria o resultado de uma escola.
import path from 'node:path';
import type { RegistroBruto } from '@orleans-em-dados/importador-nucleo';
import { contagemPublicavel } from '../validacoes';
import { BRASIL, ORLEANS, SANTA_CATARINA, type Rede } from '../vocabulario';
import { acharArquivo, linhasDoCsv } from './arquivos';
import { pessoas, registroDeValor, type Lote } from './snapshot';

export const MINIMO_DE_ESCOLAS = 2;
const REDE_DA_ESCOLA: Record<string, Rede> = { '1': 'federal', '2': 'estadual', '3': 'municipal', '4': 'privada' };
const PUBLICAS = new Set<Rede>(['federal', 'estadual', 'municipal']);
const ETAPA = 'medio';

const AREAS = {
  natureza: 'NU_NOTA_CN',
  humanas: 'NU_NOTA_CH',
  linguagens: 'NU_NOTA_LC',
  matematica: 'NU_NOTA_MT',
  redacao: 'NU_NOTA_REDACAO',
} as const;
type Area = keyof typeof AREAS;
const NOMES_DAS_AREAS = Object.keys(AREAS) as Area[];

const COLUNAS = [
  'CO_ESCOLA',
  'CO_MUNICIPIO_ESC',
  'CO_UF_ESC',
  'TP_DEPENDENCIA_ADM_ESC',
  'CO_MUNICIPIO_PROVA',
  'TP_PRESENCA_CN',
  'TP_PRESENCA_CH',
  'TP_PRESENCA_LC',
  'TP_PRESENCA_MT',
  ...Object.values(AREAS),
];

type Soma = {
  inscritos: number;
  presentes: number;
  notas: Record<Area, { soma: number; n: number }>;
  cinco: { soma: number; n: number };
};

const novaSoma = (): Soma => ({
  inscritos: 0,
  presentes: 0,
  notas: Object.fromEntries(NOMES_DAS_AREAS.map((a) => [a, { soma: 0, n: 0 }])) as Soma['notas'],
  cinco: { soma: 0, n: 0 },
});

// Notas têm até duas casas: somar em centésimos inteiros evita o erro do float em 5 milhões de linhas.
const emCentesimos = (texto: string) => Math.round(Number(texto) * 100);

function somar(soma: Soma, presente: boolean, notas: Partial<Record<Area, number>>) {
  soma.inscritos++;
  if (presente) soma.presentes++;
  let cinco = 0;
  let tem = 0;
  for (const area of NOMES_DAS_AREAS) {
    const nota = notas[area];
    if (nota === undefined) continue;
    soma.notas[area].soma += nota;
    soma.notas[area].n++;
    cinco += nota;
    tem++;
  }
  if (tem === NOMES_DAS_AREAS.length) {
    soma.cinco.soma += cinco;
    soma.cinco.n++;
  }
}

const media = ({ soma, n }: { soma: number; n: number }, divisor = 1) =>
  n ? (soma / n / divisor / 100).toFixed(2) : null;

function registrosDaSoma(lugar: string, rede: Rede, periodo: string, soma: Soma, recorte = ''): RegistroBruto[] {
  const base = { lugar, rede, etapa: ETAPA, recorte, periodo };
  return [
    pessoas({ ...base, indicador: 'enem_inscritos' }, contagemPublicavel(soma.inscritos)),
    pessoas({ ...base, indicador: 'enem_presentes' }, contagemPublicavel(soma.presentes)),
    registroDeValor({ ...base, indicador: 'enem_media_5_areas', valor: media(soma.cinco, 5), unidade: 'nota' }),
    ...NOMES_DAS_AREAS.map((area) =>
      registroDeValor({ ...base, indicador: `enem_${area}`, valor: media(soma.notas[area]), unidade: 'nota' }),
    ),
  ];
}

export type SomasDoEnem = {
  ano: number;
  orleans: Map<Rede, Soma>;
  santaCatarina: Map<Rede, Soma>;
  brasil: Map<Rede, Soma>;
  escolasDeOrleans: Map<Rede, Set<string>>;
  provaEmOrleans: Soma;
  origemDaProva: { escolaEmOrleans: number; escolaEmOutroMunicipio: number; semEscola: number };
};

const REDES_AGREGADAS = (rede: Rede): Rede[] => (PUBLICAS.has(rede) ? [rede, 'publica', 'todas'] : [rede, 'todas']);

const daRede = (mapa: Map<Rede, Soma>, rede: Rede) => {
  const soma = mapa.get(rede) ?? novaSoma();
  mapa.set(rede, soma);
  return soma;
};

export async function somarResultados(caminho: string, ano: number): Promise<SomasDoEnem> {
  const somas: SomasDoEnem = {
    ano,
    orleans: new Map(),
    santaCatarina: new Map(),
    brasil: new Map(),
    escolasDeOrleans: new Map(),
    provaEmOrleans: novaSoma(),
    origemDaProva: { escolaEmOrleans: 0, escolaEmOutroMunicipio: 0, semEscola: 0 },
  };
  for await (const campo of linhasDoCsv(caminho, COLUNAS, { codificacao: 'latin1' })) {
    const municipio = campo('CO_MUNICIPIO_ESC');
    const rede = REDE_DA_ESCOLA[campo('TP_DEPENDENCIA_ADM_ESC')];
    const naProva = campo('CO_MUNICIPIO_PROVA') === ORLEANS;
    if (!municipio && !naProva) continue;
    const presente = ['CN', 'CH', 'LC', 'MT'].every((a) => campo(`TP_PRESENCA_${a}`) === '1');
    const notas: Partial<Record<Area, number>> = {};
    for (const area of NOMES_DAS_AREAS) {
      const nota = campo(AREAS[area]);
      if (nota) notas[area] = emCentesimos(nota);
    }
    if (naProva) {
      somar(somas.provaEmOrleans, presente, notas);
      if (!municipio) somas.origemDaProva.semEscola++;
      else if (municipio === ORLEANS) somas.origemDaProva.escolaEmOrleans++;
      else somas.origemDaProva.escolaEmOutroMunicipio++;
    }
    if (!municipio || !rede) continue;
    for (const agregada of REDES_AGREGADAS(rede)) {
      somar(daRede(somas.brasil, agregada), presente, notas);
      if (campo('CO_UF_ESC') === SANTA_CATARINA) somar(daRede(somas.santaCatarina, agregada), presente, notas);
      if (municipio === ORLEANS) {
        somar(daRede(somas.orleans, agregada), presente, notas);
        const escolas = somas.escolasDeOrleans.get(agregada) ?? new Set<string>();
        escolas.add(campo('CO_ESCOLA'));
        somas.escolasDeOrleans.set(agregada, escolas);
      }
    }
  }
  return somas;
}

/**
 * As redes de Orleans que podem sair. Rede com menos de 2 escolas não sai. Com uma só rede retida, publicar
 * `todas` (e `publica`, se ela for pública) a deduziria por subtração: o agregado também fica de fora.
 */
export function redesPublicaveis(escolas: ReadonlyMap<Rede, ReadonlySet<string>>): Set<Rede> {
  const publicaveis = new Set<Rede>();
  const retidas: Rede[] = [];
  for (const [rede, conjunto] of escolas) {
    if (conjunto.size >= MINIMO_DE_ESCOLAS) publicaveis.add(rede);
    else if (rede !== 'todas' && rede !== 'publica') retidas.push(rede);
  }
  if (retidas.length === 1) {
    publicaveis.delete('todas');
    if (PUBLICAS.has(retidas[0] as Rede)) publicaveis.delete('publica');
  }
  return publicaveis;
}

export function loteDoEnem(somas: SomasDoEnem, arquivo: string): Lote {
  const periodo = String(somas.ano);
  const publicaveis = redesPublicaveis(somas.escolasDeOrleans);
  const registros: RegistroBruto[] = [];
  for (const [rede, conjunto] of somas.escolasDeOrleans) {
    registros.push(
      registroDeValor({
        indicador: 'enem_escolas',
        lugar: ORLEANS,
        rede,
        etapa: ETAPA,
        periodo,
        valor: String(conjunto.size),
        unidade: 'escolas',
      }),
    );
  }
  for (const [rede, soma] of somas.orleans) {
    if (publicaveis.has(rede)) registros.push(...registrosDaSoma(ORLEANS, rede, periodo, soma));
  }
  for (const [rede, soma] of somas.santaCatarina)
    registros.push(...registrosDaSoma(SANTA_CATARINA, rede, periodo, soma));
  for (const [rede, soma] of somas.brasil) registros.push(...registrosDaSoma(BRASIL, rede, periodo, soma));

  // Quem prova em Orleans vem de várias escolas e de lugar nenhum: não identifica escola. É outro recorte.
  registros.push(...registrosDaSoma(ORLEANS, 'todas', periodo, somas.provaEmOrleans, 'prova_em_orleans'));
  const { escolaEmOrleans, escolaEmOutroMunicipio, semEscola } = somas.origemDaProva;
  for (const [recorte, n] of [
    ['prova_em_orleans:escola_em_orleans', escolaEmOrleans],
    ['prova_em_orleans:escola_em_outro_municipio', escolaEmOutroMunicipio],
    ['prova_em_orleans:sem_escola', semEscola],
  ] as const) {
    registros.push(
      pessoas(
        { indicador: 'enem_inscritos', lugar: ORLEANS, rede: 'todas', etapa: ETAPA, recorte, periodo },
        contagemPublicavel(n),
      ),
    );
  }
  return {
    chave: 'inep_enem',
    ano: somas.ano,
    registros,
    filtro: {
      arquivo: path.basename(arquivo),
      recorte: 'escola de conclusão; recorte prova_em_orleans é o município da prova',
      minimoDeEscolas: MINIMO_DE_ESCOLAS,
      extrato: false,
    },
  };
}

export async function extrairEnem({ origem }: { origem: string }): Promise<Lote[]> {
  const lotes: Lote[] = [];
  for (const ano of [2024, 2025]) {
    const caminho = acharArquivo(origem, new RegExp(`^RESULTADOS_${ano}\\.csv$`, 'i'));
    if (!caminho) throw new Error(`Arquivo não encontrado em ${origem}: RESULTADOS_${ano}.csv`);
    lotes.push(loteDoEnem(await somarResultados(caminho, ano), caminho));
  }
  return lotes;
}
