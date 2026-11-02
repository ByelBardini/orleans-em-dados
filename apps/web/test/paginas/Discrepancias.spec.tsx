import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import Discrepancias from '../../src/paginas/Discrepancias';
import {
  contaNaTela,
  despesas,
  despesasParciais,
  PROPS,
  receitas,
  receitasParciais,
  resumoDeEmpenhos,
  TEXTO_PROIBIDO,
} from '../support/conferidos';
import {
  caso,
  casoDeEmpenho,
  discrepancias,
  discrepanciasParciais,
  FORA_DO_ACUMULADO,
  grupo,
  SEM_EXECUCAO,
  semConferencia,
  TODOS_OS_GRUPOS,
} from '../support/discrepancias';
import { FetchFake } from '../support/fetch-fake';
import { conferenciaGravada } from '../support/respostas';

const NBSP = ' ';
const reais = (valor: string) => `R$${NBSP}${valor}`;

const FRASE_PERMITIDA =
  'Diferença entre fontes pode decorrer de critério, abrangência ou atualização, e não indica, por si só, erro nem irregularidade.';

const ENTIDADES = [
  { codigo: '319', nome: 'Fundo Municipal de Saúde', sigla: 'FMS' },
  { codigo: '2473', nome: 'SAMAE', sigla: 'SAMAE' },
];

// Casados 1.000,00 + só na Betha 20.300,00 = 21.300,00, o totalizador da 57140. Só no TCE-SC: 500,00.
const empenhos = (campos: Parameters<typeof resumoDeEmpenhos>[0] = {}) => {
  const resumo = resumoDeEmpenhos(campos);
  return {
    ...resumo,
    meta: {
      ...resumo.meta,
      conferencia: [
        { campo: 'valorEmpenho', titulo: 'Valor do empenho', fonte: 21300, calculado: 21300, diferenca: 0 },
      ],
    },
  };
};

type Respostas = {
  secao?: unknown;
  receita?: unknown;
  despesa?: unknown;
  empenho?: unknown;
  conferencia?: unknown;
  entidade?: string;
};

function instalar({
  secao = discrepancias(),
  receita = receitas(),
  despesa = despesas(),
  empenho = empenhos(),
  conferencia = conferenciaGravada(),
  entidade = '',
}: Respostas = {}) {
  return new FetchFake()
    .responder('/api/discrepancias?ano=2025', secao)
    .responder(`/api/receitas?ano=2025&entidade=${entidade}`, receita)
    .responder(`/api/despesas/resumo?ano=2025&entidade=${entidade}`, despesa)
    .responder(`/api/despesas/empenhos/resumo?ano=2025&entidade=${entidade}`, empenho)
    .responder('/api/conferencias?ano=2025', conferencia)
    .instalar();
}

const abrir = async (respostas: Respostas = {}) => {
  const fake = instalar(respostas);
  const entidade = respostas.entidade ?? '';
  const { container } = render(
    <Discrepancias {...PROPS} entidade={entidade} filtros={{ ...PROPS.filtros, entidades: ENTIDADES, entidade }} />,
  );
  await screen.findByRole('heading', { level: 1 });
  return { container, fake };
};

const grupoNaTela = (rotulo: string) => screen.getByRole('region', { name: rotulo });
const linhaDo = (rotulo: string) => within(grupoNaTela(rotulo)).getAllByRole('row')[1] as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe('Discrepancias: os grupos', () => {
  it.each(TODOS_OS_GRUPOS.map((g) => [g.rotulo, g.total] as const))(
    'o grupo "%s" aparece separado, com o total da resposta',
    async (rotulo, total) => {
      await abrir();

      const esperado = reais(total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
      expect(within(grupoNaTela(rotulo)).getByTestId('total-do-grupo')).toHaveTextContent(esperado);
    },
  );

  it('o total do grupo é o da resposta, e não uma soma feita na tela', async () => {
    await abrir({
      secao: discrepancias({ grupos: [{ ...FORA_DO_ACUMULADO, total: 777.77 }] }),
    });

    expect(within(grupoNaTela('Lançamento fora do acumulado')).getByTestId('total-do-grupo')).toHaveTextContent(
      reais('777,77'),
    );
  });

  it('o grupo traz a explicação da resposta', async () => {
    await abrir();

    expect(within(grupoNaTela('Só no TCE-SC')).getByText('Explicação de Só no TCE-SC (exemplo).')).toBeInTheDocument();
  });

  it('as áreas ficam separadas: receita, despesa e empenhos têm títulos próprios', async () => {
    await abrir();

    const receita = screen.getByRole('heading', { level: 2, name: 'Receita' }).closest('section') as HTMLElement;
    expect(within(receita).getByText('Lançamento fora do acumulado')).toBeInTheDocument();
    expect(within(receita).queryByText('Registro repetido')).not.toBeInTheDocument();
    const emp = screen.getByRole('heading', { level: 2, name: 'Empenhos' }).closest('section') as HTMLElement;
    expect(within(emp).getByText('Registro repetido')).toBeInTheDocument();
    expect(within(emp).queryByText('Despesa de consórcio em duas linhas')).not.toBeInTheDocument();
  });

  it('grupo sem casos não aparece', async () => {
    await abrir({
      secao: discrepancias({
        grupos: [FORA_DO_ACUMULADO, grupo('so_tce', 'Grupo vazio (exemplo)', 0, [])],
      }),
    });

    expect(screen.queryByText('Grupo vazio (exemplo)')).not.toBeInTheDocument();
    expect(screen.getByText('Lançamento fora do acumulado')).toBeInTheDocument();
  });

  it('área sem grupo não deixa título solto', async () => {
    await abrir({ secao: discrepancias({ grupos: [FORA_DO_ACUMULADO] }) });

    await screen.findByRole('heading', { name: 'Os totais, para conferir' });
    expect(screen.queryByRole('heading', { level: 2, name: 'Empenhos' })).not.toBeInTheDocument();
  });

  it('grupo grande mostra dez casos e abre o resto em "ver todos", sem mudar o total', async () => {
    const itens = Array.from({ length: 12 }, (_, i) =>
      casoDeEmpenho({ numero: 100 + i, id: `id-${i}`, betha: 10, diferenca: 10, valor: 10 }),
    );
    await abrir({ secao: discrepancias({ grupos: [grupo('empenho_ausente', 'Muitos (exemplo)', 120, itens)] }) });
    const secao = grupoNaTela('Muitos (exemplo)');
    expect(within(secao).getAllByRole('row')).toHaveLength(11);
    expect(within(secao).queryByText(/nº 110/)).not.toBeInTheDocument();

    await userEvent.click(within(secao).getByRole('button', { name: 'Ver todos os 12' }));

    expect(within(secao).getAllByRole('row')).toHaveLength(13);
    expect(within(secao).getByText(/nº 111/)).toBeInTheDocument();
    expect(within(secao).getByTestId('total-do-grupo')).toHaveTextContent(reais('120,00'));
    expect(within(secao).queryByRole('button')).not.toBeInTheDocument();
  });

  it('grupo de até dez casos não tem o botão', async () => {
    await abrir();

    expect(within(grupoNaTela('Registro repetido')).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Discrepancias: cada caso', () => {
  it('receita: entidade, natureza, mês, os dois valores e o lado que registra mais', async () => {
    await abrir();

    const linha = linhaDo('Lançamento fora do acumulado');
    expect(linha).toHaveTextContent('17135011 · FMS');
    expect(linha).toHaveTextContent('Convênio da saúde (exemplo)');
    expect(linha).not.toHaveTextContent('Principal');
    expect(linha).toHaveTextContent('maio');
    expect(linha).toHaveTextContent(reais('1.300,00'));
    expect(linha).toHaveTextContent(reais('1.000,00'));
    expect(linha).toHaveTextContent(`${reais('300,00')} a mais na Betha`);
    expect(linha).toHaveTextContent('Nota do caso (exemplo).');
  });

  it('caso em vários meses lista os meses', async () => {
    await abrir();

    expect(linhaDo('Só no TCE-SC')).toHaveTextContent('janeiro e fevereiro');
  });

  it('caso em mais de três meses abrevia os nomes, sem omitir nenhum', async () => {
    const meses = [1, 2, 3, 12].map((mes) => ({ mes, betha: 10, tce: 5, diferenca: 5 }));
    await abrir({
      secao: discrepancias({ grupos: [grupo('fora_do_acumulado', 'Quatro (exemplo)', 300, [caso({ meses })])] }),
    });

    expect(linhaDo('Quatro (exemplo)')).toHaveTextContent('jan, fev, mar e dez');
  });

  it('diferença do TCE-SC diz o lado, nunca o sinal', async () => {
    const { container } = await abrir();

    expect(linhaDo('Só no TCE-SC')).toHaveTextContent(`${reais('428,37')} a mais no TCE`);
    expect(container.textContent).not.toMatch(/[-−]\s*R\$/);
  });

  it('empenho: número, data, a fonte em que está e o valor do lado dela', async () => {
    await abrir();

    const linha = linhaDo('Registro sem execução e sem par no TCE-SC');
    expect(linha).toHaveTextContent('Empenho nº 340 · SAMAE');
    expect(linha).toHaveTextContent('só na Betha');
    expect(linha).toHaveTextContent('01/04/2025');
    expect(linha).toHaveTextContent(`${reais('20.000,00')} a mais na Betha`);
    const so = linhaDo('Empenho só no TCE-SC');
    expect(so).toHaveTextContent('só no TCE-SC');
    expect(so).toHaveTextContent(`${reais('500,00')} a mais no TCE`);
  });

  it('despesa: mostra o que difere em cada etapa', async () => {
    await abrir();

    const linha = linhaDo('Despesa de consórcio em duas linhas');
    expect(linha).toHaveTextContent('Despesa orçamentária · SAMAE');
    expect(linha).toHaveTextContent(`liquidado ${reais('100,00')}`);
    expect(linha).toHaveTextContent(`pago ${reais('150,00')}`);
  });

  it('natureza dividida em dois grupos diz de quanto é a diferença inteira', async () => {
    await abrir({
      secao: discrepancias({
        grupos: [grupo('fora_do_acumulado', 'Parte (exemplo)', 300, [caso({ diferencaDaNatureza: 320.5 })])],
      }),
    });

    expect(linhaDo('Parte (exemplo)')).toHaveTextContent(`parte dos ${reais('320,50')} da natureza`);
  });

  it('valor em meses diferentes não diz lado: a soma do ano é igual', async () => {
    await abrir({
      secao: discrepancias({
        grupos: [
          grupo('mes_diferente', 'Mesmo valor em meses diferentes', 80, [
            caso({ diferenca: 0, diferencaBetha: 80, diferencaTce: 80, valor: 80 }),
          ]),
        ],
      }),
    });

    const linha = linhaDo('Mesmo valor em meses diferentes');
    expect(linha).toHaveTextContent(`${reais('80,00')} em meses diferentes`);
    expect(linha).not.toHaveTextContent('a mais');
  });

  it('evidência da conferência à mão aparece junto da nota', async () => {
    await abrir();

    expect(linhaDo('Mesmo valor em duas rubricas')).toHaveTextContent('Só um exemplo foi conferido à mão (exemplo).');
  });
});

describe('Discrepancias: selo de situação', () => {
  it('confirmado no portal diz a data', async () => {
    await abrir();

    expect(linhaDo('Lançamento fora do acumulado')).toHaveTextContent('Confirmado no portal em 01/11/2026');
  });

  it('"Confirmado no portal" só aparece nos casos confirmados', async () => {
    await abrir();

    expect(screen.getAllByText(/Confirmado no portal/)).toHaveLength(2);
    expect(linhaDo('Mesmo valor em duas rubricas')).not.toHaveTextContent('Confirmado no portal');
    expect(linhaDo('Registro repetido')).not.toHaveTextContent('Confirmado no portal');
    expect(linhaDo('Despesa de consórcio em duas linhas')).not.toHaveTextContent('Confirmado no portal');
  });

  it('confirmado em parte não diz que confirmou o valor inteiro', async () => {
    await abrir();

    expect(linhaDo('Mesmo valor em duas rubricas')).toHaveTextContent('Confirmado em parte');
  });

  it('calculado diz que é provável', async () => {
    await abrir();

    expect(linhaDo('Registro repetido')).toHaveTextContent('Calculado (provável)');
  });

  it('o valor que mudou depois da conferência sai como "Rever"', async () => {
    await abrir();

    expect(linhaDo('Despesa de consórcio em duas linhas')).toHaveTextContent('Rever');
  });

  it('o protocolo aparece só no caso que tem', async () => {
    await abrir();

    expect(linhaDo('Só no TCE-SC')).toHaveTextContent('Protocolo e-SIC 999/2026');
    expect(screen.getAllByText(/Protocolo/)).toHaveLength(1);
  });
});

describe('Discrepancias: a abertura', () => {
  it('diz o que é a seção e quantos casos há', async () => {
    await abrir();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Em 2025, 8 casos em que Betha e TCE-SC não coincidem.',
    );
    expect(screen.getByText(/cada valor que ficou fora do número principal/)).toBeInTheDocument();
  });

  it('diz que diferença entre fontes não indica, por si só, um problema, na frase combinada', async () => {
    await abrir();

    expect(screen.getByText(new RegExp(FRASE_PERMITIDA.replace(/[.,]/g, '.')))).toBeInTheDocument();
  });

  it('a conta da receita fecha, lida da tela', async () => {
    await abrir();

    const conta = await screen.findByRole('group', { name: 'A conta da receita' });
    const { parcelas, total } = contaNaTela(conta);
    expect(parcelas).toEqual([120000050, 870000030]);
    expect(total).toBe(990000080);
  });

  it('a conta da despesa fecha, lida da tela', async () => {
    await abrir();

    const conta = await screen.findByRole('group', { name: 'A conta da despesa' });
    const { parcelas, total } = contaNaTela(conta);
    expect(parcelas).toEqual([1079165253, 12388732]);
    expect(total).toBe(1091553985);
  });

  it('a conta dos empenhos fecha com o totalizador, e o que só o TCE-SC tem fica fora', async () => {
    await abrir();

    const conta = await screen.findByRole('group', { name: 'A conta dos empenhos' });
    const { parcelas, total } = contaNaTela(conta);
    expect(parcelas).toEqual([100000, 2030000]);
    expect(total).toBe(2130000);
    expect(conta).toHaveTextContent(`Só o TCE-SC registra mais ${reais('500,00')}, fora desta conta.`);
  });

  it('são três contas, uma por área, sem nenhum total que some as áreas', async () => {
    await abrir();
    await screen.findByRole('group', { name: 'A conta dos empenhos' });

    expect(screen.getAllByRole('group', { name: /^A conta d/ })).toHaveLength(3);
    // Receita 9.900.000,80 + despesa 10.915.539,85 + empenhos 21.300,00.
    expect(document.body.textContent).not.toContain('20.836.840,65');
  });

  it('a conta não aponta para a própria seção', async () => {
    await abrir();

    const conta = await screen.findByRole('group', { name: 'A conta da receita' });
    expect(within(conta).queryByRole('link')).not.toBeInTheDocument();
  });

  it('avisa que a soma dos grupos, em módulo, pode não repetir a conta', async () => {
    await abrir();
    await screen.findByRole('group', { name: 'A conta da receita' });

    expect(screen.getByText(/cada grupo soma os casos sem sinal/)).toBeInTheDocument();
  });

  it('ano em curso: receita com o que aguarda; despesa sem conta, dizendo por quê', async () => {
    await abrir({ secao: discrepanciasParciais(), receita: receitasParciais(), despesa: despesasParciais() });

    const conta = await screen.findByRole('group', { name: 'A conta da receita' });
    const { parcelas, total } = contaNaTela(conta);
    expect(parcelas).toEqual([120000050, 30000025, 40000010]);
    expect(total).toBe(190000085);
    expect(screen.queryByRole('group', { name: 'A conta da despesa' })).not.toBeInTheDocument();
    expect(screen.getByText(/No ano em curso, a despesa não tem esta conta/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Até setembro de 2025');
  });

  it('sem nenhum caso, a manchete diz que as fontes mostram os mesmos números', async () => {
    await abrir({ secao: discrepancias({ grupos: [] }) });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Em 2025, Betha e TCE-SC mostram os mesmos números.',
    );
  });
});

describe('Discrepancias: aguardando o TCE-SC', () => {
  const pendencia = () => screen.getByRole('region', { name: 'Aguardando o TCE-SC' });

  it('vem à parte dos grupos, com os totais da resposta e sem somar receita com despesa', async () => {
    await abrir({ secao: discrepanciasParciais() });

    expect(pendencia()).toHaveTextContent(`Receita: ${reais('400.000,10')}`);
    expect(pendencia()).toHaveTextContent(`Empenhos: ${reais('14.233.097,48')} em 956 empenhos`);
    expect(pendencia()).toHaveTextContent('Prefeitura · outubro');
    expect(pendencia()).not.toHaveTextContent('14.633.097,58');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('8 casos');
  });

  it('não usa palavra de problema nem selo de situação', async () => {
    await abrir({ secao: discrepanciasParciais() });

    expect(pendencia().textContent).not.toMatch(/problema|diverg|discrep|falha|\berros?\b|irregular|suspeit/i);
    expect(within(pendencia()).queryByText(/Calculado/)).not.toBeInTheDocument();
  });

  it('sem nada aguardando, o bloco não aparece', async () => {
    await abrir();

    expect(screen.queryByRole('region', { name: 'Aguardando o TCE-SC' })).not.toBeInTheDocument();
  });
});

describe('Discrepancias: texto e dados que não saem', () => {
  it('nenhum termo proibido; "erro" e "irregularidade" só na frase permitida', async () => {
    const { container } = await abrir({ secao: discrepanciasParciais() });
    await screen.findByRole('heading', { name: 'Os totais, para conferir' });

    const texto = container.textContent ?? '';
    expect(texto).toContain(FRASE_PERMITIDA);
    expect(texto.replace(FRASE_PERMITIDA, '')).not.toMatch(TEXTO_PROIBIDO);
  });

  it('sem coluna de credor nem de histórico', async () => {
    const { container } = await abrir();
    await screen.findByRole('heading', { name: 'Os totais, para conferir' });

    expect(container.textContent).not.toMatch(/credor|histórico/i);
  });

  // O contrato é estrito: se a API vazar o nome, a página recusa a resposta inteira, em vez de mostrar.
  it('resposta com credor é recusada, e o nome não chega à tela', async () => {
    const secao = discrepancias({ grupos: [] });
    const comCredor = {
      ...secao,
      grupos: [{ ...FORA_DO_ACUMULADO, itens: [{ ...FORA_DO_ACUMULADO.itens[0], credor: 'NOME DE PESSOA' }] }],
    };
    instalar({ secao: comCredor });

    render(<Discrepancias {...PROPS} />);

    expect(await screen.findByText(/Não foi possível carregar: Resposta inesperada/)).toBeInTheDocument();
    expect(screen.queryByText(/NOME DE PESSOA/)).not.toBeInTheDocument();
  });
});

describe('Discrepancias: ano sem conferência', () => {
  it('explica o que falta, sem número nenhum, e não pede a comparação', async () => {
    const { container, fake } = await abrir({ secao: semConferencia() });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ainda não dá para conferir 2025.');
    expect(container).toHaveTextContent('Falta publicar: receitas do TCE-SC, empenhos do TCE-SC.');
    expect(container.textContent).not.toMatch(/R\$/);
    expect(fake.pedidos).toEqual(['/api/discrepancias?ano=2025']);
  });

  it('continua com o filtro de ano, para sair dali', async () => {
    await abrir({ secao: semConferencia() });

    expect(screen.getByLabelText('Ano')).toHaveValue('2025');
  });

  it('erro da API aparece, sem número, e com o filtro de ano', async () => {
    new FetchFake()
      .responder('/api/discrepancias?ano=2025', { erro: 'Sem dados de receitas para 2025' }, 404)
      .instalar();

    const { container } = render(<Discrepancias {...PROPS} />);

    expect(await screen.findByText('Não foi possível carregar: Sem dados de receitas para 2025')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/R\$/);
    expect(screen.getByLabelText('Ano')).toHaveValue('2025');
  });

  it('enquanto carrega, avisa', () => {
    const fake = instalar();
    fake.segurar = true;

    render(<Discrepancias {...PROPS} />);

    expect(screen.getByText('Carregando os números…')).toBeInTheDocument();
  });
});

describe('Discrepancias: filtro de entidade do App', () => {
  const dois = discrepancias({
    grupos: [
      grupo('fora_do_acumulado', 'Dois (exemplo)', 500, [
        caso({ id: 'a', valor: 100, diferenca: 100, natureza: '11111111' }),
        caso({ id: 'b', valor: 150.1, diferenca: 150.1, natureza: '22222222' }),
        caso({ entidade: 'SAMAE', codigoEntidade: '2473', valor: 249.9, diferenca: 249.9, natureza: '33333333' }),
      ]),
      SEM_EXECUCAO,
    ],
  });

  it('mostra só os casos da entidade, com o total deles, e o grupo sem casos dela some', async () => {
    await abrir({ secao: dois, entidade: '319' });

    const secao = grupoNaTela('Dois (exemplo)');
    expect(within(secao).getAllByRole('row')).toHaveLength(3);
    expect(within(secao).queryByText('33333333')).not.toBeInTheDocument();
    expect(within(secao).getByTestId('total-do-grupo')).toHaveTextContent(reais('250,10'));
    expect(screen.queryByText('Registro sem execução e sem par no TCE-SC')).not.toBeInTheDocument();
  });

  it('a manchete conta só os casos da entidade', async () => {
    await abrir({ secao: dois, entidade: '319' });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Em 2025, 2 casos');
  });

  it('as contas pedem à API o recorte da entidade', async () => {
    const { fake } = await abrir({ secao: dois, entidade: '319' });
    await screen.findByRole('group', { name: 'A conta da receita' });

    expect(fake.pedidos).toContain('/api/receitas?ano=2025&entidade=319');
    expect(fake.pedidos).toContain('/api/despesas/resumo?ano=2025&entidade=319');
    expect(fake.pedidos).toContain('/api/despesas/empenhos/resumo?ano=2025&entidade=319');
  });

  it('os empenhos da entidade somam na conta, sem o totalizador do município', async () => {
    await abrir({ secao: dois, entidade: '2473' });

    const conta = await screen.findByRole('group', { name: 'A conta dos empenhos' });
    const { parcelas, total } = contaNaTela(conta);
    expect(parcelas).toEqual([100000, 2000000]);
    expect(total).toBe(2100000);
  });

  it('o aguardando fica só com o da entidade', async () => {
    await abrir({
      secao: discrepanciasParciais(),
      receita: receitasParciais(),
      despesa: despesasParciais(),
      entidade: '728',
    });

    const pendencia = screen.getByRole('region', { name: 'Aguardando o TCE-SC' });
    expect(pendencia).toHaveTextContent(`Receita: ${reais('300.000,10')}`);
    expect(pendencia).not.toHaveTextContent('Empenhos:');
  });

  it('os totais ficam só com a entidade', async () => {
    await abrir({ secao: dois, entidade: '319' });

    const receita = (await screen.findByRole('heading', { name: 'Receita arrecadada por entidade' })).closest(
      'section',
    ) as HTMLElement;
    expect(within(receita).getByText('FMS')).toBeInTheDocument();
    expect(within(receita).queryByText('Prefeitura')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Câmara Municipal' })).not.toBeInTheDocument();
  });

  it('o filtro aparece na página, para quem chega com ele ligado poder soltar', async () => {
    await abrir({ secao: dois, entidade: '319' });

    expect(screen.getByRole('button', { name: 'FMS' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Discrepancias: os totais, para conferir', () => {
  const secao = async (titulo: string) =>
    (await screen.findByRole('heading', { name: titulo })).closest('section') as HTMLElement;

  it('vêm abaixo dos grupos', async () => {
    await abrir();

    const totais = await screen.findByRole('heading', { name: 'Os totais, para conferir' });
    const ultimo = grupoNaTela('Empenho só no TCE-SC');
    expect(ultimo.compareDocumentPosition(totais) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('o total por entidade fica neutro, mesmo diferente, e diz qual fonte registra mais', async () => {
    await abrir();

    const linha = within(await secao('Receita arrecadada por entidade'))
      .getByText('FMS')
      .closest('tr') as HTMLElement;
    expect(linha).toHaveTextContent(`${reais('50.000,00')} a mais na Betha`);
    expect(linha.querySelector('.vermelho')).toBeNull();
  });

  it('o mês fica neutro e lista as rubricas que formam a diferença', async () => {
    await abrir();

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
    await abrir({
      conferencia: conferenciaGravada({
        receitaPorMes: [{ mes: 2, betha: 7000, tce: 1000, diferenca: 6000, parcelas }],
      }),
    });

    const meses = await secao('Receita mês a mês');
    expect(within(meses).getByText(/FMS 4 \(1 mil\)/)).toBeInTheDocument();
    expect(within(meses).queryByText(/FMS 5 \(1 mil\)/)).not.toBeInTheDocument();
    expect(meses).toHaveTextContent('· e mais 2');
  });

  it('com o filtro, o mês soma só as rubricas da entidade', async () => {
    const parcelas = [
      { mes: 2, ent: '319', entidade: 'FMS', natureza: '1', diferenca: 1000.1 },
      { mes: 2, ent: '2473', entidade: 'SAMAE', natureza: '2', diferenca: 2000 },
    ];
    await abrir({
      entidade: '319',
      conferencia: conferenciaGravada({
        receitaPorMes: [{ mes: 2, betha: 4000, tce: 1000, diferenca: 3000.1, parcelas }],
      }),
    });

    const meses = await secao('Receita mês a mês');
    expect(meses).toHaveTextContent(`${reais('1.000,10')} a mais na Betha`);
    expect(meses).not.toHaveTextContent('SAMAE');
  });

  it('a Câmara vem à parte, dizendo que só o TCE-SC a publica', async () => {
    await abrir();

    expect(await screen.findByRole('heading', { name: 'Câmara Municipal' })).toBeInTheDocument();
    expect(screen.getByText(/A Câmara não está no portal Betha da Prefeitura/)).toBeInTheDocument();
  });

  it('no exercício parcial, avisa até onde o TCE-SC tem dados', async () => {
    await abrir({ secao: discrepanciasParciais() });

    expect(screen.getByText(/O TCE-SC recebe os dados com atraso/)).toHaveTextContent('receitas até setembro');
  });

  it('as coletas comparadas ficam registradas', async () => {
    await abrir();

    expect(await screen.findByText(/Coletas comparadas/)).toBeInTheDocument();
  });

  it('se a comparação falhar, os grupos continuam e o erro aparece', async () => {
    await abrir({ conferencia: {} });

    expect(await screen.findByText(/Não foi possível carregar: Resposta inesperada/)).toBeInTheDocument();
    expect(screen.getByText('Lançamento fora do acumulado')).toBeInTheDocument();
  });
});

describe('Discrepancias: no App', () => {
  const ANOS = {
    anos: [2025],
    exemplo: false,
    atualizadoEm: { 2025: '2025-03-01T12:00:00.000Z' },
    entidades: ENTIDADES,
  };

  beforeEach(() => {
    window.location.hash = '';
    vi.stubGlobal('scrollTo', () => {});
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });

  it.each(['#discrepancias', '#conferencia'])('%s abre a seção', async (hash) => {
    instalar().responder('/api/anos', ANOS);
    window.location.hash = hash;

    render(<App />);

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('8 casos');
    expect(screen.getByRole('link', { name: 'Discrepâncias' })).toHaveAttribute('aria-current', 'page');
    expect(document.title).toBe('Discrepâncias · Orleans em Dados');
  });

  it('a aba não se chama mais "Conferência"', async () => {
    instalar().responder('/api/anos', ANOS);
    window.location.hash = '#discrepancias';

    render(<App />);
    await screen.findByRole('heading', { level: 1 });

    expect(screen.queryByRole('link', { name: 'Conferência' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Onde as fontes divergem' })).toHaveAttribute('href', '#discrepancias');
  });
});
