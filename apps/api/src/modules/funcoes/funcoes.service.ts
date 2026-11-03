// Monta as respostas da despesa por função: o valor é fonte única por função, e o nível da
// conferência (`conferirFuncoes`) vale para o total e para a Legislativa.
import { populacaoDoAno, type Funcoes, type FuncoesSerie } from '@orleans-em-dados/contracts';
import { conferirFuncoes, type ConferenciaDeFuncoes } from '@orleans-em-dados/db/conferencias';
import type { ColetaPublicada } from '../coletas/coletas.dao';
import { populacaoPublicada } from '../municipio/municipio.service';
import { linhasDasFuncoes, totaisDasFuncoes, type Etapas, type LinhaDaFuncao } from './funcoes.dao';

const CODIGO_DA_CAMARA = '01';

const etapasDe = ({ empenhado, liquidado, pago }: Etapas): Etapas => ({ empenhado, liquidado, pago });

const subfuncoesDe = (linhas: readonly LinhaDaFuncao[], codigo: string) =>
  linhas
    .filter((l) => l.tipo === 'subfuncao' && l.codigo === codigo)
    .map((l) => ({ codigo: l.subfuncao as string, nome: l.nome, ...etapasDe(l) }));

const porPessoa = (valor: number | null, populacao: number) =>
  valor === null ? null : Math.round((valor * 100) / populacao) / 100;

const porMoradorDe = (etapas: Etapas, populacao: number | null): Etapas | null =>
  populacao === null
    ? null
    : {
        empenhado: porPessoa(etapas.empenhado, populacao),
        liquidado: porPessoa(etapas.liquidado, populacao),
        pago: porPessoa(etapas.pago, populacao),
      };

/** `sem_dca` não chega aqui: quem pede tem a coleta da DCA publicada. */
const nivelDe = (conferencia: ConferenciaDeFuncoes): Funcoes['conferencia'] =>
  conferencia.estado === 'sem_dca' ? 'sem_tce' : conferencia.estado;

export async function funcoesDoAno({ meta }: ColetaPublicada, ano: number): Promise<Funcoes> {
  const [linhas, [total], conferencia, serie] = await Promise.all([
    linhasDasFuncoes(ano),
    totaisDasFuncoes(ano),
    conferirFuncoes(ano),
    populacaoPublicada(),
  ]);
  const divisor = populacaoDoAno(serie, ano);
  const populacao = divisor?.populacao ?? null;
  const totais = etapasDe(total ?? { empenhado: null, liquidado: null, pago: null });
  const dasFuncoes = linhas.filter((l) => l.tipo === 'funcao');
  const camara = dasFuncoes.find((l) => l.codigo === CODIGO_DA_CAMARA);

  return {
    ano,
    meta,
    conferencia: nivelDe(conferencia),
    diferenca:
      conferencia.estado === 'diferenca' ? { total: conferencia.total, legislativa: conferencia.legislativa } : null,
    total: totais,
    divisor,
    porMorador: porMoradorDe(totais, populacao),
    funcoes: dasFuncoes
      .filter((l) => l.codigo !== CODIGO_DA_CAMARA)
      .map((l) => ({
        codigo: l.codigo,
        nome: l.nome,
        ...etapasDe(l),
        participacao: l.participacao,
        porMorador: porMoradorDe(l, populacao),
        subfuncoes: subfuncoesDe(linhas, l.codigo),
      })),
    camara: camara
      ? {
          codigo: camara.codigo,
          nome: camara.nome,
          ...etapasDe(camara),
          subfuncoes: subfuncoesDe(linhas, camara.codigo),
        }
      : null,
  };
}

export async function serieDasFuncoes(): Promise<FuncoesSerie> {
  const [linhas, totais] = await Promise.all([linhasDasFuncoes(null), totaisDasFuncoes(null)]);
  const anos = await Promise.all(
    totais.map(async ({ ano, ...total }) => {
      const dasFuncoes = linhas.filter((l) => l.ano === ano && l.tipo === 'funcao');
      const camara = dasFuncoes.find((l) => l.codigo === CODIGO_DA_CAMARA);
      return {
        ano,
        conferencia: nivelDe(await conferirFuncoes(ano)),
        total,
        funcoes: dasFuncoes
          .filter((l) => l.codigo !== CODIGO_DA_CAMARA)
          .map((l) => ({ codigo: l.codigo, nome: l.nome, ...etapasDe(l), participacao: l.participacao })),
        camara: camara ? { codigo: camara.codigo, nome: camara.nome, ...etapasDe(camara) } : null,
      };
    }),
  );
  return { valores: 'nominais', anos };
}
