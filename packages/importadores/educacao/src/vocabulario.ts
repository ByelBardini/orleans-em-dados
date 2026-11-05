// O vocabulário de educacao_valores e educacao_financas. A lista comentada está em docs/context/educacao.md.
export const ORLEANS = '4211702';
export const SANTA_CATARINA = '42';
export const BRASIL = '1';
export const LUGARES = new Set([ORLEANS, SANTA_CATARINA, BRASIL]);

export type Rede = 'publica' | 'municipal' | 'estadual' | 'federal' | 'privada' | 'todas';
export const REDES = new Set<string>(['publica', 'municipal', 'estadual', 'federal', 'privada', 'todas']);

const ANOS = Array.from({ length: 9 }, (_, i) => `ano_${i + 1}`);
const SERIES = Array.from({ length: 4 }, (_, i) => `serie_${i + 1}`);

export const ETAPAS = new Set([
  '',
  'educacao_infantil',
  'creche',
  'pre_escola',
  'fundamental',
  'anos_iniciais',
  'anos_finais',
  ...ANOS,
  'multietapa',
  'medio',
  ...SERIES,
  'medio_nao_seriado',
  'eja',
  'eja_fundamental',
  'eja_medio',
]);

export const UNIDADES = new Set([
  '%',
  'alunos',
  'horas',
  'indice',
  'nota',
  'pessoas',
  'escolas',
  'anos',
  'turmas',
  'texto',
  'cursos',
  'vagas',
  'instituicoes',
  'municipios',
]);
