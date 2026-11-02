import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db, pool, tabelas } from '@orleans-em-dados/db';
import { executar } from '../../src/executor.service';
import type { Lote, ResultadoDaExecucao } from '../../src/importador';
import { RepositorioDeLotesPostgres } from '../../src/lotes.dao';
import { bruto, consultaFake, importadorFake } from '../support/fakes';

const repositorio = new RepositorioDeLotesPostgres();

const lote = (campos: Partial<Lote> = {}): Lote => ({
  consultaId: 57170,
  tabela: tabelas.despesas,
  ano: 2025,
  filtro: { ano: ['2025'] },
  iniciadoEm: new Date('2026-03-10T06:00:00.000Z'),
  coletadoEm: new Date('2026-03-10T06:01:00.000Z'),
  origem: 'api',
  status: 'totalizador_conciliado',
  totalHits: 1,
  capturados: 1,
  idsUnicos: 1,
  camposAusentes: {},
  conferencia: [{ campo: 'valorEmpenhado', fonte: '1234.56', calculado: '1234.56', diferenca: '0.00' }],
  erros: [],
  hash: 'hash-a',
  registros: [{ id: '211:728:1', valorEmpenhadoAtualizado: 1234.56 }],
  linhas: [
    {
      idExterno: '211:728:1',
      entidadeCodigo: '728',
      natureza: '33903000000000',
      valorEmpenhado: '1234.56',
      valorLiquidado: null,
    },
  ],
  ...campos,
});

const ponteiro = async () =>
  (await pool.query('SELECT coleta_id FROM publicacoes WHERE consulta_id = 57170 AND ano = 2025')).rows[0]?.coleta_id;

beforeEach(async () => {
  await pool.query('TRUNCATE coletas, execucoes RESTART IDENTITY CASCADE');
});
afterAll(() => pool.end());

describe('RepositorioDeLotesPostgres — gravar', () => {
  it('grava coleta, totalizador, bruto e linhas normalizadas com coleta e ano', async () => {
    const coletaId = await repositorio.gravar(lote());

    const [coleta] = await db.select().from(tabelas.coletas).where(eq(tabelas.coletas.id, coletaId));
    expect(coleta).toMatchObject({
      consultaId: 57170,
      ano: 2025,
      status: 'totalizador_conciliado',
      hashPayload: 'hash-a',
    });
    const { rows: totais } = await pool.query('SELECT campo, valor_fonte, diferenca FROM totais_fonte');
    expect(totais).toEqual([{ campo: 'valorEmpenhado', valor_fonte: 1234.56, diferenca: 0 }]);
    const { rows: brutos } = await pool.query('SELECT id_externo, payload FROM registros_brutos');
    expect(brutos).toEqual([{ id_externo: '211:728:1', payload: { valorEmpenhadoAtualizado: 1234.56 } }]);
    const { rows: linhas } = await pool.query('SELECT coleta_id, ano, valor_empenhado, valor_liquidado FROM despesas');
    expect(linhas).toEqual([
      { coleta_id: String(coletaId), ano: 2025, valor_empenhado: 1234.56, valor_liquidado: null },
    ]);
  });

  it('valor grande atravessa como texto, sem perder centavos', async () => {
    const coletaId = await repositorio.gravar(
      lote({
        linhas: [{ idExterno: 'x', entidadeCodigo: '728', natureza: '3', valorEmpenhado: '9999999999999999.99' }],
      }),
    );

    const { rows } = await pool.query('SELECT valor_empenhado::text AS v FROM despesas WHERE coleta_id = $1', [
      coletaId,
    ]);
    expect(rows[0].v).toBe('9999999999999999.99');
  });

  it('registros repetidos guardam a primeira ocorrência no bruto', async () => {
    await repositorio.gravar(
      lote({
        status: 'rejeitado',
        registros: [
          { id: 'a', v: 1 },
          { id: 'a', v: 2 },
        ],
        linhas: [],
      }),
    );

    const { rows } = await pool.query('SELECT payload FROM registros_brutos');
    expect(rows).toEqual([{ payload: { v: 1 } }]);
  });

  it('mais linhas do que cabem em um INSERT são gravadas em blocos', async () => {
    const quantidade = 7000;
    const linhas = Array.from({ length: quantidade }, (_, i) => ({
      idExterno: `id-${i}`,
      entidadeCodigo: '728',
      natureza: '3',
      valorOrcado: '1.00',
      valorOrcadoAtualizado: '1.00',
      valorEmpenhado: '1.00',
      valorLiquidado: '1.00',
      valorPago: '1.00',
      acao: 'a',
      acaoNumero: '1',
    }));

    await repositorio.gravar(lote({ linhas }));

    const { rows } = await pool.query('SELECT count(*)::int AS n, sum(valor_pago) AS soma FROM despesas');
    expect(rows[0]).toEqual({ n: quantidade, soma: quantidade });
  });

  it('erro numa linha desfaz a gravação inteira', async () => {
    await expect(repositorio.gravar(lote({ linhas: [{ idExterno: 'x' }] }))).rejects.toThrow();

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM coletas');
    expect(rows[0].n).toBe(0);
  });
});

describe('RepositorioDeLotesPostgres — publicar', () => {
  it('publicar aponta a publicação para a coleta nova', async () => {
    const primeira = await repositorio.gravar(lote());
    expect(await repositorio.publicar(lote(), primeira)).toBe(true);
    const segunda = await repositorio.gravar(lote({ hash: 'hash-b' }));

    expect(await repositorio.publicar(lote(), segunda)).toBe(true);

    expect(await ponteiro()).toBe(String(segunda));
  });

  it('exemplo não substitui dado real', async () => {
    const real = await repositorio.gravar(lote());
    await repositorio.publicar(lote(), real);
    const exemplo = await repositorio.gravar(lote({ status: 'exemplo', origem: 'exemplo' }));

    expect(await repositorio.publicar(lote({ status: 'exemplo' }), exemplo)).toBe(false);

    expect(await ponteiro()).toBe(String(real));
  });

  it('exemplo é publicado num ano sem dado real, e dado real o substitui depois', async () => {
    const exemplo = await repositorio.gravar(lote({ status: 'exemplo', origem: 'exemplo' }));
    expect(await repositorio.publicar(lote({ status: 'exemplo' }), exemplo)).toBe(true);
    const real = await repositorio.gravar(lote());

    expect(await repositorio.publicar(lote(), real)).toBe(true);

    expect(await ponteiro()).toBe(String(real));
  });

  it('publicada devolve a coleta e o hash atuais; sem publicação, nulo', async () => {
    expect(await repositorio.publicada(57170, 2025)).toBeNull();
    const coletaId = await repositorio.gravar(lote());
    await repositorio.publicar(lote(), coletaId);

    expect(await repositorio.publicada(57170, 2025)).toEqual({ coletaId, hash: 'hash-a' });
  });

  it('reconfirmar atualiza só a data de extração da coleta', async () => {
    const coletaId = await repositorio.gravar(lote());

    await repositorio.reconfirmar(coletaId, new Date('2026-03-11T06:00:00.000Z'));

    const [coleta] = await db.select().from(tabelas.coletas).where(eq(tabelas.coletas.id, coletaId));
    expect(coleta?.finalizadoEm).toEqual(new Date('2026-03-11T06:00:00.000Z'));
    expect(coleta?.iniciadoEm).toEqual(new Date('2026-03-10T06:00:00.000Z'));
  });
});

describe('RepositorioDeLotesPostgres — execuções', () => {
  const resultado = (execucaoId: number): ResultadoDaExecucao => ({
    execucaoId,
    importador: 'betha',
    ano: 2025,
    status: 'rejeitada',
    consultas: [
      {
        consultaId: 57153,
        chave: 'receitas',
        status: 'rejeitada',
        coletaId: 7,
        linhasLidas: 10,
        linhasGravadas: 8,
        erros: ['diverge'],
      },
    ],
  });

  it('execução aberta fica em andamento, sem fim', async () => {
    const id = await repositorio.abrirExecucao('betha', 2025, new Date('2026-03-10T06:00:00.000Z'));

    const [execucao] = await db.select().from(tabelas.execucoes).where(eq(tabelas.execucoes.id, id));
    expect(execucao).toMatchObject({ importador: 'betha', ano: 2025, status: 'em_andamento', finalizadoEm: null });
  });

  it('execução fechada guarda status, somas das contagens, erro e o detalhe por consulta', async () => {
    const id = await repositorio.abrirExecucao('betha', 2025, new Date('2026-03-10T06:00:00.000Z'));

    await repositorio.fecharExecucao(id, resultado(id), new Date('2026-03-10T06:05:00.000Z'));

    const [execucao] = await db.select().from(tabelas.execucoes).where(eq(tabelas.execucoes.id, id));
    expect(execucao).toMatchObject({
      status: 'rejeitada',
      linhasLidas: 10,
      linhasGravadas: 8,
      erro: 'receitas: diverge',
      finalizadoEm: new Date('2026-03-10T06:05:00.000Z'),
    });
    expect(execucao?.detalhes).toEqual(resultado(id).consultas);
  });
});

describe('executor sobre o Postgres', () => {
  // Coluna `idExterno` + obrigatórias de `despesas`; o fake devolve só o id.
  const normalizar = (r: { id: string; valor?: unknown }) => ({
    idExterno: r.id,
    entidadeCodigo: '728',
    natureza: '3',
    valorEmpenhado: String(r.valor),
  });
  const consulta = () =>
    consultaFake({ id: 57170, chave: 'despesas', registros: [bruto('a', 10), bruto('b', 20)], normalizar });
  const dependencias = { repositorio, relogio: () => new Date('2026-03-10T06:00:00.000Z') };

  it('entrega at-least-once: a mesma execução repetida publica uma vez só', async () => {
    await executar(importadorFake(consulta()), 2025, dependencias);
    await executar(importadorFake(consulta()), 2025, dependencias);

    const contagem = async (tabela: string) => (await pool.query(`SELECT count(*)::int AS n FROM ${tabela}`)).rows[0].n;
    expect(await contagem('coletas')).toBe(1);
    expect(await contagem('despesas')).toBe(2);
    expect(await contagem('execucoes')).toBe(2);
  });

  it('conteúdo novo substitui a publicação, sem misturar as linhas das duas coletas', async () => {
    await executar(importadorFake(consulta()), 2025, dependencias);
    const nova = consultaFake({ id: 57170, chave: 'despesas', registros: [bruto('a', 11)], normalizar });

    await executar(importadorFake(nova), 2025, dependencias);

    const { rows } = await pool.query('SELECT sum(valor_empenhado) AS soma FROM despesas_publicadas');
    expect(rows[0].soma).toBe(11);
  });
});
