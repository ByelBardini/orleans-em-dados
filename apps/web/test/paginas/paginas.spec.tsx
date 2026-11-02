import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Conferencia from '../../src/paginas/Conferencia';
import Despesas from '../../src/paginas/Despesas';
import Metodologia from '../../src/paginas/Metodologia';
import Receitas from '../../src/paginas/Receitas';
import VisaoGeral from '../../src/paginas/VisaoGeral';
import { FetchFake } from '../support/fetch-fake';
import {
  ANO,
  conferenciaGravada,
  empenhoSemParDaConferencia,
  FILTROS,
  respostaGravada,
  ROTAS,
  rubricaDaConferencia,
} from '../support/respostas';

const props = { ano: ANO, entidade: '', filtros: FILTROS };
const ANO_CORRENTE = new Date().getUTCFullYear();

const RECEITAS = respostaGravada('api_receitas_ano_2025');
const EMPENHOS_RESUMO = respostaGravada('api_despesas_empenhos_resumo_ano_2025');
const DESPESAS = respostaGravada('api_despesas_resumo_ano_2025');
const CONFERENCIA = conferenciaGravada();
const BUSCA = respostaGravada('api_despesas_empenhos_ano_2025');

const SEM_DADOS = { erro: 'Sem dados de receitas para 2025' };

/** A API das fixtures: tudo respondendo, para o spec trocar só o que importa. */
const IMPORTACOES_ATRASADAS = {
  importadores: [
    {
      id: 'betha',
      ultimaExecucao: null,
      exercicios: [{ ano: ANO_CORRENTE, atualizadoEm: '2000-01-01T03:00:00.000Z' }],
    },
  ],
};

function apiCompleta() {
  const consultas = (ano: number) =>
    [
      [`/api/receitas?ano=${ano}&entidade=`, RECEITAS],
      [`/api/despesas/empenhos/resumo?ano=${ano}&entidade=`, EMPENHOS_RESUMO],
      [`/api/despesas/resumo?ano=${ano}&entidade=`, DESPESAS],
      [`/api/conferencias?ano=${ano}`, CONFERENCIA],
    ] as const;
  const fake = new FetchFake();
  for (const [caminho, corpo] of consultas(ANO_CORRENTE)) fake.responder(caminho, corpo);
  return fake
    .responder(ROTAS.receitas, RECEITAS)
    .responder(ROTAS.empenhosResumo, EMPENHOS_RESUMO)
    .responder(ROTAS.despesas, DESPESAS)
    .responder(ROTAS.conferencia, CONFERENCIA)
    .responder(ROTAS.busca(), BUSCA);
}

beforeEach(() => {
  vi.stubGlobal('scrollTo', () => {});
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => vi.unstubAllGlobals());

describe('VisaoGeral', () => {
  it('enquanto carrega, avisa e não mostra número', () => {
    const fake = apiCompleta().instalar();
    fake.segurar = true;

    render(<VisaoGeral {...props} />);

    expect(screen.getByText('Carregando os números…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('a manchete diz quanto o município arrecadou e empenhou, pela despesa oficial', async () => {
    apiCompleta().instalar();

    render(<VisaoGeral {...props} />);

    const manchete = await screen.findByRole('heading', { level: 1 });
    // A fixture gravada é parcial: o TCE-SC vai até fevereiro.
    expect(manchete).toHaveTextContent(
      'Até fevereiro de 2025, Orleans arrecadou R$ 1,9 milhões e, até 05/02, empenhou R$ 0,2 milhões em despesas.',
    );
  });

  it('o total de empenhado é o da despesa orçamentária, não a soma dos empenhos originais', async () => {
    const oficial = { ...DESPESAS, totais: { ...DESPESAS.totais, empenhado: 5_000_000 } };
    apiCompleta().responder(ROTAS.despesas, oficial).instalar();

    render(<VisaoGeral {...props} />);

    const totais = await screen.findByRole('region', { name: 'Totais do ano' });
    expect(within(totais).getByText('Empenhado até 05/02/2025').parentElement).toHaveTextContent('5,0 mi');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('empenhou R$ 5,0 milhões');
  });

  it('a Câmara aparece à parte, com a fonte TCE-SC', async () => {
    apiCompleta().instalar();

    render(<VisaoGeral {...props} />);

    expect(await screen.findByText(/A Câmara Municipal fica à parte/)).toHaveTextContent('dados do TCE-SC');
    expect(screen.getByText('Câmara Municipal de Orleans')).toBeInTheDocument();
  });

  it('ano sem coleta mostra o erro da API, sem manchete', async () => {
    apiCompleta().responder(ROTAS.receitas, SEM_DADOS, 404).instalar();

    render(<VisaoGeral {...props} />);

    expect(await screen.findByText('Não foi possível carregar: Sem dados de receitas para 2025')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('resposta fora do contrato vira erro na tela, não número errado', async () => {
    apiCompleta()
      .responder(ROTAS.receitas, { ...RECEITAS, totais: { arrecadadoNoMes: 'muito' } })
      .instalar();

    render(<VisaoGeral {...props} />);

    expect(await screen.findByText(/Resposta inesperada de \/api\/receitas/)).toBeInTheDocument();
  });

  it('dado atrasado aparece ao lado do selo da conferência, não no lugar dele', async () => {
    apiCompleta().responder('/api/importacoes', IMPORTACOES_ATRASADAS).instalar();

    render(<VisaoGeral {...props} ano={ANO_CORRENTE} />);

    expect(await screen.findAllByText('Dado atrasado')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Ver discrepâncias →' }).length).toBeGreaterThan(0);
  });

  it('cada conjunto de números mostra de onde veio', async () => {
    apiCompleta().instalar();

    render(<VisaoGeral {...props} />);

    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByText(/Fonte: Portal da Transparência Betha/)).toHaveLength(3);
  });

  it('a entidade escolhida entra na frase e nos pedidos', async () => {
    const fake = new FetchFake()
      .responder('/api/receitas?ano=2025&entidade=319', respostaGravada('api_receitas_ano_2025_entidade_319'))
      .responder(
        '/api/despesas/empenhos/resumo?ano=2025&entidade=319',
        respostaGravada('api_despesas_empenhos_resumo_ano_2025_entidade_319'),
      )
      .responder('/api/despesas/resumo?ano=2025&entidade=319', DESPESAS)
      .responder(ROTAS.conferencia, CONFERENCIA)
      .instalar();

    render(<VisaoGeral {...props} entidade="319" />);

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Até fevereiro de 2025, o Fundo Municipal de Saúde',
    );
    expect(fake.pedidos).toContain('/api/receitas?ano=2025&entidade=319');
  });
});

describe('Receitas', () => {
  it('dado atrasado aparece junto do total arrecadado', async () => {
    apiCompleta().responder('/api/importacoes', IMPORTACOES_ATRASADAS).instalar();

    render(<Receitas {...props} ano={ANO_CORRENTE} />);

    expect(await screen.findByText('Dado atrasado')).toBeInTheDocument();
  });

  it('a manchete compara com o previsto', async () => {
    apiCompleta().instalar();

    render(<Receitas {...props} />);

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /Até fevereiro de 2025, Orleans arrecadou .*% do que o orçamento/,
    );
  });

  it('sem previsão publicada, a manchete fala só do arrecadado', async () => {
    const semPrevisao = {
      ...RECEITAS,
      totais: { ...RECEITAS.totais, orcadoAtualizado: 0 },
    };
    apiCompleta().responder(ROTAS.receitas, semPrevisao).instalar();

    render(<Receitas {...props} />);

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Até fevereiro de 2025, Orleans arrecadou R$ 1,9 milhões.',
    );
    expect(screen.getByText(/Não há previsão de receita publicada/)).toBeInTheDocument();
  });

  it('a busca filtra sem diferenciar acento, e por código', async () => {
    apiCompleta().instalar();
    render(<Receitas {...props} />);
    const campo = await screen.findByLabelText('Buscar receita');

    await userEvent.type(campo, 'transferencia');

    expect(screen.getByText('1 de 3 naturezas · R$ milhões')).toBeInTheDocument();
    expect(screen.queryByText('IPTU (exemplo)')).not.toBeInTheDocument();

    await userEvent.clear(campo);
    await userEvent.type(campo, '11125');

    expect(within(screen.getByRole('table')).getByText('IPTU (exemplo)')).toBeInTheDocument();
  });

  it('o CSV baixa o recorte da tela', async () => {
    apiCompleta().instalar();

    render(<Receitas {...props} />);

    expect(await screen.findByRole('link', { name: 'Baixar CSV ↓' })).toHaveAttribute(
      'href',
      '/api/receitas.csv?ano=2025&entidade=',
    );
  });

  it('dado de exemplo mostra a fonte fictícia', async () => {
    const exemplo = { ...RECEITAS, meta: { ...RECEITAS.meta, fonte: 'DADOS FICTÍCIOS — exemplo', exemplo: true } };
    apiCompleta().responder(ROTAS.receitas, exemplo).instalar();

    render(<Receitas {...props} />);

    expect(await screen.findByText(/DADOS FICTÍCIOS/)).toBeInTheDocument();
  });

  it('erro da API aparece, sem tabela', async () => {
    apiCompleta().responder(ROTAS.receitas, SEM_DADOS, 404).instalar();

    render(<Receitas {...props} />);

    expect(await screen.findByText(/Não foi possível carregar/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('Despesas', () => {
  const carregar = async (fake = apiCompleta().instalar()) => {
    render(<Despesas {...props} />);
    await screen.findByRole('heading', { level: 1 });
    await screen.findByRole('columnheader', { name: 'Situação' });
    return fake;
  };
  const listaDeEmpenhos = () => screen.getByRole('columnheader', { name: 'Situação' }).closest('table') as HTMLElement;

  it('dado atrasado aparece junto do total empenhado', async () => {
    apiCompleta().responder('/api/importacoes', IMPORTACOES_ATRASADAS).instalar();

    render(<Despesas {...props} ano={ANO_CORRENTE} />);

    expect(await screen.findByText('Dado atrasado')).toBeInTheDocument();
  });

  it('a manchete diz quanto de cada R$ 100 já foi pago', async () => {
    await carregar();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Até 05/02, de cada R$ 100 reservados para despesas',
    );
  });

  // A resposta gravada já vem com a execução do TCE-SC: o liquidado nulo é escrito aqui.
  it.each([
    ['liquidado nulo', { liquidado: null, pago: null, saldoAPagar: null }, 'Sem liquidação'],
    ['liquidado zero', { liquidado: 0, pago: 0, saldoAPagar: 0 }, 'Sem liquidação'],
    ['liquidado e saldo zero', { liquidado: 100, pago: 100, saldoAPagar: 0 }, 'Pago'],
    ['saldo maior que zero', { liquidado: 100, pago: 40, saldoAPagar: 60 }, 'Falta pagar'],
    ['saldo nulo', { liquidado: 100, pago: 100, saldoAPagar: null }, '—'],
  ])('com %s, a linha da lista diz a situação da mesma regra da API', async (_nome, valores, esperado) => {
    const lista = {
      ...BUSCA,
      itens: BUSCA.itens.map((e: { numero: number }) => (e.numero === 5 ? { ...e, ...valores } : e)),
    };
    await carregar(apiCompleta().responder(ROTAS.busca(), lista).instalar());

    const linha = within(listaDeEmpenhos())
      .getByText(/^Exames/)
      .closest('tr') as HTMLElement;
    expect(linha.lastElementChild).toHaveTextContent(esperado);
  });

  it('o filtro de situação diz "Sem liquidação", e não fala em falta de informação', async () => {
    await carregar();

    expect(within(screen.getByLabelText('Situação')).getByRole('option', { name: 'Sem liquidação' })).toHaveValue(
      'sem',
    );
  });

  it('buscar pede a lista filtrada, depois da pausa de digitação', async () => {
    const fake = apiCompleta().responder(ROTAS.busca('merenda'), BUSCA).instalar();
    await carregar(fake);

    await userEvent.type(screen.getByLabelText('Buscar'), 'merenda');

    await waitFor(() => expect(fake.pedidos).toContain(ROTAS.busca('merenda')));
    expect(fake.pedidos).not.toContain(ROTAS.busca('m'));
  });

  it('trocar a situação pede a lista filtrada', async () => {
    const fake = apiCompleta()
      .responder(ROTAS.busca('', '', 'sem'), BUSCA)
      .instalar();
    await carregar(fake);

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'sem');

    await waitFor(() => expect(fake.pedidos).toContain(ROTAS.busca('', '', 'sem')));
  });

  it('avançar pede a página seguinte, e um filtro novo volta à primeira', async () => {
    const muitos = { ...BUSCA, total: 60 };
    const fake = apiCompleta()
      .responder(ROTAS.busca(), muitos)
      .responder(ROTAS.busca('', '', '', 25), muitos)
      .responder(ROTAS.busca('', '', 'pago'), muitos)
      .instalar();
    await carregar(fake);

    await userEvent.click(await screen.findByRole('button', { name: /Próxima/ }));
    await waitFor(() => expect(fake.pedidos).toContain(ROTAS.busca('', '', '', 25)));

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'pago');

    await waitFor(() => expect(fake.pedidos).toContain(ROTAS.busca('', '', 'pago', 0)));
  });

  it('clicar num órgão filtra a lista por ele', async () => {
    const fake = apiCompleta().responder(ROTAS.busca('', 'SECRETARIA+MUNICIPAL+DE+OBRAS'), BUSCA).instalar();
    await carregar(fake);

    await userEvent.click(screen.getAllByRole('button', { name: 'Secretaria Municipal de Obras' })[0] as HTMLElement);

    await waitFor(() => expect(fake.pedidos).toContain(ROTAS.busca('', 'SECRETARIA+MUNICIPAL+DE+OBRAS')));
  });

  it('erro da API aparece, sem a lista', async () => {
    apiCompleta().responder(ROTAS.empenhosResumo, SEM_DADOS, 404).instalar();

    render(<Despesas {...props} />);

    expect(await screen.findByText(/Não foi possível carregar/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('Conferencia', () => {
  it('enquanto carrega, avisa', () => {
    const fake = apiCompleta().instalar();
    fake.segurar = true;

    render(<Conferencia {...props} />);

    expect(screen.getByText('Carregando os números…')).toBeInTheDocument();
  });

  it('no exercício parcial, avisa até onde o TCE-SC tem dados', async () => {
    apiCompleta().instalar();

    render(<Conferencia {...props} />);

    expect(await screen.findByText(/O TCE-SC recebe os dados com atraso/)).toHaveTextContent('receitas até fevereiro');
  });

  it('a diferença é informação: a página diz que não é, por si, erro ou irregularidade', async () => {
    apiCompleta().instalar();

    render(<Conferencia {...props} />);

    expect(await screen.findByText(/Diferença entre fontes não é, por si, erro ou irregularidade/)).toBeInTheDocument();
  });

  it('a diferença aparece com o lado maior, sem sinal', async () => {
    apiCompleta().instalar();

    render(<Conferencia {...props} />);

    expect(await screen.findAllByText('a mais na Betha')).not.toHaveLength(0);
  });

  describe('foco no que não tem explicação', () => {
    const secao = async (titulo: string) =>
      (await screen.findByRole('heading', { name: titulo })).closest('section') as HTMLElement;
    const abrir = (campos: Parameters<typeof conferenciaGravada>[0]) => {
      apiCompleta().responder(ROTAS.conferencia, conferenciaGravada(campos)).instalar();
      render(<Conferencia {...props} />);
    };
    const resumo = (campos: Partial<ReturnType<typeof conferenciaGravada>['resumo']>) => ({
      ...CONFERENCIA.resumo,
      ...campos,
    });
    const RUBRICA_ABERTA = rubricaDaConferencia({ nota: 'Nenhum padrão aponta a causa.' });
    const ITEM_RECEITA = { onde: 'receita', titulo: 'Rubrica 11125011', ...RUBRICA_ABERTA } as const;
    const itemDeEmpenho = (campos: Parameters<typeof empenhoSemParDaConferencia>[0]) => {
      const e = empenhoSemParDaConferencia(campos);
      const lado = e.valor ?? 0;
      return {
        onde: 'empenho',
        titulo: `Empenho nº ${e.numero}`,
        ...e,
        betha: e.fonte === 'betha' ? e.valor : null,
        tce: e.fonte === 'tce' ? e.valor : null,
        diferenca: e.fonte === 'betha' ? lado : -lado,
      } as const;
    };

    it('item sem explicação aparece em destaque, em vermelho, com o lado maior e a nota', async () => {
      abrir({ semExplicacao: [ITEM_RECEITA], resumo: resumo({ semExplicacao: 1 }) });

      const destaque = await secao('O que ainda não tem explicação');
      const linha = within(destaque).getByText('11125011').closest('tr') as HTMLElement;
      expect(linha).toHaveTextContent('R$ 1.200,00 a mais na Betha');
      expect(within(linha).getByText('IPTU (exemplo)')).toBeInTheDocument();
      expect(within(linha).getByText('Nenhum padrão aponta a causa.')).toBeInTheDocument();
      expect(linha.querySelector('td.num .vermelho')).toHaveTextContent('R$ 1.200,00');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Até fevereiro de 2025, 1 diferença entre Betha e TCE-SC ainda não tem explicação.',
      );
    });

    it('despesa sem explicação aparece no destaque pelo título, com os dois valores', async () => {
      const item = {
        onde: 'despesa',
        entidade: 'FMS',
        codigoEntidade: '319',
        titulo: 'Despesa orçamentária (57170)',
        betha: 300,
        tce: 400,
        diferenca: -100,
        nota: 'A consulta não desce ao empenho.',
      } as const;
      abrir({ semExplicacao: [item], resumo: resumo({ semExplicacao: 1 }) });

      const destaque = await secao('O que ainda não tem explicação');
      const linha = within(destaque)
        .getByText(/Despesa orçamentária \(57170\)/)
        .closest('tr') as HTMLElement;
      expect(linha).toHaveTextContent('R$ 100,00 a mais no TCE');
      expect(linha).toHaveTextContent('Betha R$ 300,00 · TCE R$ 400,00');
    });

    it('empenhos sem explicação da mesma entidade e fonte viram uma linha, com a diferença somada', async () => {
      const itens = [
        itemDeEmpenho({ id: 'a', numero: 1, valor: 0.1 }),
        itemDeEmpenho({ id: 'b', numero: 2, valor: 0.2 }),
        itemDeEmpenho({ id: 'c', numero: 3, valor: 5, fonte: 'tce' }),
      ];
      abrir({ semExplicacao: itens, resumo: resumo({ semExplicacao: 3 }) });

      const destaque = await secao('O que ainda não tem explicação');
      const betha = within(destaque)
        .getByText(/2 empenhos · Prefeitura/)
        .closest('tr') as HTMLElement;
      expect(betha).toHaveTextContent('só na Betha');
      expect(betha).toHaveTextContent('R$ 0,30 a mais na Betha');
      expect(within(betha).getByText('Ver os 2 empenhos')).toBeInTheDocument();
      const tce = within(destaque)
        .getByText(/1 empenho · Prefeitura/)
        .closest('tr') as HTMLElement;
      expect(tce).toHaveTextContent('R$ 5,00 a mais no TCE');
    });

    it('o resumo soma o valor em aberto sem sinal, com os dois lados positivos', async () => {
      const itens = [itemDeEmpenho({ id: 'a', valor: 0.1 }), itemDeEmpenho({ id: 'b', valor: 0.2, fonte: 'tce' })];
      abrir({ semExplicacao: itens, resumo: resumo({ semExplicacao: 2 }) });

      expect(await screen.findByText('R$ 0,30 em diferenças')).toBeInTheDocument();
    });

    it('rubrica conhecida fica em cinza nas já conhecidas, nunca no destaque', async () => {
      const conhecida = rubricaDaConferencia({
        causa: 'Conhecida e recorrente',
        conhecida: true,
        recorrenteEm: [2024, 2025],
        nota: 'Diverge do mesmo lado em 2024 e 2025.',
      });
      abrir({ receitaPorNatureza: [conhecida], empenhosSemPar: [], resumo: resumo({ conhecidas: 1 }) });

      const destaque = await secao('O que ainda não tem explicação');
      expect(within(destaque).queryByText('11125011')).not.toBeInTheDocument();
      const item = within(await secao('Já conhecidas'))
        .getByText('11125011')
        .closest('li') as HTMLElement;
      expect(item).toHaveTextContent('Conhecida e recorrente');
      expect(item).toHaveTextContent('Diverge do mesmo lado em 2024 e 2025.');
      expect(item.querySelector('.vermelho')).toBeNull();
    });

    it('as recorrentes vêm antes das que têm causa provável', async () => {
      abrir({
        receitaPorNatureza: [
          rubricaDaConferencia({ natureza: '1', causa: 'Possível duplicidade', explicada: true }),
          rubricaDaConferencia({ natureza: '2', causa: 'Conhecida e recorrente', conhecida: true }),
        ],
        empenhosSemPar: [],
      });

      const itens = within(await secao('Já conhecidas')).getAllByRole('listitem');
      expect(itens[0]).toHaveTextContent('Conhecida e recorrente');
      expect(itens[1]).toHaveTextContent('Possível duplicidade');
    });

    it('rubrica em aberto não entra nas já conhecidas', async () => {
      abrir({ receitaPorNatureza: [RUBRICA_ABERTA], empenhosSemPar: [], semExplicacao: [ITEM_RECEITA] });

      await secao('O que ainda não tem explicação');
      expect(screen.queryByRole('heading', { name: 'Já conhecidas' })).not.toBeInTheDocument();
    });

    it('lançamento fora do acumulado mantém a causa e a nota da conferência', async () => {
      abrir({});

      const item = within(await secao('Já conhecidas'))
        .getByText('17135011')
        .closest('li') as HTMLElement;
      expect(item).toHaveTextContent('Lançamento fora do acumulado');
      expect(item).toHaveTextContent('o arrecadado no mês não fecha com o acumulado da rubrica em fevereiro');
    });

    it('ano sem nada em aberto diz que nada ficou sem explicação, sem vermelho no resumo', async () => {
      abrir({});

      const destaque = await secao('O que ainda não tem explicação');
      expect(within(destaque).getByText(/^Nenhuma\. Toda diferença entre as fontes/)).toBeInTheDocument();
      expect(within(destaque).queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Até fevereiro de 2025, não há diferença nova entre Betha e TCE-SC',
      );
      expect(screen.getByText('nenhuma diferença em aberto').parentElement?.querySelector('.vermelho')).toBeNull();
    });

    it('sem diferença nenhuma, a manchete diz que as fontes mostram os mesmos números', async () => {
      abrir({
        parcial: false,
        receitaPorNatureza: [],
        empenhosSemPar: [],
        resumo: resumo({ comCausaProvavel: 0, conhecidas: 0 }),
      });

      expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
        'Em 2025, Betha e TCE-SC mostram os mesmos números.',
      );
    });

    it('o total por entidade fica neutro, mesmo diferente, e diz qual fonte registra mais', async () => {
      abrir({});

      const linha = within(await secao('Receita arrecadada por entidade'))
        .getByText('FMS')
        .closest('tr') as HTMLElement;
      expect(linha).toHaveTextContent('R$ 50.000,00 a mais na Betha');
      expect(linha.querySelector('.vermelho')).toBeNull();
    });

    it('o mês fica neutro e lista as rubricas que formam a diferença', async () => {
      abrir({});

      const meses = await secao('Receita mês a mês');
      expect(within(meses).getByText(/FMS 17135011 \(50 mil\)/)).toBeInTheDocument();
      expect(meses.querySelector('.vermelho')).toBeNull();
    });

    it('mês com mais de quatro rubricas mostra as quatro primeiras e conta o resto', async () => {
      const parcelas = ['1', '2', '3', '4', '5', '6'].map((natureza) => ({
        mes: 2,
        ent: '319',
        entidade: 'FMS',
        natureza,
        diferenca: 1000,
      }));
      abrir({ receitaPorMes: [{ mes: 2, betha: 7000, tce: 1000, diferenca: 6000, parcelas }] });

      const meses = await secao('Receita mês a mês');
      expect(within(meses).getByText(/FMS 4 \(1 mil\)/)).toBeInTheDocument();
      expect(within(meses).queryByText(/FMS 5 \(1 mil\)/)).not.toBeInTheDocument();
      expect(meses).toHaveTextContent('· e mais 2');
    });

    it('renumeração nos dois lados fica uma linha por fonte, sem somar os lados', async () => {
      abrir({
        empenhosSemPar: [
          empenhoSemParDaConferencia({
            id: 'b',
            numero: 12,
            numeroNaOutra: 112,
            valor: 7000,
            causa: 'Provável renumeração',
            explicada: true,
          }),
          empenhoSemParDaConferencia({
            id: 't',
            fonte: 'tce',
            numero: 112,
            numeroNaOutra: 12,
            valor: 7000,
            causa: 'Provável renumeração',
            explicada: true,
          }),
        ],
      });

      const conhecidas = await secao('Já conhecidas');
      const betha = within(conhecidas)
        .getByText(/só na Betha/)
        .closest('li') as HTMLElement;
      expect(betha).toHaveTextContent('1 empenho · Prefeitura — R$ 7.000,00 só na Betha.');
      expect(betha).toHaveTextContent('no TCE é o nº 112');
      expect(betha).toHaveTextContent('Ficam fora das somas das outras páginas.');
      const tce = within(conhecidas)
        .getByText(/só no TCE/)
        .closest('li') as HTMLElement;
      expect(tce).toHaveTextContent('1 empenho · Prefeitura — R$ 7.000,00 só no TCE.');
      expect(tce).toHaveTextContent('na Betha é o nº 12');
      expect(tce).not.toHaveTextContent('Ficam fora das somas');
    });

    it('o registro repetido nomeia a fonte em que se repete', async () => {
      abrir({
        empenhosSemPar: [
          empenhoSemParDaConferencia({
            id: 't',
            fonte: 'tce',
            ocorrencia: 2,
            causa: 'Registro repetido',
            explicada: true,
          }),
        ],
      });

      expect(await secao('Já conhecidas')).toHaveTextContent(
        'Mesmo número, data e valor de outro empenho do próprio TCE.',
      );
    });
  });

  it('sem as duas fontes, explica o que falta e como coletar', async () => {
    apiCompleta()
      .responder(
        ROTAS.conferencia,
        { erro: 'Sem as duas fontes publicadas para 2025', faltando: ['tcesc_empenhos'] },
        404,
      )
      .instalar();

    render(<Conferencia {...props} />);

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Ainda não dá para conferir 2025.');
    expect(screen.getByText('pnpm importar tcesc --ano 2025')).toBeInTheDocument();
  });
});

describe('Metodologia', () => {
  it('explica de onde vêm os dados, sem pedir nada à API', () => {
    const fake = new FetchFake().instalar();

    render(<Metodologia />);

    expect(screen.getByRole('heading', { name: 'De onde vêm os dados' })).toBeInTheDocument();
    expect(fake.pedidos).toEqual([]);
  });
});
