import { PgBoss } from 'pg-boss';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '@orleans-em-dados/db';
import { RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { consultaFake, importadorFake } from '../../../../packages/importadores/nucleo/test/support/fakes';
import { FUSO, montarFilas, nomeDaFila } from '../../src/filas';
import { rodarImportador } from '../../src/rodada';

const OPCOES_RAPIDAS = { retryLimit: 1, retryDelay: 1, retryBackoff: false, pollingIntervalSeconds: 0.5 };
const NOME = nomeDaFila(importadorFake());

const abertos: PgBoss[] = [];

async function iniciar() {
  const boss = new PgBoss({ connectionString: process.env.DATABASE_URL as string, schedule: false });
  boss.on('error', () => {});
  await boss.start();
  abertos.push(boss);
  return boss;
}

async function esperarAte(condicao: () => Promise<boolean> | boolean, limiteMs = 20_000) {
  const inicio = Date.now();
  while (!(await condicao())) {
    if (Date.now() - inicio > limiteMs) throw new Error('A condição não aconteceu no prazo');
    await new Promise((r) => setTimeout(r, 100));
  }
}

const estadoDoJob = async (boss: PgBoss, id: string) => (await boss.findJobs(NOME, { id }))[0]?.state;

beforeEach(async () => {
  await pool.query('DROP SCHEMA IF EXISTS pgboss CASCADE');
  await pool.query('TRUNCATE execucoes RESTART IDENTITY CASCADE');
});

afterEach(async () => {
  while (abertos.length) await abertos.pop()?.stop({ graceful: false, close: true });
});

afterAll(() => pool.end());

describe('montarFilas', () => {
  it('cada importador vira uma fila singleton com o agendamento e o fuso de São Paulo', async () => {
    const boss = await iniciar();
    const importador = { ...importadorFake(), agenda: '0 3 * * *' };

    await montarFilas(boss, [importador], async () => {}, OPCOES_RAPIDAS);

    expect(await boss.getQueue(NOME)).toMatchObject({ policy: 'singleton', retryLimit: 1 });
    expect(await boss.getSchedules(NOME)).toMatchObject([{ name: NOME, cron: '0 3 * * *', timezone: FUSO }]);
  });

  it('importador sem agenda não ganha fila nem agendamento', async () => {
    const boss = await iniciar();
    const { agenda: _agenda, ...semAgenda } = importadorFake();

    await montarFilas(boss, [semAgenda], async () => {}, OPCOES_RAPIDAS);

    expect(await boss.getQueue(NOME)).toBeNull();
    expect(await boss.getSchedules(NOME)).toEqual([]);
  });

  it('reiniciar o worker não duplica o agendamento', async () => {
    const primeiro = await iniciar();
    await montarFilas(primeiro, [importadorFake()], async () => {}, OPCOES_RAPIDAS);
    await primeiro.stop({ graceful: false, close: true });
    abertos.length = 0;

    const segundo = await iniciar();
    await montarFilas(segundo, [importadorFake()], async () => {}, OPCOES_RAPIDAS);

    expect(await segundo.getSchedules(NOME)).toHaveLength(1);
  });

  it('agenda alterada na declaração substitui a anterior', async () => {
    const boss = await iniciar();
    await montarFilas(boss, [{ ...importadorFake(), agenda: '0 3 * * *' }], async () => {}, OPCOES_RAPIDAS);
    await boss.offWork(NOME);

    await montarFilas(boss, [{ ...importadorFake(), agenda: '0 5 * * *' }], async () => {}, OPCOES_RAPIDAS);

    expect(await boss.getSchedules(NOME)).toMatchObject([{ cron: '0 5 * * *' }]);
  });

  it('job concluído sem erro termina como completed', async () => {
    const boss = await iniciar();
    const rodados: string[] = [];
    await montarFilas(boss, [importadorFake()], async (i) => void rodados.push(i.id), OPCOES_RAPIDAS);

    const id = (await boss.send(NOME)) as string;

    await esperarAte(async () => (await estadoDoJob(boss, id)) === 'completed');
    expect(rodados).toEqual(['fake']);
  });

  it('rodada que falha é repetida até o limite, e cada tentativa fica registrada em execucoes', async () => {
    const boss = await iniciar();
    const quebrada = consultaFake({
      coletar: async () => {
        throw new Error('Betha: HTTP 503');
      },
    });
    const dependencias = { repositorio: new RepositorioDeLotesPostgres(), relogio: () => new Date() };
    await montarFilas(boss, [importadorFake(quebrada)], (i) => rodarImportador(i, dependencias), OPCOES_RAPIDAS);

    const id = (await boss.send(NOME)) as string;

    await esperarAte(async () => (await estadoDoJob(boss, id)) === 'failed');
    const { rows } = await pool.query('SELECT status, erro FROM execucoes ORDER BY id');
    expect(rows).toEqual([
      { status: 'falhou', erro: 'teste: Betha: HTTP 503' },
      { status: 'falhou', erro: 'teste: Betha: HTTP 503' },
    ]);
  });

  it('com uma rodada em andamento, a seguinte espera: só uma fica ativa', async () => {
    const boss = await iniciar();
    let ativas = 0;
    let maximo = 0;
    let concluidas = 0;
    let liberar: () => void = () => {};
    const portao = new Promise<void>((r) => (liberar = r));
    await montarFilas(
      boss,
      [importadorFake()],
      async () => {
        ativas += 1;
        maximo = Math.max(maximo, ativas);
        await portao;
        ativas -= 1;
        concluidas += 1;
      },
      OPCOES_RAPIDAS,
    );

    await boss.send(NOME);
    await esperarAte(() => ativas === 1);
    await boss.send(NOME);
    await new Promise((r) => setTimeout(r, 1500));
    expect(maximo).toBe(1);

    liberar();
    await esperarAte(() => concluidas === 2);
    expect(maximo).toBe(1);
  });
});
