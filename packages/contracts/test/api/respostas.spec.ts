import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  anosSchema,
  conferenciaSchema,
  discrepanciasSchema,
  despesasResumoSchema,
  empenhosBuscaSchema,
  empenhosResumoSchema,
  erroSchema,
  funcoesSchema,
  funcoesSerieSchema,
  municipioSchema,
  receitasSchema,
} from '../../src/api';

const PASTA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/api/test/paridade/respostas',
);

const gravada = (arquivo: string) => JSON.parse(readFileSync(path.join(PASTA, arquivo), 'utf8'));

// Do nome do arquivo gravado para o schema que descreve o corpo.
const SCHEMAS: [RegExp, z.ZodType][] = [
  [/^api_anos/, anosSchema],
  [/^api_conferencias/, conferenciaSchema],
  [/^api_receitas_ano|^api_receitas\.json/, receitasSchema],
  [/^api_despesas_resumo/, despesasResumoSchema],
  [/^api_discrepancias/, discrepanciasSchema],
  [/^api_municipio/, municipioSchema],
  [/^api_funcoes_serie/, funcoesSerieSchema],
  [/^api_funcoes/, funcoesSchema],
  [/^api_despesas_empenhos_resumo/, empenhosResumoSchema],
  [/^api_despesas_empenhos_ano/, empenhosBuscaSchema],
];

const respostasJson = readdirSync(PASTA)
  .map((arquivo) => ({ arquivo, ...gravada(arquivo) }))
  .filter((r) => r.tipo?.includes('json'));

describe('respostas gravadas', () => {
  const sucessos = respostasJson.filter((r) => r.status === 200);
  const erros = respostasJson.filter((r) => r.status !== 200);

  it.each(sucessos.map((r) => [r.arquivo, r.corpo]))('%s obedece ao schema da rota', (arquivo, corpo) => {
    const schema = SCHEMAS.find(([padrao]) => padrao.test(arquivo))?.[1];
    if (!schema) throw new Error(`Sem schema para ${arquivo}`);
    const resultado = schema.safeParse(corpo);
    expect(resultado.error?.issues).toBeUndefined();
  });

  it.each(erros.map((r) => [r.arquivo, r.corpo]))('%s obedece ao schema de erro', (_arquivo, corpo) => {
    expect(erroSchema.safeParse(corpo).success).toBe(true);
  });
});

describe('schemas são estritos', () => {
  const anos = () => gravada('api_anos.json').corpo;

  it('campo a mais é recusado indicando qual', () => {
    const resultado = anosSchema.safeParse({ ...anos(), campoNovo: 1 });
    expect(resultado.error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['campoNovo'] });
  });

  it('campo faltando é recusado com o caminho dele', () => {
    const { exemplo: _exemplo, ...semExemplo } = anos();
    expect(anosSchema.safeParse(semExemplo).error?.issues[0]?.path).toEqual(['exemplo']);
  });

  it('valor monetário como texto é recusado: a API devolve número', () => {
    const corpo = gravada('api_despesas_empenhos_ano_2025.json').corpo;
    corpo.itens[0].empenhado = '50000.00';
    expect(empenhosBuscaSchema.safeParse(corpo).error?.issues[0]?.path).toEqual(['itens', 0, 'empenhado']);
  });
});

describe('nulo é informação', () => {
  const corpo = () => gravada('api_despesas_empenhos_ano_2025.json').corpo;

  it('liquidado nulo é aceito e continua nulo, não vira zero', () => {
    const entrada = corpo();
    entrada.itens[0].liquidado = null;
    expect(empenhosBuscaSchema.parse(entrada).itens[0]?.liquidado).toBeNull();
  });

  it('número do empenho nulo é recusado: a coluna é obrigatória', () => {
    const entrada = corpo();
    entrada.itens[0].numero = null;
    expect(empenhosBuscaSchema.safeParse(entrada).error?.issues[0]?.path).toEqual(['itens', 0, 'numero']);
  });
});

describe('corpo de erro', () => {
  it('erro só é aceito pelo schema de erro, não pelo da rota', () => {
    const erro = { erro: 'Sem dados de receitas para 2019' };
    expect(erroSchema.parse(erro)).toEqual(erro);
    expect(receitasSchema.safeParse(erro).success).toBe(false);
  });

  it('conferência indisponível traz a lista do que falta', () => {
    const erro = { erro: 'Sem as duas fontes publicadas para 2019', faltando: ['receitas'] };
    expect(erroSchema.parse(erro)).toEqual(erro);
  });

  it('corpo sem a mensagem de erro é recusado', () => {
    expect(erroSchema.safeParse({ faltando: [] }).success).toBe(false);
  });
});
