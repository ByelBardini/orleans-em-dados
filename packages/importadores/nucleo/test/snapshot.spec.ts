import { describe, expect, it } from 'vitest';
import { gravarSnapshot, type Snapshot } from '../src/snapshot';
import { bruto, consultaFake, RepositorioDeLotesFake } from './support/fakes';

const snapshot = (campos: Partial<Snapshot['meta']> = {}, registros = [bruto('a'), bruto('b')]): Snapshot => ({
  meta: {
    consultaId: 1,
    ano: 2025,
    filtro: { ano: ['2025'] },
    iniciadoEm: '2025-03-01T12:00:00.000Z',
    coletadoEm: '2025-03-01T12:30:00.000Z',
    totalHits: registros.length,
    capturados: registros.length,
    idsUnicos: registros.length,
    status: 'totalizador_conciliado',
    ...campos,
  },
  registros,
});

describe('gravarSnapshot', () => {
  it('snapshot conciliado é gravado com os dados do arquivo e publicado', async () => {
    const repositorio = new RepositorioDeLotesFake();

    const resultado = await gravarSnapshot(consultaFake(), snapshot(), 'arquivo', repositorio);

    expect(resultado).toEqual({ coletaId: 1, publicada: true, linhas: 2 });
    expect(repositorio.ordem).toEqual(['gravar', 'publicar']);
    expect(repositorio.gravados[0]).toMatchObject({
      consultaId: 1,
      ano: 2025,
      origem: 'arquivo',
      status: 'totalizador_conciliado',
      iniciadoEm: new Date('2025-03-01T12:00:00.000Z'),
      coletadoEm: new Date('2025-03-01T12:30:00.000Z'),
      linhas: [{ idExterno: 'a' }, { idExterno: 'b' }],
    });
  });

  it('snapshot rejeitado é gravado, mas não publicado', async () => {
    const repositorio = new RepositorioDeLotesFake();

    const resultado = await gravarSnapshot(
      consultaFake(),
      snapshot({ status: 'rejeitado', erros: ['diverge'] }),
      'arquivo',
      repositorio,
    );

    expect(resultado.publicada).toBe(false);
    expect(repositorio.ordem).toEqual(['gravar']);
    expect(repositorio.gravados[0]?.erros).toEqual(['diverge']);
  });

  it('snapshot de exemplo passa pela publicação, com a regra do repositório', async () => {
    const repositorio = new RepositorioDeLotesFake();

    await gravarSnapshot(consultaFake(), snapshot({ status: 'exemplo' }), 'exemplo', repositorio);

    expect(repositorio.gravados[0]).toMatchObject({ status: 'exemplo', origem: 'exemplo' });
    expect(repositorio.ordem).toContain('publicar');
  });

  it('a conferência numérica do arquivo vira texto decimal', async () => {
    const repositorio = new RepositorioDeLotesFake();
    const conferencia = [{ campo: 'valor', titulo: 'Valor', fonte: 10.5, calculado: 10.5, diferenca: 0 }];

    await gravarSnapshot(consultaFake(), snapshot({ conferencia }), 'arquivo', repositorio);

    expect(repositorio.gravados[0]?.conferencia).toEqual([
      { campo: 'valor', titulo: 'Valor', descricao: null, fonte: '10.50', calculado: '10.50', diferenca: '0.00' },
    ]);
  });

  it('totalizador nulo no arquivo continua nulo', async () => {
    const repositorio = new RepositorioDeLotesFake();
    const conferencia = [{ campo: 'valor', fonte: null, calculado: 1, diferenca: null }];

    await gravarSnapshot(consultaFake(), snapshot({ status: 'rejeitado', conferencia }), 'arquivo', repositorio);

    expect(repositorio.gravados[0]?.conferencia[0]).toMatchObject({ fonte: null, diferenca: null });
  });

  it('registro que a normalização recusa impede a gravação, citando o id', async () => {
    const repositorio = new RepositorioDeLotesFake();
    const consulta = consultaFake({
      normalizar: () => {
        throw new Error('valor inválido');
      },
    });

    await expect(gravarSnapshot(consulta, snapshot(), 'arquivo', repositorio)).rejects.toThrow(
      'registro a: valor inválido',
    );
    expect(repositorio.gravados).toEqual([]);
  });

  it('id repetido num snapshot rejeitado vira uma linha só', async () => {
    const repositorio = new RepositorioDeLotesFake();

    await gravarSnapshot(
      consultaFake(),
      snapshot({ status: 'rejeitado' }, [bruto('a', 1), bruto('a', 2)]),
      'arquivo',
      repositorio,
    );

    expect(repositorio.gravados[0]?.linhas).toEqual([{ idExterno: 'a' }]);
  });
});
