// As respostas gravadas da API como fixture de tela: o mesmo JSON que a suíte de paridade confere.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../api/test/paridade/respostas');

export const respostaGravada = (arquivo: string) =>
  JSON.parse(readFileSync(path.join(PASTA, `${arquivo}.json`), 'utf8')).corpo;

export const ANO = 2025;

export const FILTROS = {
  anos: [2025],
  ano: ANO,
  setAno: () => {},
  entidades: [
    { codigo: '728', nome: 'Prefeitura Municipal', sigla: 'Prefeitura' },
    { codigo: '319', nome: 'Fundo Municipal de Saúde', sigla: 'FMS' },
  ],
  entidade: '',
  setEntidade: () => {},
};

export const ROTAS = {
  receitas: '/api/receitas?ano=2025&entidade=',
  empenhosResumo: '/api/despesas/empenhos/resumo?ano=2025&entidade=',
  despesas: '/api/despesas/resumo?ano=2025&entidade=',
  conferencia: '/api/conferencias?ano=2025',
  busca: (q = '', orgao = '', situacao = '', offset = 0) =>
    `/api/despesas/empenhos?ano=2025&q=${q}&entidade=&orgao=${orgao}&situacao=${situacao}&offset=${offset}&limit=25`,
};
