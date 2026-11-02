import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Conferencia from '../../src/paginas/Conferencia';
import Despesas from '../../src/paginas/Despesas';
import Metodologia from '../../src/paginas/Metodologia';
import Receitas from '../../src/paginas/Receitas';
import VisaoGeral from '../../src/paginas/VisaoGeral';
import { FetchFake } from '../support/fetch-fake';
import { ANO, FILTROS, respostaGravada, ROTAS } from '../support/respostas';

const props = { ano: ANO, entidade: '', filtros: FILTROS };
const ANO_CORRENTE = new Date().getUTCFullYear();

const RECEITAS = respostaGravada('api_receitas_ano_2025');
const EMPENHOS_RESUMO = respostaGravada('api_despesas_empenhos_resumo_ano_2025');
const DESPESAS = respostaGravada('api_despesas_resumo_ano_2025');
const CONFERENCIA = respostaGravada('api_conferencias_ano_2025');
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
    expect(manchete).toHaveTextContent(
      'Em 2025, Orleans arrecadou R$ 1,9 milhões e empenhou R$ 0,2 milhões em despesas.',
    );
  });

  it('o total de empenhado é o da despesa orçamentária, não a soma dos empenhos originais', async () => {
    const oficial = { ...DESPESAS, totais: { ...DESPESAS.totais, empenhado: 5_000_000 } };
    apiCompleta().responder(ROTAS.despesas, oficial).instalar();

    render(<VisaoGeral {...props} />);

    const totais = await screen.findByRole('region', { name: 'Totais do ano' });
    expect(within(totais).getByText('Empenhado').parentElement).toHaveTextContent('5,0 mi');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('empenhou R$ 5,0 milhões');
  });

  it('a Câmara aparece à parte, com a fonte TCE-SC', async () => {
    apiCompleta().instalar();

    render(<VisaoGeral {...props} />);

    expect(await screen.findByText(/Com a Câmara Municipal/)).toHaveTextContent('dados do TCE-SC');
    expect(screen.getByText('Câmara Municipal de Orleans')).toBeInTheDocument();
  });

  it('o selo da conferência vai junto do número', async () => {
    apiCompleta().instalar();

    render(<VisaoGeral {...props} />);

    expect(await screen.findByText(/Difere do TCE-SC/)).toBeInTheDocument();
  });

  it('sem conferência disponível, os números aparecem sem selo', async () => {
    apiCompleta().responder(ROTAS.conferencia, { erro: 'Sem as duas fontes' }, 404).instalar();

    render(<VisaoGeral {...props} />);

    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/Difere do TCE-SC/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Confere com o TCE-SC/)).not.toBeInTheDocument();
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
    expect(screen.getAllByRole('link', { name: 'Ver conferência →' }).length).toBeGreaterThan(0);
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

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Em 2025, o Fundo Municipal de Saúde');
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
      /Orleans arrecadou .*% do que o orçamento/,
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
      'Orleans arrecadou R$ 1,9 milhões em 2025.',
    );
    expect(screen.getByText(/Não há previsão de receita publicada/)).toBeInTheDocument();
  });

  it('a rubrica com diferença traz o selo na linha da tabela', async () => {
    apiCompleta().instalar();

    render(<Receitas {...props} />);

    const linha = (await screen.findByText('Transferência SUS (exemplo)')).closest('tr') as HTMLElement;
    expect(within(linha).getByText(/Difere do TCE-SC/)).toBeInTheDocument();
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
    await screen.findByRole('table');
    return fake;
  };

  it('dado atrasado aparece junto do total empenhado', async () => {
    apiCompleta().responder('/api/importacoes', IMPORTACOES_ATRASADAS).instalar();

    render(<Despesas {...props} ano={ANO_CORRENTE} />);

    expect(await screen.findByText('Dado atrasado')).toBeInTheDocument();
  });

  it('a manchete diz quanto de cada R$ 100 já foi pago', async () => {
    await carregar();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('De cada R$ 100 reservados para despesas');
  });

  it('a lista mostra a situação de cada empenho, sem tratar falta de informação como zero', async () => {
    await carregar();

    const semLiquidacao = within(screen.getByRole('table'))
      .getByText(/^Exames/)
      .closest('tr') as HTMLElement;
    expect(within(semLiquidacao).getByText('Sem informação')).toBeInTheDocument();
  });

  it('empenho que não consta no TCE-SC traz o selo na linha', async () => {
    await carregar();

    const linha = within(screen.getByRole('table'))
      .getByText(/^Drenagem/)
      .closest('tr') as HTMLElement;
    expect(within(linha).getByText('Não consta no TCE-SC')).toBeInTheDocument();
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

  it('o empenho renumerado traz a nota da conferência', async () => {
    apiCompleta().instalar();

    render(<Conferencia {...props} />);

    expect(
      await screen.findAllByText('Na outra fonte, o empenho com esta data e valor é o nº 112: provável renumeração.'),
    ).not.toHaveLength(0);
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
