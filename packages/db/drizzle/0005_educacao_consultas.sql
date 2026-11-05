-- Uma consulta grava em uma tabela: o que o SIOPE mistura ganha uma segunda consulta, para o dinheiro e para os percentuais.
INSERT INTO consultas (id, fonte_id, chave, nome, url_origem, campo_filtro_ano, identificador_externo) VALUES
  (900404, 'siope', 'siope_indicadores_valores', 'Relatório de Indicadores: valores em reais',
   'https://www.fnde.gov.br/siope/indicadoresFinanceirosEEducacionais.do', 'ano', NULL),
  (900405, 'siope', 'siope_remuneracao_carga', 'Remuneração dos profissionais: carga horária e contagens',
   'https://www.fnde.gov.br/siope/consultarRemuneracaoMunicipal.do', 'ano', NULL);
UPDATE consultas SET nome = 'Relatório de Indicadores: percentuais' WHERE id = 900401;
UPDATE consultas SET nome = 'Remuneração dos profissionais: medianas e totais' WHERE id = 900403;
