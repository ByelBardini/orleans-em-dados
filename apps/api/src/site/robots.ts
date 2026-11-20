// O robots.txt: o Google busca o JSON da API para renderizar as páginas com os números, então a API
// fica aberta ao robô, e o `X-Robots-Tag: noindex` tira o JSON do índice sem impedir a busca. Só a busca
// de empenhos fica fechada: traz nome de credor que pode ser pessoa física.
export type OpcoesDoRobots = { siteUrl?: string | undefined };

export function montarRobots({ siteUrl }: OpcoesDoRobots) {
  return [
    '# A busca e o CSV de empenhos trazem nome de credor que pode ser pessoa física: ficam fora dos buscadores.',
    '# O resto da API fica aberto ao robô, para as páginas renderizarem com os números; ela não entra no índice.',
    'User-agent: *',
    'Disallow: /api/despesas/empenhos',
    ...(siteUrl ? ['', `Sitemap: ${siteUrl}/sitemap.xml`] : []),
    '',
  ].join('\n');
}
