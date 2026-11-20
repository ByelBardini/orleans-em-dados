# Segurança

## Versão suportada

Só a `main`, que é a versão em produção. Não há versões antigas mantidas.

## Como relatar

Escreva para **gabembits@gmail.com**, com "Segurança" no assunto. **Não abra issue pública** nem PR com os detalhes antes da correção.

Inclua, se puder: o que encontrou, onde (endereço, rota, arquivo), como reproduzir e o impacto que você enxerga. Não acesse, baixe nem guarde dado pessoal além do mínimo para mostrar o problema.

A primeira resposta vem em até **7 dias**. Depois da correção, o relato pode ser citado com crédito, se você quiser.

## O que entra

- Falha no site, na API, no worker ou na imagem Docker deste repositório.
- **Exposição de dado pessoal** é tratada como falha de segurança: nome ou histórico de credor que pode ser pessoa física aparecendo onde não devia (fora da lista de empenhos, em buscador, em log, num arquivo versionado), CPF, ou qualquer dado de pessoa física em fixture, commit ou resposta da API.
- Credencial ou token vazado no repositório, inclusive o token de acesso à Betha.

## O que não entra

- Número do painel que difere da fonte: é dado divergente, e vai em issue com o modelo **Dado divergente** (veja o [`CONTRIBUTING.md`](CONTRIBUTING.md)).
- Falha nos sistemas das fontes (Portal da Transparência Betha, TCE-SC, SICONFI, IBGE, INEP, FNDE): relate a quem os mantém.
- Teste automatizado de carga ou de negação de serviço contra o site em produção.
