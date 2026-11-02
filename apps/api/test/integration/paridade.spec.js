// A API responde igual às respostas gravadas, rota por rota. Regravar só com motivo
// escrito no commit: REGRAVAR_PARIDADE=1 pnpm exec vitest run --project=integracao apps/api/test/integration/paridade.spec.js
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '@orleans-em-dados/db';
import { popularBancoDeTeste } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { criarServidor } from '../../src/server.js';
import { CASOS, gravarResposta, pedir, respostaGravada } from '../paridade/casos.js';

const REGRAVAR = Boolean(process.env.REGRAVAR_PARIDADE);

let servidor;
let base;

beforeAll(async () => {
  await popularBancoDeTeste();
  servidor = criarServidor();
  await new Promise((pronto) => servidor.listen(0, pronto));
  base = `http://localhost:${servidor.address().port}`;
});

afterAll(async () => {
  await new Promise((fechado) => servidor.close(fechado));
  await pool.end();
});

describe('respostas gravadas', () => {
  it.each(CASOS)('%s responde igual ao gravado', async (caso) => {
    const resposta = await pedir(base, caso);
    if (REGRAVAR) gravarResposta(caso, resposta);
    expect(resposta).toEqual(respostaGravada(caso));
  });
});

// Valores escritos à mão: se uma resposta gravada estiver errada, é aqui que aparece.
describe('contrato', () => {
  it('método diferente de GET não é rota', async () => {
    const { status, corpo } = await pedir(base, '/api/anos', { method: 'POST' });
    expect(status).toBe(404);
    expect(corpo).toEqual({ erro: 'Rota não encontrada' });
  });

  it('ano sem coleta responde 404 citando a consulta e o ano', async () => {
    const { status, corpo } = await pedir(base, '/api/receitas?ano=2019');
    expect(status).toBe(404);
    expect(corpo).toEqual({ erro: 'Sem dados de receitas para 2019' });
  });

  it('receita total preserva o ajuste negativo ao somar', async () => {
    const { corpo } = await pedir(base, '/api/receitas?ano=2025');
    // 300000 + 250000,50 + 1000000 − 5000,25 + 200000 + 200000
    expect(corpo.totais.arrecadadoNoMes).toBe(1945000.25);
  });

  it('cópia antiga e empenho renumerado saem da soma dos empenhos da Betha', async () => {
    const { corpo } = await pedir(base, '/api/despesas/empenhos/resumo?ano=2025');
    expect(corpo.totais.excluidos).toBe(2);
    // 50000 + 120000 + 3000 + 15000; ficam de fora o 12 (7000) e a cópia do 13 (3000)
    expect(corpo.totais.empenhado).toBe(188000);
  });

  it('despesa total traz a Câmara à parte, pelo TCE-SC', async () => {
    const { corpo } = await pedir(base, '/api/despesas/resumo?ano=2025');
    expect(corpo.totais.empenhado).toBe(195000);
    expect(corpo.camara).toMatchObject({ sigla: 'Câmara', empenhado: 25000 });
  });

  it('busca ignora acento: "saude" acha o órgão com "SAÚDE"', async () => {
    const { corpo } = await pedir(base, '/api/despesas/empenhos?ano=2025&q=saude');
    expect(corpo.itens.map((l) => l.numero)).toEqual([5]);
  });

  it('CSV de empenhos abre com BOM, usa ponto e vírgula e escapa aspas', async () => {
    const { corpo, disposicao, tipo } = await pedir(base, '/api/despesas/empenhos.csv?ano=2025&q=pavimentacao');
    expect(tipo).toBe('text/csv; charset=utf-8');
    expect(disposicao).toBe('attachment; filename="empenhos-2025.csv"');
    expect(corpo.charCodeAt(0)).toBe(0xfeff);
    expect(corpo).toContain('Número;Data;Entidade;Órgão;Credor;Histórico;Empenhado;Liquidado;Pago;Saldo a pagar\r\n');
    expect(corpo).toContain('"Pavimentação; trecho ""A"" (exemplo)";120000;60000;40000;80000\r\n');
  });

  it('conferência indisponível lista o que falta', async () => {
    const { status, corpo } = await pedir(base, '/api/conferencias?ano=2019');
    expect(status).toBe(404);
    expect(corpo.faltando).toEqual(['receitas', 'empenhos', 'despesas', 'tcesc_receitas', 'tcesc_empenhos']);
  });
});
