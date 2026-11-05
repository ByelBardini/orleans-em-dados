// SIOPE: Indicadores (CSV), Remuneração (CSV com dados pessoais) e Anexo 8 (PDF, curado à mão).
// Nome e CPF ficam só em memória, para contar cada pessoa uma vez. Nenhum erro repete conteúdo de linha.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { centavos, deCentavos, dinheiro as emDinheiro } from '@orleans-em-dados/contracts';
import type { ItemDeConferencia, RegistroBruto } from '@orleans-em-dados/importador-nucleo';
import { contagemPublicavel, dinheiroDoSiope, medianaPublicavel, percentualDoSiope } from '../validacoes';
import { ORLEANS } from '../vocabulario';
import { linhasDoCsv } from './arquivos';
import { pessoas, registroDeFinanca, registroDeValor, type Lote } from './snapshot';

const REDE = 'municipal' as const;

// ---- Indicadores: o último bimestre do ano. Exercício parcial não entra.

const PERCENTUAIS: Record<string, string> = {
  '1.1': 'indice_educacao',
  '1.2': 'fundeb_remuneracao',
  '1.3': 'fundeb_outras_despesas',
  '1.4': 'fundeb_nao_aplicado',
  '2.1': 'fundeb_em_infantil',
  '2.2': 'fundeb_em_fundamental',
  '2.4': 'despesa_infantil',
  '2.5': 'despesa_fundamental',
  '2.8': 'educacao_na_despesa_total',
};

const VALORES: Record<string, string> = {
  '4.1': 'por_aluno_infantil',
  '4.2': 'por_aluno_fundamental',
  '4.8': 'por_aluno_educacao_basica',
  '4.10': 'professores_por_aluno',
  '4.11': 'nao_docentes_por_aluno',
  '7.2': 'saldo_financeiro_fundeb',
  '7.3': 'fundeb_nao_utilizado',
  '8.1': 'educacao_valor_exigido',
  '8.2': 'educacao_valor_aplicado',
};

// O próprio SIOPE não recomenda: nesses anos, a educação básica fica acima de todas as etapas.
const NAO_RECOMENDADOS = new Set(['por_aluno_educacao_basica:2022', 'por_aluno_educacao_basica:2023']);

const ultimoBimestre = (ano: number) => `${ano} - 6º bimestre`;

/** Os dois lotes de um CSV de Indicadores; `null` se o exercício não fechou: o 6º bimestre vem zerado ou não existe. */
export async function lotesDeIndicadores(caminho: string, ano: number): Promise<Lote[] | null> {
  const coluna = ultimoBimestre(ano);
  const percentuais: RegistroBruto[] = [];
  const valores: RegistroBruto[] = [];
  const periodo = String(ano);
  const base = { lugar: ORLEANS, rede: REDE, periodo };
  let linhas: AsyncGenerator<(coluna: string) => string>;
  try {
    linhas = linhasDoCsv(caminho, ['Código', 'Indicador', coluna]);
    for await (const campo of linhas) {
      const codigo = campo('Código').trim();
      const chavePercentual = PERCENTUAIS[codigo];
      const chaveValor = VALORES[codigo];
      if (chavePercentual) {
        percentuais.push(
          registroDeValor({
            ...base,
            indicador: `siope_${chavePercentual}`,
            valor: percentualDoSiope(codigo, campo(coluna)),
            unidade: '%',
          }),
        );
      } else if (chaveValor && !NAO_RECOMENDADOS.has(`${chaveValor}:${ano}`)) {
        valores.push(
          registroDeFinanca({
            ...base,
            indicador: `siope_${chaveValor}`,
            valor: dinheiroDoSiope(codigo, campo(coluna)),
          }),
        );
      }
    }
  } catch (erro) {
    if ((erro as Error).message.includes(`faltam ${coluna}`)) return null;
    throw erro;
  }
  if (percentuais.find((r) => r.indicador === 'siope_indice_educacao')?.valor === null) return null;
  const filtro = { arquivo: path.basename(caminho), coluna, extrato: false };
  return [
    { chave: 'siope_indicadores', ano, registros: percentuais, filtro },
    { chave: 'siope_indicadores_valores', ano, registros: valores, filtro },
  ];
}

async function extrairIndicadores(pasta: string): Promise<Lote[]> {
  const lotes: Lote[] = [];
  for (const nome of (await readdir(pasta)).sort()) {
    const achado = /^indicadores_municipal_(\d{4})\.csv$/.exec(nome);
    if (!achado) continue;
    const doAno = await lotesDeIndicadores(path.join(pasta, nome), Number(achado[1]));
    if (doAno) lotes.push(...doAno);
  }
  return lotes;
}

// ---- Remuneração: por ano, conta a pessoa uma vez, e a soma tem de bater com a linha de total.

const COLUNAS_DA_REMUNERACAO = [
  'Ano',
  'Mês',
  'Nome',
  'CPF',
  'Carga Horária',
  'Tipo Categoria',
  'Categoria Profissional',
  'Situação Profissional',
  'Salário ou Vencimento Básico (R$)',
  'Total (a + b + c)',
];

const GRUPOS: Record<string, string> = {
  'Profissionais do magistério': 'magisterio',
  'Outros profissionais da educação': 'outros',
};

type Vinculo = {
  horas: number;
  temporarioHoras: number;
  total: bigint;
  vencimento: bigint;
  efetivo: boolean;
  temporario: boolean;
};

type Grupo = {
  pessoas: Map<string, Vinculo>;
  horas: number;
  horasTemporarias: number;
  formacao: Map<string, Set<string>>;
};

export type ResumoDaRemuneracao = {
  ano: number;
  somaDasLinhas: bigint;
  totalDaPlanilha: bigint | null;
  meses: Set<string>;
  maio: Record<string, Grupo>;
};

const centavosDoCampo = (texto: string) => {
  const limpo = texto.trim().replaceAll('.', '').replace(',', '.');
  return limpo ? centavos(emDinheiro(limpo)) : 0n;
};

const novoGrupo = (): Grupo => ({ pessoas: new Map(), horas: 0, horasTemporarias: 0, formacao: new Map() });

/** Resume uma planilha. Nome e CPF só compõem a chave em memória; a chave não sai daqui. */
export async function resumirRemuneracao(caminho: string): Promise<ResumoDaRemuneracao> {
  let ano: number | null = null;
  let somaDasLinhas = 0n;
  let totalDaPlanilha: bigint | null = null;
  const meses = new Set<string>();
  const maio: Record<string, Grupo> = {};
  let numero = 1;
  for await (const campo of linhasDoCsv(caminho, COLUNAS_DA_REMUNERACAO)) {
    numero++;
    const total = centavosDoCampo(campo('Total (a + b + c)'));
    if (!campo('Ano').trim()) {
      totalDaPlanilha = total;
      continue;
    }
    ano ??= Number(campo('Ano'));
    if (Number(campo('Ano')) !== ano) throw new Error(`${path.basename(caminho)}: mais de um ano na linha ${numero}`);
    somaDasLinhas += total;
    const mes = campo('Mês').trim();
    meses.add(mes);
    if (mes !== 'Maio') continue;
    const chaveDoGrupo = GRUPOS[campo('Tipo Categoria').trim()];
    if (!chaveDoGrupo) throw new Error(`${path.basename(caminho)}: categoria inesperada na linha ${numero}`);
    const grupo = (maio[chaveDoGrupo] ??= novoGrupo());
    const pessoa = `${campo('Nome').trim()}|${campo('CPF').trim()}`;
    const horas = Number(campo('Carga Horária'));
    const situacao = campo('Situação Profissional').trim();
    if (situacao !== 'Efetivo' && situacao !== 'Temporário') {
      throw new Error(`${path.basename(caminho)}: situação inesperada na linha ${numero}`);
    }
    const temporario = situacao === 'Temporário';
    grupo.horas += horas;
    if (temporario) grupo.horasTemporarias += horas;
    const vinculo = grupo.pessoas.get(pessoa) ?? {
      horas: 0,
      temporarioHoras: 0,
      total: 0n,
      vencimento: 0n,
      efetivo: false,
      temporario: false,
    };
    vinculo.horas += horas;
    if (temporario) vinculo.temporarioHoras += horas;
    vinculo.total += total;
    vinculo.vencimento += centavosDoCampo(campo('Salário ou Vencimento Básico (R$)'));
    vinculo.efetivo ||= !temporario;
    vinculo.temporario ||= temporario;
    grupo.pessoas.set(pessoa, vinculo);
    const categoria = campo('Categoria Profissional').trim();
    if (!grupo.formacao.has(categoria)) grupo.formacao.set(categoria, new Set());
    grupo.formacao.get(categoria)?.add(pessoa);
  }
  if (ano === null) throw new Error(`${path.basename(caminho)}: planilha sem linhas`);
  return { ano, somaDasLinhas, totalDaPlanilha, meses, maio };
}

// Proporcional a 40 horas, em centavos, com arredondamento.
const por40h = (valor: bigint, horas: number) => {
  if (horas <= 0) throw new Error('vínculo sem carga horária');
  return (valor * 80n + BigInt(horas)) / (2n * BigInt(horas));
};

const CHAVES_DE_FORMACAO: Record<string, string> = {
  'Docente habilitado em curso de licenciatura plena': 'licenciatura_plena',
  'Docente habilitado em curso de pedagogia': 'pedagogia',
  'Docente habilitado em curso de nível médio': 'nivel_medio',
  'Profissionais não habilitados, porém autorizados a exercer a docência em caráter precário e provisório na educação infantil e nos anos iniciais do ensino fundamental':
    'nao_habilitados_autorizados',
};

function registrosDoGrupo(ano: number, chave: string, grupo: Grupo) {
  const periodo = `${ano}-05`;
  const base = { lugar: ORLEANS, rede: REDE, periodo };
  const todas = [...grupo.pessoas.values()];
  const efetivos = todas.filter((p) => p.efetivo && !p.temporario);
  const temporarios = todas.filter((p) => p.temporario && !p.efetivo);
  const total40h = (lista: typeof todas) => lista.map((p) => por40h(p.total, p.horas));
  const vencimento40h = (lista: typeof todas) => lista.map((p) => por40h(p.vencimento, p.horas));
  const pct = grupo.horas ? ((grupo.horasTemporarias / grupo.horas) * 100).toFixed(1) : null;

  const carga = [
    registroDeValor({
      ...base,
      indicador: 'carga_temporaria',
      recorte: `${chave}:temporario`,
      valor: pct,
      unidade: '%',
    }),
    registroDeValor({
      ...base,
      indicador: 'carga_horas',
      recorte: `${chave}:todos`,
      valor: String(grupo.horas),
      unidade: 'horas',
    }),
    pessoas({ ...base, indicador: 'profissionais', recorte: `${chave}:todos` }, contagemPublicavel(todas.length)),
    pessoas({ ...base, indicador: 'profissionais', recorte: `${chave}:efetivo` }, contagemPublicavel(efetivos.length)),
    pessoas(
      { ...base, indicador: 'profissionais', recorte: `${chave}:temporario` },
      contagemPublicavel(temporarios.length),
    ),
    ...(chave === 'magisterio'
      ? [...grupo.formacao].map(([categoria, gente]) => {
          const recorte = CHAVES_DE_FORMACAO[categoria];
          if (!recorte) throw new Error(`Remuneração: categoria de formação inesperada em ${ano}`);
          return pessoas({ ...base, indicador: 'formacao_magisterio', recorte }, contagemPublicavel(gente.size));
        })
      : []),
  ];
  const mediana = (recorte: string, indicador: string, valores: bigint[]) =>
    registroDeFinanca({ ...base, indicador, recorte: `${chave}:${recorte}`, valor: medianaPublicavel(valores) });
  const financas = [
    mediana('todos', 'mediana_40h', total40h(todas)),
    mediana('efetivo', 'mediana_40h', total40h(efetivos)),
    mediana('temporario', 'mediana_40h', total40h(temporarios)),
    mediana('efetivo', 'mediana_vencimento_40h', vencimento40h(efetivos)),
    mediana('temporario', 'mediana_vencimento_40h', vencimento40h(temporarios)),
  ];
  return { carga, financas };
}

const MESES_DO_ANO = 12;

/** Os lotes de um ano. Ano incompleto só traz a foto de maio; ano completo, também o total declarado. */
export function lotesDaRemuneracao(resumo: ResumoDaRemuneracao, arquivo: string): Lote[] {
  const { ano, somaDasLinhas, totalDaPlanilha, meses, maio } = resumo;
  if (totalDaPlanilha === null) throw new Error(`${arquivo}: sem a linha de total`);
  if (somaDasLinhas !== totalDaPlanilha) {
    throw new Error(
      `${arquivo}: a soma das linhas difere do total da planilha em ${deCentavos(somaDasLinhas - totalDaPlanilha)}`,
    );
  }
  const conferencia: ItemDeConferencia[] = [
    {
      campo: 'total',
      titulo: 'Total (a + b + c)',
      descricao: 'Soma das linhas = linha de total da planilha',
      fonte: deCentavos(totalDaPlanilha),
      calculado: deCentavos(somaDasLinhas),
      diferenca: '0.00',
    },
  ];
  const grupos = Object.entries(maio).map(([chave, grupo]) => registrosDoGrupo(ano, chave, grupo));
  const completo = meses.size === MESES_DO_ANO;
  const filtro = { arquivo: 'Relatório de Remuneração do SIOPE', foto: 'maio', ...{ extrato: false } };
  return [
    {
      chave: 'siope_remuneracao',
      ano,
      filtro,
      conferencia,
      registros: [
        ...grupos.flatMap((g) => g.financas),
        ...(completo
          ? [
              registroDeFinanca({
                indicador: 'total_declarado',
                lugar: ORLEANS,
                rede: REDE,
                periodo: String(ano),
                valor: deCentavos(somaDasLinhas),
              }),
            ]
          : []),
      ],
    },
    { chave: 'siope_remuneracao_carga', ano, filtro, conferencia, registros: grupos.flatMap((g) => g.carga) },
  ];
}

async function extrairRemuneracao(pasta: string): Promise<Lote[]> {
  const porAno = new Map<number, ResumoDaRemuneracao>();
  for (const nome of (await readdir(pasta)).sort()) {
    if (!/^Planilha.*\.csv$/.test(nome)) continue;
    const resumo = await resumirRemuneracao(path.join(pasta, nome));
    const anterior = porAno.get(resumo.ano);
    // O mesmo relatório baixado duas vezes é comum; dois relatórios diferentes do mesmo ano, não.
    if (anterior && anterior.somaDasLinhas !== resumo.somaDasLinhas) {
      throw new Error(`Duas planilhas de ${resumo.ano} com somas diferentes`);
    }
    porAno.set(resumo.ano, resumo);
  }
  return [...porAno.values()].flatMap((r) => lotesDaRemuneracao(r, `planilha de ${r.ano}`));
}

// ---- Anexo 8: transcrito do PDF, conferido na extração.

export type Anexo8Curado = {
  ano: number;
  receita_impostos?: string;
  destinado_ao_fundeb?: string;
  resultado_liquido_fundeb: string;
  educacao: { exigido: string; aplicado: string; pct: number };
  fundeb_remuneracao: { exigido?: string; aplicado?: string; pct: number };
  total_educacao: Record<string, string>;
  pessoal_ativo_liquidado?: string;
  capital?: Record<string, string>;
  emenda_119?: Record<string, string>;
};

const MINIMO_DE_EDUCACAO = 25n;
const MINIMO_DO_FUNDEB = (ano: number) => (ano <= 2020 ? 60n : 70n);

// aplicado ÷ base, em centésimos de ponto: o PDF publica com duas casas.
const percentualDe = (aplicado: bigint, base: bigint) => Number((aplicado * 1_000_000n) / base) / 10_000;

function conferirPercentual(
  ano: number,
  nome: string,
  aplicado: bigint,
  base: bigint,
  publicado: number,
): ItemDeConferencia {
  const calculado = percentualDe(aplicado, base);
  // Até um centésimo de ponto: o PDF arredonda.
  if (Math.abs(calculado - publicado) > 0.01) {
    throw new Error(`Anexo 8 de ${ano}: ${nome} calcula ${calculado.toFixed(2)}%, o PDF traz ${publicado.toFixed(2)}%`);
  }
  return {
    campo: nome,
    descricao: 'aplicado ÷ receita = percentual do PDF, com tolerância de 0,01',
    fonte: publicado.toFixed(2),
    calculado: calculado.toFixed(2),
    diferenca: (calculado - publicado).toFixed(2),
  };
}

export function loteDoAnexo8(curado: Anexo8Curado): Lote {
  const { ano, educacao, fundeb_remuneracao: fundeb } = curado;
  const periodo = String(ano);
  const base = { lugar: ORLEANS, rede: REDE, periodo };
  const aplicado = centavos(emDinheiro(educacao.aplicado));
  // 2020 tem outro formato, sem a receita: o exigido é 25% dela.
  const receita = curado.receita_impostos
    ? centavos(emDinheiro(curado.receita_impostos))
    : (centavos(emDinheiro(educacao.exigido)) * 100n) / MINIMO_DE_EDUCACAO;
  const conferencia = [conferirPercentual(ano, 'indice_educacao', aplicado, receita, educacao.pct)];
  if (fundeb.aplicado && fundeb.exigido) {
    const baseDoFundeb = (centavos(emDinheiro(fundeb.exigido)) * 100n) / MINIMO_DO_FUNDEB(ano);
    conferencia.push(
      conferirPercentual(ano, 'fundeb_remuneracao', centavos(emDinheiro(fundeb.aplicado)), baseDoFundeb, fundeb.pct),
    );
  }
  const dinheiro = (indicador: string, valor: string | undefined, recorte = '') =>
    valor === undefined ? [] : [registroDeFinanca({ ...base, indicador, recorte, valor })];
  return {
    chave: 'siope_anexo8',
    ano,
    filtro: {
      arquivo: 'docs/educacao/curados/anexo8.json',
      lido: `RREO_Municipal_421170_6_${ano}.pdf`,
      extrato: false,
    },
    conferencia,
    registros: [
      registroDeFinanca({
        ...base,
        indicador: 'indice_educacao',
        valor: educacao.aplicado,
        percentual: educacao.pct.toFixed(2),
      }),
      ...dinheiro('indice_educacao', educacao.exigido, 'exigido'),
      registroDeFinanca({
        ...base,
        indicador: 'fundeb_remuneracao',
        valor: fundeb.aplicado ?? null,
        percentual: fundeb.pct.toFixed(2),
      }),
      ...dinheiro('fundeb_remuneracao', fundeb.exigido, 'exigido'),
      ...Object.entries(curado.total_educacao).flatMap(([recorte, v]) => dinheiro('gasto_total', v, recorte)),
      ...dinheiro('fundeb_contribuicao', curado.destinado_ao_fundeb),
      ...dinheiro('fundeb_resultado', curado.resultado_liquido_fundeb),
      ...dinheiro('receita_impostos', curado.receita_impostos),
      ...dinheiro('pessoal_ativo', curado.pessoal_ativo_liquidado),
      ...Object.entries(curado.capital ?? {}).flatMap(([recorte, v]) => dinheiro('capital', v, recorte)),
      ...Object.entries(curado.emenda_119 ?? {}).flatMap(([recorte, v]) => dinheiro('emenda_119', v, recorte)),
    ],
  };
}

export async function extrairSiope({ origem, curados }: { origem: string; curados: string }): Promise<Lote[]> {
  const pastas = await readdir(origem);
  const indicadores = pastas.find((p) => p === 'indicadores');
  const remuneracao = pastas.find((p) => /^remunera(ç|c)(ã|a)o$/.test(p.normalize('NFC')));
  if (!indicadores || !remuneracao) throw new Error(`${origem}: faltam as pastas indicadores e remuneração`);
  const anexo8 = JSON.parse(await readFile(path.join(curados, 'anexo8.json'), 'utf8')) as Anexo8Curado[];
  return [
    ...(await extrairIndicadores(path.join(origem, indicadores))),
    ...anexo8.map(loteDoAnexo8),
    ...(await extrairRemuneracao(path.join(origem, remuneracao))),
  ];
}
