// A população de um ano, vinda do IBGE pela API, com a mesma regra de divisor da API (`populacaoDoAno`).
// Sem coleta ou com a rota fora do ar: nulo, e a página só deixa de mostrar o "por morador".
import { municipioSchema, populacaoDoAno } from '@orleans-em-dados/contracts';
import { useApi } from './api';

export type Populacao = { pessoas: number; fonte: string };

export function usePopulacao(ano: number): Populacao | null {
  const { dados } = useApi('/api/municipio', municipioSchema);
  if (!dados?.disponivel) return null;
  const ponto = populacaoDoAno(dados.populacao.serie, ano);
  if (!ponto) return null;
  return {
    pessoas: ponto.populacao,
    fonte: `IBGE, ${ponto.tipo === 'censo' ? 'Censo' : 'estimativa'} ${ponto.ano}`,
  };
}
