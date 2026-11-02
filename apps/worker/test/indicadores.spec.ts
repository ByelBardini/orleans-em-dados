import { describe, expect, it } from 'vitest';
import { INDICADORES, validarRegistro } from '@orleans-em-dados/contracts';
import { criarImportadores } from '../src/registro';

describe('registro de indicadores × importadores declarados', () => {
  it('todo indicador aponta para uma consulta que um importador real coleta', () => {
    const conhecidas = criarImportadores().flatMap((i) => i.consultas.map((c) => ({ id: c.id, importador: i.id })));

    expect(validarRegistro(INDICADORES, conhecidas)).toEqual([]);
  });
});
