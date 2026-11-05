import { pool } from '@orleans-em-dados/db';
import { executar, RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { criarImportadorSiconfi } from '../../src/importador';
import type { ItemDaDca, ItemDoRreo } from '../../src/normalizar';
import { anexoCoerente, ClienteSiconfiFake } from '../support/dca';
import {
  anexo14Coerente,
  CONTA_DA_EDUCACAO,
  CONTA_DO_FUNDEB,
  contaDoRreo,
  linhasDeOutrosAssuntos,
} from '../support/rreo';

const rodar = (itens: ItemDaDca[]) =>
  executar(criarImportadorSiconfi({ cliente: new ClienteSiconfiFake(itens) }), 2025, {
    repositorio: new RepositorioDeLotesPostgres(),
    relogio: () => new Date('2026-11-02T06:00:00.000Z'),
  });

const valorDaSaude = () =>
  pool.query(
    `SELECT valor FROM siconfi_funcoes_publicadas
     WHERE etapa = 'empenhado' AND tipo = 'funcao' AND funcao_codigo = '10'`,
  );

beforeEach(() => pool.query('TRUNCATE coletas, execucoes RESTART IDENTITY CASCADE'));
afterAll(() => pool.end());

describe('importador do SICONFI sobre o Postgres', () => {
  it('lote aprovado aparece na view, com o exercício e as cinco etapas', async () => {
    const resultado = await rodar(anexoCoerente());

    expect(resultado.status).toBe('sucesso');
    expect((await valorDaSaude()).rows).toEqual([{ valor: 200.25 }]);
    const { rows } = await pool.query(`SELECT DISTINCT ano, etapa FROM siconfi_funcoes_publicadas ORDER BY etapa`);
    expect(rows.map((r) => r.etapa)).toEqual([
      'empenhado',
      'liquidado',
      'pago',
      'rp_nao_processados',
      'rp_processados',
    ]);
    expect(rows[0].ano).toBe(2025);
  });

  it('soma diferente do total rejeita o lote e mantém a publicação anterior', async () => {
    await rodar(anexoCoerente());

    const resultado = await rodar(anexoCoerente({ total: 301 }));

    expect(resultado.status).toBe('rejeitada');
    expect((await valorDaSaude()).rows).toEqual([{ valor: 200.25 }]);
  });

  it('resposta vazia rejeita o lote e mantém a publicação anterior', async () => {
    await rodar(anexoCoerente());

    const resultado = await rodar([]);

    expect(resultado.status).toBe('rejeitada');
    expect((await valorDaSaude()).rows).toEqual([{ valor: 200.25 }]);
  });

  it('mesmo conteúdo em nova rodada fica sem_mudanca', async () => {
    await rodar(anexoCoerente());

    const resultado = await rodar(anexoCoerente());

    expect(resultado.consultas.map((c) => c.status)).toEqual(['sem_mudanca', 'sem_mudanca']);
  });

  describe('consulta siconfi_indices', () => {
    const dcaDoAno = (ano: number) => anexoCoerente().map((i) => ({ ...i, exercicio: ano }));

    const rodarAno = (ano: number, anexo14: (ano: number) => ItemDoRreo[]) =>
      executar(criarImportadorSiconfi({ cliente: new ClienteSiconfiFake(dcaDoAno(ano), anexo14) }), ano, {
        repositorio: new RepositorioDeLotesPostgres(),
        relogio: () => new Date('2026-11-02T06:00:00.000Z'),
      });

    const statusDosIndices = (resultado: Awaited<ReturnType<typeof rodarAno>>) =>
      resultado.consultas.find((c) => c.chave === 'siconfi_indices')!.status;

    const indicesPublicados = async () =>
      (
        await pool.query(
          `SELECT ano, periodo, indicador, lugar, rede, recorte, valor, percentual
           FROM educacao_financas_publicadas ORDER BY ano, indicador`,
        )
      ).rows;

    it('lote aprovado aparece na view, com valor e percentual exatos das duas contas', async () => {
      await rodarAno(2025, (ano) => anexo14Coerente({ ano }));

      expect(await indicesPublicados()).toEqual([
        {
          ano: 2025,
          periodo: '2025',
          indicador: 'fundeb_remuneracao',
          lugar: '4211702',
          rede: 'municipal',
          recorte: '',
          valor: 800.75,
          percentual: 81.25,
        },
        {
          ano: 2025,
          periodo: '2025',
          indicador: 'indice_educacao',
          lugar: '4211702',
          rede: 'municipal',
          recorte: '',
          valor: 1500.25,
          percentual: 26.5,
        },
      ]);
    });

    it('2018 vazio e 2019 sem a linha não publicam, sem falhar nem afetar a DCA e os outros anos', async () => {
      const anexos: Record<number, ItemDoRreo[]> = {
        2017: anexo14Coerente({ ano: 2017 }),
        2018: [],
        2019: linhasDeOutrosAssuntos({ exercicio: 2019 }),
        2020: anexo14Coerente({ ano: 2020 }),
      };

      const resultados = [];
      for (const ano of [2017, 2018, 2019, 2020]) resultados.push(await rodarAno(ano, (a) => anexos[a]!));

      expect(resultados.map(statusDosIndices)).toEqual(['publicada', 'rejeitada', 'rejeitada', 'publicada']);
      expect(resultados.map((r) => r.status)).toEqual(['sucesso', 'rejeitada', 'rejeitada', 'sucesso']);
      const anosDosIndices = new Set((await indicesPublicados()).map((l) => l.ano));
      expect([...anosDosIndices]).toEqual([2017, 2020]);
      const dca = await pool.query(`SELECT DISTINCT ano FROM siconfi_funcoes_publicadas ORDER BY ano`);
      expect(dca.rows.map((r) => r.ano)).toEqual([2017, 2018, 2019, 2020]);
    });

    it('conta de formato novo rejeita o lote e mantém a publicação anterior', async () => {
      await rodarAno(2025, (ano) => anexo14Coerente({ ano }));

      const resultado = await rodarAno(2025, () => [
        ...contaDoRreo(CONTA_DA_EDUCACAO, 9, 9),
        ...contaDoRreo('Mínimo Anual de 80% do FUNDEB na Remuneração da Educação', 9, 9),
      ]);

      expect(statusDosIndices(resultado)).toBe('rejeitada');
      expect(resultado.consultas.find((c) => c.chave === 'siconfi_indices')!.erros[0]).toContain(
        'conta em formato desconhecido',
      );
      expect((await indicesPublicados()).map((l) => l.valor)).toEqual([800.75, 1500.25]);
    });

    it('mesmo conteúdo em nova rodada fica sem_mudanca', async () => {
      await rodarAno(2025, (ano) => anexo14Coerente({ ano }));

      const resultado = await rodarAno(2025, (ano) => anexo14Coerente({ ano }));

      expect(statusDosIndices(resultado)).toBe('sem_mudanca');
    });

    it('anexo novo substitui a publicação do exercício', async () => {
      await rodarAno(2025, (ano) => anexo14Coerente({ ano }));

      await rodarAno(2025, () => [
        ...contaDoRreo(CONTA_DA_EDUCACAO, 2000, 30),
        ...contaDoRreo(CONTA_DO_FUNDEB, 900, 90),
      ]);

      expect((await indicesPublicados()).map((l) => l.valor)).toEqual([900, 2000]);
    });
  });
});
