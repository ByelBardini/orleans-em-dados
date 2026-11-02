import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  bruto,
  consultaFake,
  importadorFake,
  RepositorioDeLotesFake,
} from '../../../packages/importadores/nucleo/test/support/fakes';
import { importarArquivos, importarDaFonte, salvarSnapshot } from '../src/comandos';

const pastaTemporaria = () => mkdtempSync(path.join(tmpdir(), 'orleans-worker-'));

const deps = () => ({
  repositorio: new RepositorioDeLotesFake(),
  relogio: () => new Date('2026-03-10T06:00:00.000Z'),
});

describe('importarDaFonte', () => {
  it('executa o importador pedido no exercício pedido', async () => {
    const dependencias = deps();

    const resultado = await importarDaFonte([importadorFake()], 'fake', 2024, undefined, dependencias);

    expect(resultado).toMatchObject({ importador: 'fake', ano: 2024, status: 'sucesso' });
  });

  it('importador desconhecido é recusado citando os válidos', async () => {
    await expect(importarDaFonte([importadorFake()], 'outro', 2024, undefined, deps())).rejects.toThrow(
      'Importador desconhecido: outro; opções: fake',
    );
  });

  it('consulta desconhecida é recusada citando as válidas, antes de abrir a execução', async () => {
    const dependencias = deps();

    await expect(importarDaFonte([importadorFake()], 'fake', 2024, ['outra'], dependencias)).rejects.toThrow(
      'Consulta desconhecida em fake: outra; opções: teste',
    );
    expect(dependencias.repositorio.execucoes).toEqual([]);
  });
});

const arquivo = (pasta: string, nome: string, conteudo: object | string) => {
  const caminho = path.join(pasta, nome);
  writeFileSync(caminho, typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo));
  return caminho;
};

const snapshotDe = (status: string, consultaId = 1) => ({
  meta: {
    consultaId,
    ano: 2025,
    filtro: {},
    iniciadoEm: '2025-03-01T12:00:00.000Z',
    coletadoEm: '2025-03-01T12:00:00.000Z',
    totalHits: 1,
    capturados: 1,
    idsUnicos: 1,
    status,
  },
  registros: [bruto('a')],
});

describe('importarArquivos', () => {
  it('snapshot real entra com origem arquivo e informa o resultado', async () => {
    const repositorio = new RepositorioDeLotesFake();
    const caminho = arquivo(pastaTemporaria(), 's.json', snapshotDe('totalizador_conciliado'));

    const [resultado] = await importarArquivos([caminho], [importadorFake()], repositorio);

    expect(resultado).toEqual({ arquivo: caminho, coletaId: 1, publicada: true, linhas: 1 });
    expect(repositorio.gravados[0]?.origem).toBe('arquivo');
  });

  it('snapshot de exemplo entra com origem exemplo', async () => {
    const repositorio = new RepositorioDeLotesFake();
    const caminho = arquivo(pastaTemporaria(), 's.json', snapshotDe('exemplo'));

    await importarArquivos([caminho], [importadorFake()], repositorio);

    expect(repositorio.gravados[0]?.origem).toBe('exemplo');
  });

  it('consulta que nenhum importador conhece vira erro no arquivo, e os outros continuam', async () => {
    const repositorio = new RepositorioDeLotesFake();
    const pasta = pastaTemporaria();
    const ruim = arquivo(pasta, 'ruim.json', snapshotDe('exemplo', 999));
    const bom = arquivo(pasta, 'bom.json', snapshotDe('exemplo'));

    const resultados = await importarArquivos([ruim, bom], [importadorFake()], repositorio);

    expect(resultados[0]).toEqual({ arquivo: ruim, erro: 'Nenhum importador conhece a consulta 999' });
    expect(resultados[1]).toMatchObject({ arquivo: bom, publicada: true });
  });

  it('JSON inválido vira erro no arquivo, sem derrubar a rodada', async () => {
    const caminho = arquivo(pastaTemporaria(), 'torto.json', '{ nao e json');

    const [resultado] = await importarArquivos([caminho], [importadorFake()], new RepositorioDeLotesFake());

    expect(resultado).toMatchObject({ arquivo: caminho, erro: expect.any(String) });
  });
});

describe('salvarSnapshot', () => {
  const lote = (status: 'totalizador_conciliado' | 'rejeitado') => ({
    consultaId: 1,
    tabela: consultaFake().tabela,
    ano: 2025,
    filtro: { ano: ['2025'] },
    iniciadoEm: new Date('2026-03-10T06:00:00.000Z'),
    coletadoEm: new Date('2026-03-10T06:01:00.000Z'),
    origem: 'api' as const,
    status,
    totalHits: 1,
    capturados: 1,
    idsUnicos: 1,
    camposAusentes: { valor: 0 },
    conferencia: [{ campo: 'valor', fonte: '10.00', calculado: '10.00', diferenca: '0.00' }],
    erros: [],
    hash: 'h',
    registros: [bruto('a')],
    linhas: [{ idExterno: 'a' }],
  });

  it('grava em <pasta>/<fonte>/<consulta>-<ano>.json', async () => {
    const pasta = pastaTemporaria();

    const destino = await salvarSnapshot(pasta, 'betha', 'receitas', lote('totalizador_conciliado'));

    expect(path.relative(pasta, destino)).toBe(path.join('betha', 'receitas-2025.json'));
  });

  it('lote rejeitado vai para um arquivo à parte, sem sobrescrever o bom', async () => {
    const pasta = pastaTemporaria();

    const destino = await salvarSnapshot(pasta, 'betha', 'receitas', lote('rejeitado'));

    expect(path.basename(destino)).toBe('receitas-2025.rejeitado.json');
  });

  it('o arquivo salvo volta a entrar por importarArquivos, com a mesma linha', async () => {
    const pasta = pastaTemporaria();
    const destino = await salvarSnapshot(pasta, 'fake', 'teste', lote('totalizador_conciliado'));
    const repositorio = new RepositorioDeLotesFake();

    const [resultado] = await importarArquivos([destino], [importadorFake()], repositorio);

    expect(resultado).toMatchObject({ publicada: true, linhas: 1 });
    expect(repositorio.gravados[0]).toMatchObject({
      coletadoEm: new Date('2026-03-10T06:01:00.000Z'),
      conferencia: [{ campo: 'valor', fonte: '10.00', calculado: '10.00', diferenca: '0.00' }],
    });
  });

  it('o arquivo não leva a tabela nem as linhas, só o que a coleta entregou', async () => {
    const destino = await salvarSnapshot(pastaTemporaria(), 'fake', 'teste', lote('totalizador_conciliado'));

    const salvo = JSON.parse(readFileSync(destino, 'utf8'));

    expect(Object.keys(salvo)).toEqual(['meta', 'registros']);
    expect(salvo.meta).not.toHaveProperty('tabela');
    expect(salvo.registros).toEqual([{ id: 'a', valor: 10 }]);
  });
});
