// O schema do resumo de empenhos: a lista de fonte única é da Betha, nunca conferida.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { empenhosResumoSchema } from '../../src/api';

const GRAVADA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/api/test/paridade/respostas/api_despesas_empenhos_resumo_ano_2025.json',
);

const conferido = () => JSON.parse(readFileSync(GRAVADA, 'utf8')).corpo;

describe('empenhosResumoSchema', () => {
  it('recusa fonte única marcada como conferida', () => {
    const corpo = conferido();
    corpo.conferencia = { ...corpo.conferencia, disponivel: true, fonteUnica: true };

    expect(empenhosResumoSchema.safeParse(corpo).success).toBe(false);
  });

  it('aceita fonte única sem conferência', () => {
    const corpo = conferido();
    corpo.conferencia = { disponivel: false, parcial: null, dataCorte: null, fonteUnica: true };

    expect(empenhosResumoSchema.safeParse(corpo).success).toBe(true);
  });
});
