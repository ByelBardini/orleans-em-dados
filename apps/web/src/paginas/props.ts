import type { PropsDosFiltros } from '../components';

/** O que o App entrega a cada página. */
export type PropsDaPagina = { ano: number; entidade: string; filtros: Omit<PropsDosFiltros, 'children'> };
