import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  gravarLotes,
  montarSnapshot,
  pessoas,
  registroDeFinanca,
  registroDeValor,
  serializar,
  type Lote,
} from '../../src/extratores/snapshot';
import { pastaTemporaria } from '../support/arquivos';

const AGORA = new Date('2026-11-04T12:00:00.000Z');
const taxa = (indicador: string, valor: string | null) =>
  registroDeValor({
    indicador,
    lugar: '4211702',
    rede: 'publica',
    etapa: 'fundamental',
    periodo: '2025',
    valor,
    unidade: '%',
  });

const lote = (registros: Lote['registros'], chave = 'inep_distorcao'): Lote => ({
  chave,
  ano: 2025,
  registros,
  filtro: { extrato: false },
});

describe('registroDeValor e registroDeFinanca', () => {
  it('o id é a junção de lugar, rede, etapa, recorte, indicador e período', () => {
    expect(taxa('distorcao', '9').id).toBe('4211702:publica:fundamental::distorcao:2025');
  });

  it('finanças não tem etapa no id', () => {
    const registro = registroDeFinanca({
      indicador: 'gasto_total',
      lugar: '4211702',
      rede: 'municipal',
      recorte: 'pago',
      periodo: '2025',
      valor: '1.00',
    });

    expect(registro.id).toBe('4211702:municipal:pago:gasto_total:2025');
  });

  it('pessoas leva a contagem protegida', () => {
    const registro = pessoas(
      { indicador: 'x', lugar: '4211702', rede: 'todas', periodo: '2025' },
      { valor: null, texto: 'menos de 5' },
    );

    expect(registro).toMatchObject({ valor: null, texto: 'menos de 5', unidade: 'pessoas' });
  });
});

describe('montarSnapshot', () => {
  it('monta a meta coerente com os registros e o status de lote aprovado', () => {
    const { meta, registros } = montarSnapshot(lote([taxa('distorcao', '9')]), AGORA);

    expect(meta).toMatchObject({
      consultaId: 900303,
      ano: 2025,
      totalHits: 1,
      capturados: 1,
      idsUnicos: 1,
      status: 'totalizador_conciliado',
      iniciadoEm: '2026-11-04T12:00:00.000Z',
    });
    expect(registros).toHaveLength(1);
  });

  it('id repetido falha', () => {
    expect(() => montarSnapshot(lote([taxa('distorcao', '9'), taxa('distorcao', '9')]), AGORA)).toThrow(
      /1 ids repetidos/,
    );
  });

  it('registro que a guarda recusa falha, sem gerar snapshot', () => {
    const comNome = { ...taxa('distorcao', '9'), nome: 'x' };

    expect(() => montarSnapshot(lote([comNome]), AGORA)).toThrow(/campo desconhecido: nome/);
  });

  it('o validar da consulta também barra: rendimento que não fecha falha', () => {
    const registros = [taxa('aprovacao', '90'), taxa('reprovacao', '2'), taxa('abandono', '1')];

    expect(() => montarSnapshot(lote(registros, 'inep_rendimento'), AGORA)).toThrow(
      /aprovação \+ reprovação \+ abandono = 93/,
    );
  });

  it('consulta desconhecida falha', () => {
    expect(() => montarSnapshot(lote([], 'inep_nada'), AGORA)).toThrow(/Consulta desconhecida: inep_nada/);
  });
});

describe('serializar e gravarLotes', () => {
  it('o arquivo é JSON válido, com um registro por linha', () => {
    const texto = serializar(
      montarSnapshot(lote([taxa('distorcao', '9'), taxa('distorcao', '10')].slice(0, 1)), AGORA),
    );

    expect(JSON.parse(texto).registros).toHaveLength(1);
    expect(texto.split('\n').filter((l) => l.includes('"indicador"'))).toHaveLength(1);
  });

  it('um lote ruim não deixa arquivo de nenhum outro', async () => {
    const pasta = pastaTemporaria();
    const ruim = { ...lote([{ ...taxa('distorcao', '9'), nome: 'x' }]), chave: 'inep_turmas' };

    await expect(gravarLotes([lote([taxa('distorcao', '9')]), ruim], pasta, AGORA)).rejects.toThrow(
      /campo desconhecido/,
    );
    expect(readdirSync(pasta)).toEqual([]);
  });

  it('o nome do arquivo é chave-ano', async () => {
    const pasta = pastaTemporaria();

    const [destino] = await gravarLotes([lote([taxa('distorcao', '9')])], pasta, AGORA);

    expect(destino?.endsWith('inep_distorcao-2025.json')).toBe(true);
    expect(JSON.parse(readFileSync(destino as string, 'utf8')).meta.consultaId).toBe(900303);
  });
});
