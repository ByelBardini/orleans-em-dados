// O llms.txt (https://llmstxt.org): um resumo do site em Markdown para buscadores de IA, com o aviso
// de independência, uma linha por página do catálogo e as fontes.
import { FONTES, PAGINAS } from '@orleans-em-dados/contracts';
import { urlDoSite } from './head';

export type OpcoesDoLlms = { siteUrl?: string | undefined; apoioAtivo: boolean };

export function montarLlms({ siteUrl, apoioAtivo }: OpcoesDoLlms) {
  const endereco = (caminho: string) => (siteUrl ? urlDoSite(siteUrl, caminho) : caminho);
  const paginas = PAGINAS.filter((p) => p.id !== 'apoiar' || apoioAtivo);
  return [
    '# Orleans em Dados',
    '',
    '> Dados públicos de Orleans/SC: receitas, despesas, educação e a cidade, cada número com fonte, ano e conferência entre as fontes.',
    '',
    'Projeto independente, sem vínculo com a Prefeitura de Orleans nem com os órgãos de controle. ' +
      'O painel só mostra como número principal o que confere entre duas fontes ou o que tem uma fonte só, ' +
      'rotulada assim; o resto fica na página Discrepâncias. Diferença entre fontes não indica irregularidade. ' +
      'Os textos e os dados do painel podem ser reusados com crédito (CC BY 4.0).',
    '',
    '## Páginas',
    '',
    ...paginas.map((p) => `- [${p.nome}](${endereco(p.caminho)}): ${p.descricao}`),
    '',
    '## Fontes',
    '',
    ...Object.values(FONTES).map((f) => `- [${f.nome}](${f.url})`),
    '',
  ].join('\n');
}
