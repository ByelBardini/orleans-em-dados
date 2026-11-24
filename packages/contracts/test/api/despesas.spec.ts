// O schema da despesa: fonte única é a Betha sozinha, então nunca tem entidade conferida.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { despesasResumoSchema } from '../../src/api';

const GRAVADA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/api/test/paridade/respostas/api_despesas_resumo_ano_2025.json',
);

const conferida = () => JSON.parse(readFileSync(GRAVADA, 'utf8')).corpo;

const SEM_CONTA = {
  disponivel: false,
  parcial: null,
  limites: null,
  aguardandoTce: null,
  diferencaBetha: null,
  totalBetha: null,
  entidadesConferidas: null,
  entidadesFora: null,
};

describe('despesasResumoSchema', () => {
  it('recusa fonte única com entidade conferida', () => {
    const corpo = conferida();
    corpo.conferencia = { ...corpo.conferencia, ...SEM_CONTA, fonteUnica: true, entidadesConferidas: 2 };

    expect(despesasResumoSchema.safeParse(corpo).success).toBe(false);
  });

  it('aceita fonte única sem conta e sem entidade conferida', () => {
    const corpo = conferida();
    corpo.conferencia = { ...corpo.conferencia, ...SEM_CONTA, fonteUnica: true };

    expect(despesasResumoSchema.safeParse(corpo).success).toBe(true);
  });
});
