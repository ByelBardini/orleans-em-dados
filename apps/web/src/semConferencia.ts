// O que a tela diz quando o TCE-SC não publica o exercício (o Farol: receitas desde 2018, empenhos desde 2023),
// sem DOM: o texto é o mesmo em Finanças, Receitas, Despesas e Discrepâncias.
import { PRIMEIRO_EXERCICIO } from '@orleans-em-dados/contracts';

const O_QUE_A_FONTE_PUBLICA: Record<string, [artigo: string, nome: string]> = {
  tcesc_receitas: ['as', 'receitas'],
  tcesc_empenhos: ['os', 'empenhos'],
};

/** "O TCE-SC não publica as receitas nem os empenhos de 2016": o exercício que nunca vai ter conferência. */
export const naoPublica = (foraDaFonte: readonly string[], ano: number) =>
  `O TCE-SC não publica ${foraDaFonte
    .map((f) => (O_QUE_A_FONTE_PUBLICA[f] ?? ['', f]).join(' ').trim())
    .join(' nem ')} de ${ano}`;

/** "O Farol do TCE-SC tem receitas a partir de 2018 e empenhos a partir de 2023." */
export const DESDE_QUANDO_O_TCE_PUBLICA = `O Farol do TCE-SC tem ${Object.entries(PRIMEIRO_EXERCICIO)
  .map(([chave, ano]) => `${O_QUE_A_FONTE_PUBLICA[chave]?.[1] ?? chave} a partir de ${ano}`)
  .join(' e ')}.`;

/** Por que a despesa do ano não tem número: a fonte não publica, ou ainda não foi coletada. */
export const motivoSemConferencia = (ano: number, foraDaFonte: readonly string[] | undefined) =>
  foraDaFonte?.length
    ? `${naoPublica(foraDaFonte, ano)}.`
    : `A despesa de ${ano} ainda não tem as duas fontes publicadas.`;
