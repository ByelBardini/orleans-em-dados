// O que a tela diz quando o TCE-SC não publica o exercício (o Farol: receitas desde 2018, empenhos desde 2023),
// quando a Betha não publica uma entidade e quando a receita é bruta (até 2019), sem DOM: o texto é o mesmo
// em Finanças, Receitas, Despesas e Discrepâncias.
import { PRIMEIRO_EXERCICIO, type Receitas } from '@orleans-em-dados/contracts';
import { moeda } from './format';

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

/** O aviso da fonte única: "O TCE-SC não publica as receitas de 2017. Os números são só da Betha, sem conferência." */
export const avisoDeFonteUnica = (foraDaFonte: readonly string[], ano: number, deQue?: string) =>
  `${naoPublica(foraDaFonte, ano)}. Os números${deQue ? ` ${deQue}` : ''} são só do Portal da Transparência, sem conferência.`;

// "da Prefeitura", "do FMS": as entidades femininas do catálogo começam pelo substantivo.
const comArtigo = (entidade: string) =>
  /^(Prefeitura|Fundação|Câmara)/.test(entidade) ? `da ${entidade}` : `do ${entidade}`;

/** "A Betha não publica a receita da Prefeitura em 2020": a lacuna é da fonte, não da coleta. */
export const naoPublicaNaBetha = (entidade: string, ano: number) =>
  `O Portal da Transparência não publica a receita ${comArtigo(entidade)} em ${ano}`;

/** A entidade que só o TCE-SC registra no ano: lacuna da Betha, fora da manchete. */
export const avisoDeLacuna = (e: Receitas['conferencia']['entidadesSemBetha'][number], ano: number) =>
  `${naoPublicaNaBetha(e.entidade, ano)}. O TCE-SC registra ${moeda(e.totalTce)}.`;

/** O que a Betha publica até 2019: o bruto é comparado com o bruto do TCE-SC. */
export const RECEITA_BRUTA = 'receita bruta, antes da dedução do FUNDEB';

/** A dedução do FUNDEB que só o TCE-SC registra, em módulo: nunca somada ao conferido. */
export const notaDaDeducao = (deducao: number) =>
  `O TCE-SC registra a dedução do FUNDEB de ${moeda(Math.abs(deducao))}, que o Portal da Transparência não publica neste ano.`;

/** Por que a despesa do ano não tem número: a fonte não publica, ou ainda não foi coletada. */
export const motivoSemConferencia = (ano: number, foraDaFonte: readonly string[] | undefined) =>
  foraDaFonte?.length
    ? `${naoPublica(foraDaFonte, ano)}.`
    : `A despesa de ${ano} ainda não tem as duas fontes publicadas.`;
