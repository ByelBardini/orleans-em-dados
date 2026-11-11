-- IPCA do IBGE (tabela 1737, número-índice mensal do Brasil): corrige pela inflação o dinheiro da educação.
INSERT INTO consultas (id, fonte_id, chave, nome, url_origem, campo_filtro_ano, identificador_externo) VALUES
  (900108, 'ibge', 'ibge_ipca', 'IPCA: número-índice mensal (tabela 1737)',
   'https://servicodados.ibge.gov.br/api/docs/agregados?versao=3', 'periodos', '{"tabelas": ["1737"]}');
