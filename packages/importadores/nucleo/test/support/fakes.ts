// Fakes do executor: repositório em memória que guarda a ordem das chamadas,
// e um importador de mentira montado pelo spec.
import { tabelas } from '@orleans-em-dados/db';
import type {
  Coleta,
  ConsultaImportada,
  Importador,
  Lote,
  RegistroBruto,
  RepositorioDeLotes,
  ResultadoDaExecucao,
  Validacao,
} from '../../src/importador';

export class RepositorioDeLotesFake implements RepositorioDeLotes {
  ordem: string[] = [];
  gravados: Lote[] = [];
  publicados: { consultaId: number; ano: number; coletaId: number; hash: string }[] = [];
  reconfirmados: { coletaId: number; coletadoEm: Date }[] = [];
  execucoes: {
    id: number;
    importador: string;
    ano: number;
    inicio: Date;
    fim?: Date;
    resultado?: ResultadoDaExecucao;
  }[] = [];
  falharAoGravar: Error | null = null;

  async abrirExecucao(importador: string, ano: number, inicio: Date) {
    this.ordem.push('abrirExecucao');
    const id = this.execucoes.length + 1;
    this.execucoes.push({ id, importador, ano, inicio });
    return id;
  }

  async fecharExecucao(id: number, resultado: ResultadoDaExecucao, fim: Date) {
    this.ordem.push('fecharExecucao');
    const execucao = this.execucoes.find((e) => e.id === id);
    if (!execucao) throw new Error(`Execução ${id} não foi aberta`);
    execucao.fim = fim;
    execucao.resultado = resultado;
  }

  async publicada(consultaId: number, ano: number) {
    const atual = this.publicados.findLast((p) => p.consultaId === consultaId && p.ano === ano);
    return atual ? { coletaId: atual.coletaId, hash: atual.hash } : null;
  }

  async reconfirmar(coletaId: number, coletadoEm: Date) {
    this.ordem.push('reconfirmar');
    this.reconfirmados.push({ coletaId, coletadoEm });
  }

  async gravar(lote: Lote) {
    this.ordem.push('gravar');
    if (this.falharAoGravar) throw this.falharAoGravar;
    this.gravados.push(lote);
    return this.gravados.length;
  }

  async publicar(lote: Lote, coletaId: number) {
    this.ordem.push('publicar');
    this.publicados.push({ consultaId: lote.consultaId, ano: lote.ano, coletaId, hash: lote.hash });
    return true;
  }
}

export const relogioFake = (...instantes: string[]) => {
  let i = 0;
  return () => new Date(instantes[Math.min(i++, instantes.length - 1)] as string);
};

export const bruto = (id: string, valor: number | null = 10): RegistroBruto => ({ id, valor });

type ConsultaFake = {
  id?: number;
  chave?: string;
  coletar?: () => Promise<Coleta>;
  registros?: RegistroBruto[];
  normalizar?: (r: RegistroBruto) => Record<string, unknown>;
  validar?: (c: Coleta, l: readonly Record<string, unknown>[]) => Validacao;
};

export const consultaFake = (campos: ConsultaFake = {}): ConsultaImportada => {
  const registros = campos.registros ?? [bruto('a'), bruto('b')];
  return {
    id: campos.id ?? 1,
    chave: campos.chave ?? 'teste',
    tabela: tabelas.despesas,
    coletar: campos.coletar ?? (async () => ({ filtro: {}, totalHits: registros.length, registros })),
    normalizar: campos.normalizar ?? ((r) => ({ idExterno: r.id })),
    validar: campos.validar ?? (() => ({ conferencia: [], erros: [] })),
  };
};

export const importadorFake = (...consultas: ConsultaImportada[]): Importador => ({
  id: 'fake',
  fonte: 'fake',
  agenda: '0 3 * * *',
  anosDaRodada: () => [2025],
  consultas: consultas.length ? consultas : [consultaFake()],
});
