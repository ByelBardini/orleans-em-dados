// O schema da receita: fonte única é a Betha sozinha, então nunca tem parte conferida.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { receitasSchema } from '../../src/api';

const GRAVADA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/api/test/paridade/respostas/api_receitas_ano_2025.json',
);

const conferida = () => JSON.parse(readFileSync(GRAVADA, 'utf8')).corpo;

describe('receitasSchema', () => {
  it('recusa fonte única com valor conferido', () => {
    const corpo = conferida();
    corpo.conferencia = { ...corpo.conferencia, disponivel: false, fonteUnica: true };

    expect(receitasSchema.safeParse(corpo).success).toBe(false);
  });

  it('aceita fonte única sem nada conferido', () => {
    const corpo = conferida();
    corpo.conferencia = {
      ...corpo.conferencia,
      disponivel: false,
      fonteUnica: true,
      parcial: null,
      limites: null,
      conferido: null,
      diferencaBetha: null,
      diferencaTce: null,
      aguardandoTce: null,
      totalBetha: null,
      totalTce: null,
    };

    expect(receitasSchema.safeParse(corpo).success).toBe(true);
  });
});
