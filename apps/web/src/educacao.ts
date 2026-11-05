// As contas e os nomes do caderno de Educação, sem DOM. Falta de dado é nulo ou travessão, e zero é dado.
import { redeSchema, type ComparacaoDeEducacao, type Rede, type ValoresDaRede } from '@orleans-em-dados/contracts';
import { escala } from './components';
import { numero } from './format';

export type Lugar = keyof ValoresDaRede;
export type UnidadeDaComparacao = ComparacaoDeEducacao['unidade'];
export type Escala = { min: number; max: number };
export type PontoDaSerie = { ano: number; valor: number | null };

export const LUGARES: readonly { chave: Lugar; nome: string; curto: string; classe: string }[] = [
  { chave: 'orleans', nome: 'Orleans', curto: 'Orleans', classe: 'orleans' },
  { chave: 'santaCatarina', nome: 'Santa Catarina', curto: 'SC', classe: 'santa-catarina' },
  { chave: 'brasil', nome: 'Brasil', curto: 'Brasil', classe: 'brasil' },
];

// Na ordem do alternador.
export const NOMES_DE_REDE: Record<Rede, string> = {
  publica: 'Pública',
  municipal: 'Municipal',
  estadual: 'Estadual',
  privada: 'Privada',
  todas: 'Todas',
};

export const rotuloDaRede = (rede: Rede) =>
  rede === 'todas' ? 'todas as redes' : `rede ${NOMES_DE_REDE[rede].toLowerCase()}`;

const ANOS_DO_FUNDAMENTAL = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`ano_${n}`, `${n}º ano`]);
const SERIES_DO_MEDIO = [1, 2, 3, 4].map((n) => [`serie_${n}`, `${n}ª série`]);

// As chaves de `etapa` em docs/context/educacao.md.
export const NOMES_DE_ETAPA: Record<string, string> = {
  educacao_infantil: 'Educação infantil',
  creche: 'Creche',
  pre_escola: 'Pré-escola',
  fundamental: 'Ensino fundamental',
  anos_iniciais: 'Anos iniciais',
  anos_finais: 'Anos finais',
  ...Object.fromEntries(ANOS_DO_FUNDAMENTAL),
  medio: 'Ensino médio',
  ...Object.fromEntries(SERIES_DO_MEDIO),
  eja: 'EJA',
  eja_fundamental: 'EJA, ensino fundamental',
  eja_medio: 'EJA, ensino médio',
};

const MENOR_CONTAGEM_PUBLICADA = 5;

// Quantos alunos uma taxa representa. É estimativa, e a frase diz isso; contagem abaixo de 5 não é publicada.
// Total abaixo de 5 também não vira frase: "menos de 5 de 4" não diz nada e aponta para alguém.
export function cercaDe(taxa: number | null, total: number | null): string | null {
  if (taxa === null || total === null || total < MENOR_CONTAGEM_PUBLICADA) return null;
  const contagem = Math.round((taxa * total) / 100);
  return contagem < MENOR_CONTAGEM_PUBLICADA
    ? `menos de ${MENOR_CONTAGEM_PUBLICADA} de ${numero(total)}`
    : `cerca de ${numero(contagem)} de ${numero(total)}`;
}

const lugaresComDado = (valores: ValoresDaRede | undefined) =>
  valores ? LUGARES.map((l) => valores[l.chave]).filter((v) => v !== null) : [];

/** As redes em que ao menos um lugar tem dado, em alguma das comparações, na ordem do alternador. */
export const redesComDado = (comparacoes: readonly Pick<ComparacaoDeEducacao, 'porRede'>[]): Rede[] =>
  redeSchema.options.filter((rede) => comparacoes.some((c) => lugaresComDado(c.porRede[rede]).length > 0));

const CASAS: Record<UnidadeDaComparacao, number> = { '%': 1, alunos: 1, horas: 1, indice: 1, nota: 2, anos: 1 };
const SUFIXO: Record<UnidadeDaComparacao, string> = {
  '%': '%',
  alunos: ' alunos',
  horas: ' horas',
  indice: '',
  nota: '',
  anos: ' anos',
};

export function formatarValor(valor: number | null, unidade: UnidadeDaComparacao, casas = CASAS[unidade]): string {
  if (valor === null) return '—';
  const texto = valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return `${texto}${SUFIXO[unidade]}`;
}

/** A meta é um número redondo da lei: sem as casas pedidas para os valores medidos ("100%", "62,5%"). */
export const formatarMeta = (valor: number, unidade: UnidadeDaComparacao) =>
  `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${SUFIXO[unidade]}`;

/** A escala cresce até caber o valor: um ponto na ponta, fora do lugar, diria um número errado. */
export const alargarEscala = ({ min, max }: Escala, valores: readonly number[]): Escala => ({
  min: Math.min(min, ...valores),
  max: Math.max(max, ...valores),
});

const ESCALA_DA_UNIDADE: Partial<Record<UnidadeDaComparacao, Escala>> = {
  '%': { min: 0, max: 100 },
  indice: { min: 0, max: 10 },
  nota: { min: 0, max: 1000 },
};

// Olha todas as redes, para o eixo não pular quando o alternador troca.
export function escalaDaComparacao(comparacao: ComparacaoDeEducacao, pedida?: Escala): Escala {
  const valores = [
    ...Object.values(comparacao.porRede).flatMap(lugaresComDado),
    ...(comparacao.meta ? [comparacao.meta.valor] : []),
  ];
  const base = pedida ??
    ESCALA_DA_UNIDADE[comparacao.unidade] ?? { min: 0, max: escala(Math.max(...valores, 0), 3).topo };
  return alargarEscala(base, valores);
}

export function posicaoNaEscala(valor: number, { min, max }: Escala): string {
  if (max === min) return '0%';
  return `${Number((((valor - min) / (max - min)) * 100).toFixed(2))}%`;
}

/** Os trechos contínuos de uma série: ano nulo ou ausente quebra a linha, sem ligar nem zerar. */
export function trechosDaSerie(anos: readonly number[], pontos: readonly PontoDaSerie[]) {
  const trechos: { ano: number; valor: number }[][] = [];
  let aberto = false;
  for (const ano of anos) {
    const valor = pontos.find((p) => p.ano === ano)?.valor ?? null;
    if (valor === null) {
      aberto = false;
      continue;
    }
    if (!aberto) trechos.push([]);
    trechos.at(-1)?.push({ ano, valor });
    aberto = true;
  }
  return trechos;
}
