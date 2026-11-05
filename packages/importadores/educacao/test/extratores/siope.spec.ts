import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loteDoAnexo8,
  lotesDaRemuneracao,
  lotesDeIndicadores,
  resumirRemuneracao,
  type Anexo8Curado,
} from '../../src/extratores/siope';
import { csv, idsDe, pastaTemporaria, registroDe } from '../support/arquivos';

const BOM = String.fromCharCode(0xfeff);
const CABECALHO =
  '"Ano";"Mês";"Nome";"CPF";"Código do Local de Exercício";"Local de Exercício";"Carga Horária";"Tipo Categoria";"Categoria Profissional";"Situação Profissional";"Segmento de Ensino";"Salário ou Vencimento Básico (R$)";"Com parcela mínima de 70% do FUNDEB (a)";"Com parcela mínima de 30% do FUNDEB (b)";"Outras Receitas (c)";"Total (a + b + c)"';
const MAGISTERIO = 'Profissionais do magistério';
const LICENCIATURA = 'Docente habilitado em curso de licenciatura plena';
const NIVEL_MEDIO = 'Docente habilitado em curso de nível médio';

type Pessoa = {
  nome: string;
  cpf?: string;
  mes?: string;
  horas?: number;
  situacao?: string;
  base?: string;
  total: string;
  categoria?: string;
  tipo?: string;
};

const linha = ({
  nome,
  cpf = '***.111.222-**',
  mes = 'Maio',
  horas = 40,
  situacao = 'Efetivo',
  base = '1.000,00',
  total,
  categoria = LICENCIATURA,
  tipo = MAGISTERIO,
}: Pessoa) =>
  `"2025";"${mes}";"${nome}";"${cpf}";"42000000";"ESCOLA FICTICIA";"${horas}";"${tipo}";"${categoria}";"${situacao}";"Creche";"${base}";"${total}";"0,00";"0,00";"${total}"`;

const totalDaPlanilha = (total: string) =>
  `"";"";"";"";"";"";"";"";"";"";"";"Total";"${total}";"0,00";"0,00";"${total}"`;

const planilha = (linhas: string[]) => csv(pastaTemporaria(), 'Planilha.csv', [`${BOM}${CABECALHO}`, ...linhas]);

// Dez pessoas fictícias com totais de R$ 1.000,00 a R$ 10.000,00 por 40 horas; soma R$ 55.000,00.
const dezPessoas = (situacao = 'Efetivo') =>
  Array.from({ length: 10 }, (_, i) =>
    linha({ nome: `Pessoa Ficticia ${i}`, cpf: `***.${100 + i}.222-**`, situacao, total: `${(i + 1) * 1000},00` }),
  );

const lotes = async (linhas: string[]) => lotesDaRemuneracao(await resumirRemuneracao(planilha(linhas)), 'planilha');
const lotePor = (todos: Awaited<ReturnType<typeof lotes>>, chave: string) =>
  todos.find((l) => l.chave === chave) as (typeof todos)[0];

describe('resumirRemuneracao e lotesDaRemuneracao', () => {
  it('a pessoa em duas escolas conta uma vez, e o salário soma as duas cargas', async () => {
    const todos = await lotes([
      linha({ nome: 'Pessoa Ficticia', horas: 20, total: '1.000,00' }),
      linha({ nome: 'Pessoa Ficticia', horas: 20, total: '1.000,00' }),
      linha({ nome: 'Outra Ficticia', cpf: '***.333.444-**', horas: 40, total: '3.000,00' }),
      linha({ nome: 'Mais Ficticia', cpf: '***.555.666-**', horas: 40, total: '4.000,00' }),
      linha({ nome: 'Quarta Ficticia', cpf: '***.777.888-**', horas: 40, total: '5.000,00' }),
      linha({ nome: 'Quinta Ficticia', cpf: '***.999.000-**', horas: 40, total: '6.000,00' }),
      totalDaPlanilha('20.000,00'),
    ]);

    const carga = lotePor(todos, 'siope_remuneracao_carga');
    expect(registroDe(carga, '4211702:municipal::magisterio:todos:profissionais:2025-05')?.valor).toBe('5');
    expect(registroDe(carga, '4211702:municipal::magisterio:todos:carga_horas:2025-05')?.valor).toBe('200');
  });

  it('homônimos com CPF diferente são duas pessoas', async () => {
    const todos = await lotes([
      linha({ nome: 'Pessoa Ficticia', total: '1,00' }),
      linha({ nome: 'Pessoa Ficticia', cpf: '***.999.888-**', total: '1,00' }),
      ...['A', 'B', 'C'].map((n, i) => linha({ nome: `Pessoa ${n}`, cpf: `***.00${i}.111-**`, total: '1,00' })),
      totalDaPlanilha('5,00'),
    ]);

    expect(
      registroDe(lotePor(todos, 'siope_remuneracao_carga'), '4211702:municipal::magisterio:todos:profissionais:2025-05')
        ?.valor,
    ).toBe('5');
  });

  it('a soma das linhas igual ao total da planilha entra na conferência', async () => {
    const todos = await lotes([...dezPessoas(), totalDaPlanilha('55.000,00')]);

    expect(lotePor(todos, 'siope_remuneracao').conferencia).toEqual([
      expect.objectContaining({ campo: 'total', fonte: '55000.00', calculado: '55000.00', diferenca: '0.00' }),
    ]);
  });

  it('um centavo de diferença do total da planilha falha', async () => {
    await expect(lotes([...dezPessoas(), totalDaPlanilha('55.000,01')])).rejects.toThrow(
      /a soma das linhas difere do total da planilha em -0\.01/,
    );
  });

  it('planilha sem a linha de total falha', async () => {
    await expect(lotes(dezPessoas())).rejects.toThrow(/sem a linha de total/);
  });

  it('o erro de total não leva nome nem CPF', async () => {
    const erro = await lotes([...dezPessoas(), totalDaPlanilha('1,00')]).catch((e: Error) => e.message);

    expect(erro).not.toMatch(/Ficticia|\*\*\*/);
  });

  it('categoria desconhecida falha sem repetir nome nem CPF', async () => {
    const arquivo = planilha([
      linha({ nome: 'Pessoa Ficticia', tipo: 'Outra coisa', total: '1,00' }),
      totalDaPlanilha('1,00'),
    ]);

    const erro = await resumirRemuneracao(arquivo).catch((e: Error) => e.message);

    expect(erro).toMatch(/categoria inesperada na linha 2/);
    expect(erro).not.toMatch(/Ficticia|\*\*\*/);
  });

  it('nenhum registro carrega nome, CPF ou escola', async () => {
    const todos = await lotes([...dezPessoas(), totalDaPlanilha('55.000,00')]);

    expect(JSON.stringify(todos.map((l) => l.registros))).not.toMatch(/Ficticia|\*\*\*|ESCOLA/);
  });

  it('mediana por 40 horas: quem trabalha 20 horas é dobrado', async () => {
    const todos = await lotes([
      ...Array.from({ length: 10 }, (_, i) =>
        linha({ nome: `Pessoa Ficticia ${i}`, cpf: `***.${100 + i}.222-**`, horas: 20, total: '1.000,00' }),
      ),
      totalDaPlanilha('10.000,00'),
    ]);

    expect(
      registroDe(lotePor(todos, 'siope_remuneracao'), '4211702:municipal:magisterio:todos:mediana_40h:2025-05')?.valor,
    ).toBe('2000.00');
  });

  it('com 10 pessoas sai a mediana; com 9, nula', async () => {
    const dez = await lotes([...dezPessoas(), totalDaPlanilha('55.000,00')]);
    const nove = await lotes([...dezPessoas().slice(0, 9), totalDaPlanilha('45.000,00')]);
    const id = '4211702:municipal:magisterio:efetivo:mediana_40h:2025-05';

    expect(registroDe(lotePor(dez, 'siope_remuneracao'), id)?.valor).toBe('5500.00');
    expect(registroDe(lotePor(nove, 'siope_remuneracao'), id)?.valor).toBeNull();
  });

  it('quem é efetivo e temporário no mesmo mês fica fora das duas medianas de vínculo, mas conta no geral', async () => {
    const todos = await lotes([
      ...dezPessoas(),
      linha({ nome: 'Pessoa Ficticia 0', cpf: '***.100.222-**', situacao: 'Temporário', horas: 20, total: '500,00' }),
      totalDaPlanilha('55.500,00'),
    ]);
    const carga = lotePor(todos, 'siope_remuneracao_carga');

    expect(registroDe(carga, '4211702:municipal::magisterio:efetivo:profissionais:2025-05')?.valor).toBe('9');
    expect(registroDe(carga, '4211702:municipal::magisterio:todos:profissionais:2025-05')?.valor).toBe('10');
  });

  it('carga temporária é a parte das horas de temporários', async () => {
    const todos = await lotes([
      linha({ nome: 'Pessoa A', cpf: '***.100.222-**', horas: 30, total: '1,00' }),
      linha({ nome: 'Pessoa B', cpf: '***.101.222-**', horas: 10, situacao: 'Temporário', total: '1,00' }),
      totalDaPlanilha('2,00'),
    ]);

    expect(
      registroDe(
        lotePor(todos, 'siope_remuneracao_carga'),
        '4211702:municipal::magisterio:temporario:carga_temporaria:2025-05',
      ),
    ).toMatchObject({
      valor: '25.0',
      unidade: '%',
    });
  });

  it('contagem de 1 a 4 sai como "menos de 5"; zero sai zero', async () => {
    const todos = await lotes([
      ...dezPessoas(),
      linha({ nome: 'Pessoa Medio', cpf: '***.500.222-**', categoria: NIVEL_MEDIO, total: '1,00' }),
      totalDaPlanilha('55.001,00'),
    ]);
    const carga = lotePor(todos, 'siope_remuneracao_carga');

    expect(registroDe(carga, '4211702:municipal::nivel_medio:formacao_magisterio:2025-05')).toMatchObject({
      valor: null,
      texto: 'menos de 5',
    });
    expect(registroDe(carga, '4211702:municipal::magisterio:temporario:profissionais:2025-05')).toMatchObject({
      valor: '0',
      texto: null,
    });
  });

  it('ano incompleto só traz a foto de maio, sem o total declarado; completo traz o total', async () => {
    const parcial = await lotes([...dezPessoas(), totalDaPlanilha('55.000,00')]);
    expect(idsDe(lotePor(parcial, 'siope_remuneracao'))).not.toContain('4211702:municipal::total_declarado:2025');

    const meses = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    const completo = await lotes([
      ...dezPessoas(),
      ...meses.map((mes) => linha({ nome: 'Pessoa Ficticia 0', cpf: '***.100.222-**', mes, total: '1,00' })),
      totalDaPlanilha('55.011,00'),
    ]);
    expect(registroDe(lotePor(completo, 'siope_remuneracao'), '4211702:municipal::total_declarado:2025')?.valor).toBe(
      '55011.00',
    );
  });
});

const COLUNAS_DE_2025 = ['1', '2', '3', '4', '5', '6'].map((b) => `"2025 - ${b}º bimestre"`).join(';');

const indicadores = (ano: number, linhas: string[]) => {
  const pasta = pastaTemporaria();
  const caminho = csv(pasta, `indicadores_municipal_${ano}.csv`, [
    `${BOM}"Código";"Indicador";${COLUNAS_DE_2025.replaceAll('2025', String(ano))}`,
    ...linhas,
  ]);
  return lotesDeIndicadores(caminho, ano);
};

const indicador = (codigo: string, sexto: string) => `"${codigo}";"Nome";"x";"x";"x";"x";"x";"${sexto}"`;

describe('lotesDeIndicadores', () => {
  it('lê o 6º bimestre e separa percentual de dinheiro em dois lotes', async () => {
    const lotes = await indicadores(2025, [indicador('1.1', '28,63%'), indicador('4.1', 'R$ 13.181,18')]);

    expect(lotes?.map((l) => l.chave)).toEqual(['siope_indicadores', 'siope_indicadores_valores']);
    expect(registroDe(lotes?.[0] as never, '4211702:municipal:::siope_indice_educacao:2025')?.valor).toBe('28.63');
    expect(registroDe(lotes?.[1] as never, '4211702:municipal::siope_por_aluno_infantil:2025')?.valor).toBe('13181.18');
  });

  it('"0,00%" vira nulo, salvo no 1.4', async () => {
    const lotes = await indicadores(2025, [
      indicador('1.1', '1,00%'),
      indicador('2.1', '0,00%'),
      indicador('1.4', '0,00%'),
    ]);
    const percentuais = lotes?.[0] as never;

    expect(registroDe(percentuais, '4211702:municipal:::siope_fundeb_em_infantil:2025')?.valor).toBeNull();
    expect(registroDe(percentuais, '4211702:municipal:::siope_fundeb_nao_aplicado:2025')?.valor).toBe('0.00');
  });

  it('exercício com o 6º bimestre zerado é parcial e não entra', async () => {
    expect(await indicadores(2026, [indicador('1.1', '0,00%'), indicador('4.1', 'R$ 0,00')])).toBeNull();
  });

  it('arquivo sem a coluna do 6º bimestre não entra', async () => {
    const pasta = pastaTemporaria();
    const caminho = csv(pasta, 'x.csv', ['"Código";"Indicador";"2026 - 3º bimestre"', '"1.1";"Nome";"24,49%"']);

    expect(await lotesDeIndicadores(caminho, 2026)).toBeNull();
  });

  it('educação básica de 2022 e 2023 não sai, porque o SIOPE não recomenda', async () => {
    const linhas = [indicador('1.1', '1,00%'), indicador('4.8', 'R$ 20.125,10'), indicador('4.1', 'R$ 1,00')];
    const de2023 = await indicadores(2023, linhas);
    const de2024 = await indicadores(2024, linhas);

    expect(idsDe(de2023?.[1] as never)).toEqual(['4211702:municipal::siope_por_aluno_infantil:2023']);
    expect(idsDe(de2024?.[1] as never)).toContain('4211702:municipal::siope_por_aluno_educacao_basica:2024');
  });

  it('o erro de formato não repete o conteúdo', async () => {
    await expect(indicadores(2025, [indicador('1.1', 'texto estranho')])).rejects.toThrow(
      /^percentual inesperado no indicador 1\.1$/,
    );
  });
});

const anexo = (extra: Partial<Anexo8Curado> = {}): Anexo8Curado => ({
  ano: 2024,
  receita_impostos: '1000.00',
  destinado_ao_fundeb: '150.00',
  resultado_liquido_fundeb: '20.00',
  educacao: { exigido: '250.00', aplicado: '266.40', pct: 26.64 },
  fundeb_remuneracao: { exigido: '70.00', aplicado: '85.22', pct: 85.22 },
  total_educacao: { dotacao: '400.00', liquidado: '300.00' },
  pessoal_ativo_liquidado: '100.00',
  capital: { empenhado: '10.00' },
  ...extra,
});

describe('loteDoAnexo8', () => {
  it('aplicado ÷ receita confere com o percentual, e a conta entra na conferência', () => {
    const lote = loteDoAnexo8(anexo());

    expect(lote.conferencia?.map((c) => [c.campo, c.fonte, c.calculado])).toEqual([
      ['indice_educacao', '26.64', '26.64'],
      ['fundeb_remuneracao', '85.22', '85.22'],
    ]);
    expect(registroDe(lote, '4211702:municipal::indice_educacao:2024')).toMatchObject({
      valor: '266.40',
      percentual: '26.64',
    });
    expect(registroDe(lote, '4211702:municipal:dotacao:gasto_total:2024')?.valor).toBe('400.00');
    expect(registroDe(lote, '4211702:municipal::fundeb_contribuicao:2024')?.valor).toBe('150.00');
  });

  it('percentual que não confere falha, dizendo os dois valores', () => {
    expect(() => loteDoAnexo8(anexo({ educacao: { exigido: '250.00', aplicado: '266.40', pct: 28.64 } }))).toThrow(
      /Anexo 8 de 2024: indice_educacao calcula 26\.64%, o PDF traz 28\.64%/,
    );
  });

  it('o Fundeb também é conferido', () => {
    const fundeb = { exigido: '70.00', aplicado: '85.22', pct: 90 };
    expect(() => loteDoAnexo8(anexo({ fundeb_remuneracao: fundeb }))).toThrow(/fundeb_remuneracao calcula 85\.22%/);
  });

  it('2020 não tem a receita: a base sai do exigido, e o mínimo do Fundeb não é conferido sem os valores', () => {
    const { receita_impostos: _r, destinado_ao_fundeb: _d, ...semReceita } = anexo();
    const lote = loteDoAnexo8({ ...semReceita, ano: 2020, fundeb_remuneracao: { pct: 80.66 } });

    expect(lote.conferencia?.map((c) => c.campo)).toEqual(['indice_educacao']);
    expect(registroDe(lote, '4211702:municipal::fundeb_remuneracao:2020')).toMatchObject({
      valor: null,
      percentual: '80.66',
    });
  });

  it('em 2020 o mínimo do Fundeb é 60%, e não 70%', () => {
    const lote = loteDoAnexo8(
      anexo({ ano: 2020, fundeb_remuneracao: { exigido: '60.00', aplicado: '80.66', pct: 80.66 } }),
    );

    expect(lote.conferencia?.find((c) => c.campo === 'fundeb_remuneracao')?.calculado).toBe('80.66');
  });
});

describe('caminho', () => {
  it('o nome do arquivo de indicadores fica no filtro, sem a pasta', async () => {
    const lotes = await indicadores(2025, [indicador('1.1', '1,00%')]);

    expect(lotes?.[0]?.filtro.arquivo).toBe(path.basename('indicadores_municipal_2025.csv'));
  });
});
