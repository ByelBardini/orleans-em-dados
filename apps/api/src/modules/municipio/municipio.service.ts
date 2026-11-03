// Monta o retrato da cidade a partir das linhas publicadas do IBGE. O divisor do PIB per capita é
// `populacaoDoAno`, a mesma regra da tela.
import {
  populacaoDoAno,
  type Comparacao,
  type IndicadoresDoLugar,
  type Municipio,
  type PontoDaPopulacao,
} from '@orleans-em-dados/contracts';
import { linhasDoIbge, lotesDoIbge, type LinhaDoIbge, type LoteDoIbge } from './municipio.dao';

const CONSULTAS = ['ibge_populacao', 'ibge_censo', 'ibge_pib'];
const ANO_DO_CENSO = 2022;
const ANO_DO_CENSO_ANTERIOR = 2010;
const SANTA_CATARINA = '42';
const BRASIL = '1';
const PARCELAS_DO_PIB = {
  agropecuaria: '513',
  industria: '517',
  servicos: '6575',
  administracao: '525',
  impostos: '543',
};
const INICIO_DA_FAIXA_ABERTA = 80;
const FAIXA_ABERTA = '80 anos ou mais';

/** Mil reais → reais por pessoa, arredondado ao centavo. Sem valor ou sem população, sem número. */
export function pibPerCapita(pibEmMilReais: number | null, populacao: number | null): number | null {
  if (pibEmMilReais === null || !populacao) return null;
  return Math.round((pibEmMilReais * 1000 * 100) / populacao) / 100;
}

function deLinhas(linhas: readonly LinhaDoIbge[], tabela: string) {
  const daTabela = linhas.filter((l) => l.tabela === tabela);
  return (variavel: string, periodo: number, categoria = '') =>
    daTabela.find((l) => l.variavel === variavel && l.periodo === String(periodo) && l.categoria === categoria)
      ?.valor ?? null;
}

function exigir(valor: number | null, oQue: string): number {
  if (valor === null) throw new Error(`Lote publicado do IBGE sem ${oQue}`);
  return valor;
}

/** Censo vale sobre estimativa no mesmo ano; a tabela 6579 não estima ano de censo. */
export function serieDaPopulacao(linhas: readonly LinhaDoIbge[]): PontoDaPopulacao[] {
  const pontos = new Map<number, PontoDaPopulacao>();
  const incluir = (tabela: string, variavel: string, tipo: PontoDaPopulacao['tipo']) => {
    for (const l of linhas) {
      if (l.tabela !== tabela || l.variavel !== variavel || l.categoria !== '' || l.valor === null) continue;
      pontos.set(Number(l.periodo), { ano: Number(l.periodo), populacao: l.valor, tipo });
    }
  };
  incluir('6579', '9324', 'estimativa');
  incluir('200', '93', 'censo');
  incluir('4709', '93', 'censo');
  return [...pontos.values()].sort((a, b) => a.ano - b.ano);
}

function montarPiramide(linhas: readonly LinhaDoIbge[]) {
  const faixas = new Map<string, { faixa: string; homens: number; mulheres: number }>();
  for (const l of linhas) {
    if (l.tabela !== '9514' || l.valor === null) continue;
    const [sexo, faixa] = l.categoria.split('|');
    if (!faixa || (sexo !== 'Homens' && sexo !== 'Mulheres')) continue;
    const inicio = Number.parseInt(faixa, 10);
    const nome = inicio >= INICIO_DA_FAIXA_ABERTA ? FAIXA_ABERTA : faixa;
    const atual = faixas.get(nome) ?? { faixa: nome, homens: 0, mulheres: 0 };
    atual[sexo === 'Homens' ? 'homens' : 'mulheres'] += l.valor;
    faixas.set(nome, atual);
  }
  return [...faixas.values()].sort((a, b) => Number.parseInt(a.faixa, 10) - Number.parseInt(b.faixa, 10));
}

function montarPib(linhas: readonly LinhaDoIbge[], populacao: readonly PontoDaPopulacao[]) {
  const pib = deLinhas(linhas, '5938');
  const anos = linhas
    .filter((l) => l.tabela === '5938' && l.variavel === '37' && l.valor !== null)
    .map((l) => Number(l.periodo))
    .sort((a, b) => a - b);
  const serie = anos.map((ano) => {
    const parcelas = Object.entries(PARCELAS_DO_PIB).map(([nome, variavel]) => [nome, pib(variavel, ano)] as const);
    const divisor = populacaoDoAno(populacao, ano);
    const valor = pib('37', ano) as number;
    return {
      ano,
      pib: valor,
      perCapita: pibPerCapita(valor, divisor?.populacao ?? null),
      divisor,
      composicao: parcelas.every(([, v]) => v !== null)
        ? (Object.fromEntries(parcelas) as Record<keyof typeof PARCELAS_DO_PIB, number>)
        : null,
    };
  });
  return { serie, ultimoAnoDaComposicao: serie.findLast((p) => p.composicao)?.ano ?? null };
}

const emPercentual = (parte: number, total: number) => Math.round((parte / total) * 10000) / 100;

function indicadoresDoLugar(linhas: readonly LinhaDoIbge[], anoDoPib: number | null): IndicadoresDoLugar {
  const situacao = deLinhas(linhas, '9923');
  const rendimento = deLinhas(linhas, '10295');
  const populacao = serieDaPopulacao(linhas);
  const moradores = (ano: number) => populacao.find((p) => p.ano === ano && p.tipo === 'censo')?.populacao ?? null;
  const censo = exigir(moradores(ANO_DO_CENSO), 'população do Censo');
  const anterior = moradores(ANO_DO_CENSO_ANTERIOR);
  const nasFaixas = (quer: (inicio: number) => boolean) =>
    montarPiramide(linhas)
      .filter((f) => quer(Number.parseInt(f.faixa, 10)))
      .reduce((soma, f) => soma + f.homens + f.mulheres, 0);
  return {
    densidade: exigir(deLinhas(linhas, '4714')('614', ANO_DO_CENSO), 'densidade'),
    urbana: emPercentual(exigir(situacao('93', ANO_DO_CENSO, 'Urbana'), 'população urbana'), censo),
    ate14Anos: emPercentual(
      nasFaixas((inicio) => inicio < 15),
      censo,
    ),
    aPartirDe60Anos: emPercentual(
      nasFaixas((inicio) => inicio >= 60),
      censo,
    ),
    crescimento: anterior ? emPercentual(censo - anterior, anterior) : null,
    rendimentoMedio: exigir(rendimento('13431', ANO_DO_CENSO), 'rendimento médio'),
    rendimentoMediano: exigir(rendimento('13534', ANO_DO_CENSO), 'rendimento mediano'),
    pibPerCapita:
      anoDoPib === null
        ? null
        : pibPerCapita(
            deLinhas(linhas, '5938')('37', anoDoPib),
            populacaoDoAno(populacao, anoDoPib)?.populacao ?? null,
          ),
  };
}

const anosComPib = (linhas: readonly LinhaDoIbge[]) =>
  linhas.filter((l) => l.tabela === '5938' && l.variavel === '37' && l.valor !== null).map((l) => Number(l.periodo));

async function comparacao(lote: LoteDoIbge | undefined, orleans: readonly LinhaDoIbge[]): Promise<Comparacao | null> {
  if (!lote) return null;
  const linhas = await linhasDoIbge([lote.coletaId]);
  const santaCatarina = linhas.filter((l) => l.localidade === SANTA_CATARINA);
  const brasil = linhas.filter((l) => l.localidade === BRASIL);
  const nosDois = new Set(anosComPib(brasil));
  const comuns = anosComPib(santaCatarina).filter((ano) => nosDois.has(ano) && anosComPib(orleans).includes(ano));
  const anoDoPib = comuns.length ? Math.max(...comuns) : null;
  return {
    coletadoEm: lote.coletadoEm.toISOString(),
    anoDoCenso: ANO_DO_CENSO,
    anoDoCensoAnterior: ANO_DO_CENSO_ANTERIOR,
    anoDoPib,
    orleans: indicadoresDoLugar(orleans, anoDoPib),
    santaCatarina: indicadoresDoLugar(santaCatarina, anoDoPib),
    brasil: indicadoresDoLugar(brasil, anoDoPib),
  };
}

export async function municipio(): Promise<Municipio> {
  const publicados = await lotesDoIbge();
  const lotes = publicados.filter((l) => CONSULTAS.includes(l.chave));
  const faltando = CONSULTAS.filter((chave) => !lotes.some((l) => l.chave === chave));
  if (faltando.length) return { disponivel: false, faltando };

  const linhas = await linhasDoIbge(lotes.map((l) => l.coletaId));
  const censo = deLinhas(linhas, '4714');
  const situacao = deLinhas(linhas, '9923');
  const rendimento = deLinhas(linhas, '10295');
  const populacao = serieDaPopulacao(linhas);
  // A data do conjunto é a da consulta mais antiga: é o quanto ele inteiro está atualizado.
  const [maisAntiga] = [...lotes].sort((a, b) => a.coletadoEm.getTime() - b.coletadoEm.getTime());

  return {
    disponivel: true,
    meta: {
      fonte: maisAntiga!.fonte,
      urlOrigem: maisAntiga!.urlOrigem,
      coletadoEm: maisAntiga!.coletadoEm.toISOString(),
    },
    populacao: { serie: populacao },
    territorio: {
      ano: ANO_DO_CENSO,
      areaKm2: exigir(censo('6318', ANO_DO_CENSO), 'área'),
      densidade: exigir(censo('614', ANO_DO_CENSO), 'densidade'),
    },
    situacao: {
      ano: ANO_DO_CENSO,
      total: exigir(situacao('93', ANO_DO_CENSO), 'população por situação'),
      urbana: exigir(situacao('93', ANO_DO_CENSO, 'Urbana'), 'população urbana'),
      rural: exigir(situacao('93', ANO_DO_CENSO, 'Rural'), 'população rural'),
    },
    piramide: {
      ano: ANO_DO_CENSO,
      total: exigir(deLinhas(linhas, '9514')('93', ANO_DO_CENSO), 'total da pirâmide'),
      faixas: montarPiramide(linhas),
    },
    rendimento: {
      ano: ANO_DO_CENSO,
      medio: exigir(rendimento('13431', ANO_DO_CENSO), 'rendimento médio'),
      mediano: exigir(rendimento('13534', ANO_DO_CENSO), 'rendimento mediano'),
    },
    pib: montarPib(linhas, populacao),
    comparacao: await comparacao(
      publicados.find((l) => l.chave === 'ibge_comparacao'),
      linhas,
    ),
  };
}

/** Só a série da população, para quem precisa do divisor; vazia sem a coleta. */
export async function populacaoPublicada(): Promise<PontoDaPopulacao[]> {
  const lote = (await lotesDoIbge()).find((l) => l.chave === 'ibge_populacao');
  return lote ? serieDaPopulacao(await linhasDoIbge([lote.coletaId])) : [];
}
