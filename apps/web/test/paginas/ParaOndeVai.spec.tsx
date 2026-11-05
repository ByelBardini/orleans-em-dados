import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ParaOndeVai from '../../src/paginas/ParaOndeVai';
import { TEXTO_PROIBIDO } from '../support/conferidos';
import { FetchFake } from '../support/fetch-fake';
import { anoDaSerie, funcoes, funcoesComDiferenca, SERIE_PADRAO, serie } from '../support/funcoes';

const NBSP = ' ';
const CONFERIDO = 'conferido com o TCE-SC';
const FONTE_UNICA = 'fonte única, sem conferência';
const CONFERIDO_COM_BETHA = 'conferido com a Betha';

afterEach(() => vi.unstubAllGlobals());

function instalar({ ano2025 = funcoes(), anos = SERIE_PADRAO } = {}) {
  return new FetchFake()
    .responder('/api/funcoes/serie', serie(anos))
    .responder('/api/funcoes?ano=2025', ano2025)
    .responder('/api/funcoes?ano=2024', funcoes({ ano: 2024 }))
    .responder('/api/funcoes?ano=2018', funcoes({ ano: 2018, conferencia: 'sem_tce' }))
    .instalar();
}

const abrir = async (opcoes: Parameters<typeof instalar>[0] = {}) => {
  const fake = instalar(opcoes);
  const { container } = render(<ParaOndeVai />);
  await screen.findByRole('heading', { level: 1 });
  return { container, fake };
};

const tabela = () => screen.getByRole('table', { name: 'Valor por função' });
const linhaDa = (nome: string | RegExp) =>
  within(tabela()).getByRole('rowheader', { name: nome }).closest('tr') as HTMLElement;
const linhaDoTotal = () => linhaDa(/Total, sem a Câmara/);
const regua = () => screen.getByRole('img', { name: /Divisão do total/ });
const manchete = () => screen.getByRole('heading', { level: 1 });

// Oito funções, para a régua e o divisor da tabela: as seis maiores somam 92,5%.
const COM_PEQUENAS = () => {
  const base = funcoes().funcoes[0]!;
  const f = (codigo: string, nome: string, participacao: number, empenhado: number) => ({
    ...base,
    codigo,
    nome,
    empenhado,
    participacao: { ...base.participacao, empenhado: participacao },
    subfuncoes: [],
  });
  return funcoes({
    funcoes: [
      f('10', 'Saúde', 30, 300000),
      f('12', 'Educação', 25, 250000),
      f('26', 'Transporte', 15, 150000),
      f('04', 'Administração', 12, 120000),
      f('17', 'Saneamento', 8, 80000),
      f('15', 'Urbanismo', 5, 50000),
      f('08', 'Assistência Social', 4.5, 45000),
      f('16', 'Habitação', 0.5, 34630.74),
    ],
  });
};

describe('Para onde vai: manchete', () => {
  it('com as duas maiores acima da metade, diz "mais da metade" e o total da etapa', async () => {
    await abrir();

    expect(manchete()).toHaveTextContent(
      'Saúde e transporte levaram mais da metade dos R$ 1,0 milhões empenhados em 2025.',
    );
  });

  it('com as duas maiores até a metade, diz o percentual', async () => {
    const base = funcoes().funcoes[0]!;
    const f = (codigo: string, nome: string, empenhado: number) => ({
      ...base,
      codigo,
      nome,
      participacao: { ...base.participacao, empenhado },
      empenhado,
    });
    await abrir({
      ano2025: funcoes({ funcoes: [f('10', 'Saúde', 30), f('12', 'Educação', 20), f('26', 'Transporte', 19)] }),
    });

    expect(manchete()).toHaveTextContent('Saúde e educação levaram 50% dos');
  });

  it('acompanha a etapa escolhida', async () => {
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Pago' }));

    expect(manchete()).toHaveTextContent('dos R$ 0,5 milhões pagos em 2025');
  });
});

describe('Para onde vai: selo da Educação', () => {
  const comEducacao = (conferenciaEducacao: 'conferido' | 'diferenca' | 'sem_betha') => ({
    ano2025: { ...COM_PEQUENAS(), conferenciaEducacao },
  });

  it('conferida, a linha da função 12 leva "conferido com a Betha", e nenhuma outra leva', async () => {
    await abrir(comEducacao('conferido'));

    expect(linhaDa(/Educação/)).toHaveTextContent(CONFERIDO_COM_BETHA);
    expect(linhaDa(/Saúde/)).not.toHaveTextContent(CONFERIDO_COM_BETHA);
    expect(linhaDa(/Transporte/)).not.toHaveTextContent(CONFERIDO_COM_BETHA);
    expect(linhaDoTotal()).not.toHaveTextContent(CONFERIDO_COM_BETHA);
  });

  it('conferida a Educação, a divisão segue fonte única no título da seção', async () => {
    await abrir(comEducacao('conferido'));

    const cabecalho = screen.getByRole('heading', { name: 'Para onde foi o dinheiro' }).parentElement as HTMLElement;

    expect(within(cabecalho).getByRole('button', { name: FONTE_UNICA })).toBeInTheDocument();
  });

  it.each(['diferenca', 'sem_betha'] as const)(
    'com %s, a linha da função 12 fica sem o selo da Betha',
    async (estado) => {
      await abrir(comEducacao(estado));

      expect(linhaDa(/Educação/)).not.toHaveTextContent(CONFERIDO_COM_BETHA);
    },
  );

  it('total conferido com o TCE-SC não confere a Educação: sem a Betha, a linha fica sem selo', async () => {
    await abrir({ ano2025: { ...COM_PEQUENAS(), conferencia: 'conferido', conferenciaEducacao: 'sem_betha' } });

    expect(linhaDoTotal()).toHaveTextContent(CONFERIDO);
    expect(linhaDa(/Educação/)).not.toHaveTextContent(CONFERIDO_COM_BETHA);
  });
});

describe('Para onde vai: selos por nível', () => {
  it('total leva "conferido com o TCE-SC", e nenhuma função leva', async () => {
    await abrir();

    expect(linhaDoTotal()).toHaveTextContent(CONFERIDO);
    expect(linhaDa(/Saúde/)).not.toHaveTextContent(CONFERIDO);
  });

  it('a divisão por função diz, no título da seção, que é fonte única', async () => {
    await abrir();

    const cabecalho = screen.getByRole('heading', { name: 'Para onde foi o dinheiro' }).parentElement as HTMLElement;

    expect(within(cabecalho).getByRole('button', { name: FONTE_UNICA })).toBeInTheDocument();
  });

  it('ano sem TCE-SC leva fonte única no total', async () => {
    await abrir({ ano2025: funcoes({ conferencia: 'sem_tce' }) });

    expect(linhaDoTotal()).toHaveTextContent(FONTE_UNICA);
    expect(linhaDoTotal()).not.toHaveTextContent(CONFERIDO);
  });

  it('ano com diferença fica sem selo de conferido, com a diferença e o link para Discrepâncias', async () => {
    await abrir({ ano2025: funcoesComDiferenca() });

    expect(linhaDoTotal()).not.toHaveTextContent(CONFERIDO);
    const aviso = screen.getByText(/o SICONFI registra/).closest('p') as HTMLElement;
    expect(aviso).toHaveTextContent(`No pago, o SICONFI registra R$${NBSP}1.000,00 a mais que o TCE-SC`);
    expect(within(aviso).getByRole('link', { name: 'Ver em Discrepâncias' })).toHaveAttribute('href', '#discrepancias');
  });
});

describe('Para onde vai: etapas', () => {
  it('abre no empenhado, com o valor, a participação e o por morador de cada função', async () => {
    await abrir();

    expect(linhaDa(/Saúde/)).toHaveTextContent('0,6');
    expect(linhaDa(/Saúde/)).toHaveTextContent('60%');
    expect(linhaDa(/Saúde/)).toHaveTextContent(`R$${NBSP}24,31`);
    expect(linhaDoTotal()).toHaveTextContent('1,0');
  });

  it('alternar para pago troca os valores, sem somar uma etapa à outra', async () => {
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Pago' }));

    expect(linhaDoTotal()).toHaveTextContent('0,5');
    expect(linhaDa(/Saúde/)).toHaveTextContent('0,3');
    expect(linhaDoTotal()).not.toHaveTextContent('2,3');
  });

  it('as funções ficam em ordem pelo valor da etapa escolhida', async () => {
    await abrir();

    const nomes = within(tabela())
      .getAllByRole('rowheader')
      .map((l) => l.textContent);

    expect(nomes[0]).toContain('Saúde');
    expect(nomes[1]).toContain('Estradas e transporte');
  });

  it('valor abaixo de R$ 0,05 milhão diz "< 0,1", e não zero', async () => {
    await abrir({ ano2025: COM_PEQUENAS() });

    expect(linhaDa(/Moradia/)).toHaveTextContent('< 0,1');
  });
});

describe('Para onde vai: régua', () => {
  it('diz a divisão em texto, com as seis maiores e as outras', async () => {
    await abrir({ ano2025: COM_PEQUENAS() });

    expect(regua()).toHaveAccessibleName(
      'Divisão do total: Saúde 30%, Educação 25%, Transporte 15%, Administração 12%, Saneamento 8%, Urbanismo 5%, Outras 2 funções 5%',
    );
  });

  it('escreve o nome e o percentual só nas faixas que têm espaço', async () => {
    await abrir({ ano2025: COM_PEQUENAS() });

    expect(regua()).toHaveTextContent('Saúde 30%');
    expect(regua()).toHaveTextContent('Saneam. 8%');
    expect(regua()).not.toHaveTextContent('Urbanismo');
  });

  it('cada faixa diz o nome e o percentual ao passar o mouse', async () => {
    await abrir({ ano2025: COM_PEQUENAS() });

    expect(regua().querySelector('[title="Urbanismo: 5%"]')).not.toBeNull();
  });
});

describe('Para onde vai: tabela', () => {
  it('função com nome do dia a dia traz o nome oficial embaixo', async () => {
    await abrir();

    const nome = within(tabela()).getByRole('rowheader', { name: /Estradas e transporte/ });

    expect(nome).toHaveTextContent('Transporte');
  });

  it('função sem nome do dia a dia não repete o nome', async () => {
    await abrir();

    expect(within(tabela()).getByRole('rowheader', { name: 'Saúde' })).toBeInTheDocument();
  });

  it('abrir uma função mostra as subfunções, incluindo "Demais subfunções"', async () => {
    await abrir();
    const botao = screen.getByRole('button', { name: 'Ver subfunções de Estradas e transporte' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Demais subfunções')).not.toBeInTheDocument();

    await userEvent.click(botao);

    const fechar = screen.getByRole('button', { name: 'Fechar subfunções de Estradas e transporte' });
    expect(fechar).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Transporte Rodoviário')).toBeInTheDocument();
    expect(screen.getByText('Demais subfunções')).toBeInTheDocument();
  });

  it('abrir outra função fecha a anterior', async () => {
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Ver subfunções de Estradas e transporte' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ver subfunções de Saúde' }));

    expect(screen.queryByText('Transporte Rodoviário')).not.toBeInTheDocument();
    expect(screen.getByText('Atenção Básica')).toBeInTheDocument();
  });

  it('funções abaixo de 1% ficam sob um divisor', async () => {
    await abrir({ ano2025: COM_PEQUENAS() });

    expect(screen.getByText('Menos de 1% do total cada')).toBeInTheDocument();
  });

  it('sem função abaixo de 1%, não há divisor', async () => {
    await abrir();

    expect(screen.queryByText('Menos de 1% do total cada')).not.toBeInTheDocument();
  });
});

describe('Para onde vai: por morador e Câmara', () => {
  it('por morador diz a conta e o divisor', async () => {
    await abrir();

    const bloco = screen.getByText('Por morador', { selector: '.rotulo' }).parentElement as HTMLElement;

    expect(bloco).toHaveTextContent(`R$${NBSP}40,51`);
    expect(bloco).toHaveTextContent('÷ 24.686 moradores (IBGE, estimativa 2025)');
  });

  it('sem população, não há "por morador"', async () => {
    const base = funcoes();
    const semPopulacao = funcoes({
      divisor: null,
      porMorador: null,
      funcoes: base.funcoes.map((f) => ({ ...f, porMorador: null })),
    });
    await abrir({ ano2025: semPopulacao });

    expect(document.body).not.toHaveTextContent(/por morador/i);
  });

  it('a Legislativa fica à parte, com a frase de que não entra no total', async () => {
    await abrir();

    const camara = screen.getByRole('region', { name: 'Câmara Municipal, fora do total' });
    expect(camara).toHaveTextContent('Não entra no total');
    expect(camara).toHaveTextContent(`R$${NBSP}70.000,00`);
    expect(within(tabela()).queryByText(/Legislativa/)).not.toBeInTheDocument();
  });
});

describe('Para onde vai: exercício', () => {
  it('seletor próprio só com anos encerrados, e o texto diz quando o ano corrente entra', async () => {
    const corrente = new Date().getFullYear();
    await abrir({ anos: [...SERIE_PADRAO, anoDaSerie(corrente, 'sem_tce', 50)] });

    const opcoes = within(screen.getByLabelText('Exercício')).getAllByRole('option');
    expect(opcoes.map((o) => o.textContent)).not.toContain(String(corrente));
    expect(opcoes.map((o) => o.textContent)).toEqual(['2025', '2024', '2018']);
    expect(screen.getByText(new RegExp(`${corrente} entra com a DCA, até 30/04/${corrente + 1}`))).toBeInTheDocument();
  });

  it('trocar o exercício pede o ano escolhido', async () => {
    const { fake } = await abrir();

    await userEvent.selectOptions(screen.getByLabelText('Exercício'), '2024');

    expect(fake.pedidos).toContain('/api/funcoes?ano=2024');
  });

  it('o filtro de entidade não se aplica, e a página não o mostra', async () => {
    await abrir();

    expect(screen.queryByRole('group', { name: 'Entidade' })).not.toBeInTheDocument();
  });

  it('sem coleta da DCA, avisa sem número', async () => {
    new FetchFake().responder('/api/funcoes/serie', serie([])).instalar();
    const { container } = render(<ParaOndeVai />);

    expect(await screen.findByText(/A despesa por função ainda não foi coletada/)).toBeInTheDocument();
    expect(container.querySelector('table')).toBeNull();
  });
});

describe('Para onde vai: ano a ano', () => {
  const evolucao = () => screen.getByRole('table', { name: /Participação de cada função, de 2018 a 2025/ });
  const linhaDaEvolucao = (nome: string) =>
    within(evolucao()).getByRole('rowheader', { name: nome }).closest('tr') as HTMLElement;
  const barras = () => screen.getByRole('img', { name: /Total empenhado por ano/ });

  it('o gráfico do total diz o primeiro e o último ano, em valores nominais', async () => {
    await abrir();

    expect(barras()).toHaveAccessibleName(
      'Total empenhado por ano, de R$ 1,0 milhões em 2018 a R$ 1,0 milhões em 2025, em valores nominais',
    );
  });

  it('o gráfico acende o exercício escolhido', async () => {
    await abrir();

    await userEvent.selectOptions(screen.getByLabelText('Exercício'), '2024');
    await screen.findByText(/empenhados em 2024/);

    const acesa = barras().querySelector('.selecionado') as HTMLElement;
    expect(acesa.getAttribute('title')).toContain('2024');
  });

  it('a evolução traz o primeiro e o último ano, e a variação em pontos', async () => {
    await abrir();

    const saude = linhaDaEvolucao('Saúde');

    expect(saude).toHaveTextContent('55,5%');
    expect(saude).toHaveTextContent('60,0%');
    expect(saude).toHaveTextContent('▲ 4,5 pontos');
  });

  it('a variação não leva cor: subir de participação não é bom nem ruim', async () => {
    await abrir();

    expect(document.querySelectorAll('.tabela-evolucao .bom, .tabela-evolucao .ruim')).toHaveLength(0);
  });

  it('o que mudou sai dos dados, com o nome da função', async () => {
    await abrir();

    const bloco = screen.getByRole('heading', { name: 'O que mudou' }).parentElement as HTMLElement;

    expect(bloco).toHaveTextContent(
      'Saúde passou de 55,5% do total em 2018 para 60,0% em 2025, a maior alta do período.',
    );
  });

  it('a tabela completa fica fechada, e abre pelo botão', async () => {
    await abrir();
    expect(screen.queryByRole('table', { name: 'Participação de cada função por ano' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ver a tabela com todos os anos' }));

    const completa = screen.getByRole('table', { name: 'Participação de cada função por ano' });
    const saude = within(completa).getByRole('rowheader', { name: 'Saúde' }).closest('tr') as HTMLElement;
    expect(saude).toHaveTextContent('55,5%');
    expect(saude).toHaveTextContent('58,25%');
    expect(within(completa).getByText(/valores nominais/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Esconder a tabela completa' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('a tabela completa diz o nível da conferência de cada ano', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Ver a tabela com todos os anos' }));

    const completa = screen.getByRole('table', { name: 'Participação de cada função por ano' });
    const conferencia = within(completa).getByRole('rowheader', { name: 'Conferência do total' }).closest('tr');
    expect(conferencia).toHaveTextContent(/fonte única.*conferido.*conferido/);
  });

  it('a tabela completa marca em negrito o maior ano de cada função', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Ver a tabela com todos os anos' }));

    const completa = screen.getByRole('table', { name: 'Participação de cada função por ano' });
    const saude = within(completa).getByRole('rowheader', { name: 'Saúde' }).closest('tr') as HTMLElement;

    expect(saude.querySelector('.maior-do-periodo')).toHaveTextContent('60%');
  });

  it('diz que os reais são nominais, e por que a comparação usa a participação', async () => {
    await abrir();

    expect(screen.getByText(/sem correção pela inflação/)).toBeInTheDocument();
  });
});

describe('Para onde vai: leitura', () => {
  it('as notas dizem que gastar mais não prova serviço melhor', async () => {
    await abrir();

    expect(screen.getByText(/gastar mais numa área não prova serviço melhor/i)).toBeInTheDocument();
  });

  it('as notas dizem que a função Educação não é o índice constitucional', async () => {
    await abrir();

    expect(screen.getByText(/função Educação não é o índice constitucional/)).toBeInTheDocument();
  });

  it('não usa texto proibido', async () => {
    const { container } = await abrir({ ano2025: funcoesComDiferenca() });

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
  });

  it('a fonte cita o anexo da DCA', async () => {
    await abrir();

    expect(screen.getAllByText(/Fonte: SICONFI — Tesouro Nacional/).length).toBeGreaterThan(0);
  });
});
