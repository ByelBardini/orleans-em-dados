import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Acesso from '../../../src/paginas/educacao/Acesso';
import { TEXTO_PROIBIDO } from '../../support/conferidos';
import { acesso, acessoIndisponivel } from '../../support/educacao';
import { FetchFake } from '../../support/fetch-fake';

afterEach(() => vi.unstubAllGlobals());

const CAMINHO = '/api/educacao/acesso';

const abrir = async (resposta = acesso()) => {
  new FetchFake().responder(CAMINHO, resposta).instalar();
  const { container } = render(<Acesso />);
  await screen.findByRole('link', { name: /baixar csv/i });
  return container;
};

const bloco = (nome: string | RegExp) => screen.getByRole('region', { name: nome });
const tabelaDa = (nome: RegExp) => screen.getByRole('table', { name: nome });
const SELO = 'fonte única, sem conferência';

describe('Acesso: estados', () => {
  it('enquanto carrega, diz que está carregando', () => {
    const fake = new FetchFake();
    fake.segurar = true;
    fake.responder(CAMINHO, acesso()).instalar();

    render(<Acesso />);

    expect(screen.getByText('Carregando os números…')).toBeInTheDocument();
  });

  it('com a API fora do ar, mostra o aviso e nenhum número', async () => {
    new FetchFake().responderTexto(CAMINHO, JSON.stringify({ erro: 'Erro interno' }), 500).instalar();

    render(<Acesso />);

    expect(await screen.findByText(/Não foi possível carregar: Erro interno/)).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('sem nenhuma coleta, avisa e não mostra bloco nem CSV', async () => {
    new FetchFake().responder(CAMINHO, acessoIndisponivel()).instalar();

    render(<Acesso />);

    expect(await screen.findByText(/ainda não foram coletados/)).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /baixar csv/i })).not.toBeInTheDocument();
  });

  it('sem a coleta do Retrato, o bloco some e o resto segue', async () => {
    await abrir(acesso({ retrato: null, faltando: ['mec_retrato'] }));

    expect(screen.queryByRole('region', { name: /procura por creche/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/a Prefeitura informou/)).not.toBeInTheDocument();
    expect(bloco(/frequência à escola/i)).toBeInTheDocument();
  });

  it('o CSV da aba está a um clique', async () => {
    await abrir();

    expect(screen.getByRole('link', { name: /baixar csv/i })).toHaveAttribute('href', '/api/educacao/acesso.csv');
  });

  it('nenhuma palavra proibida na página', async () => {
    const container = await abrir();

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
  });
});

describe('Acesso: frequência', () => {
  it('cada faixa traz os três lugares com duas casas, por escrito', async () => {
    await abrir();

    const tabela = tabelaDa(/^4 e 5 anos/);
    expect(within(tabela).getByRole('row', { name: 'Orleans 83,44%' })).toBeInTheDocument();
    expect(within(tabela).getByRole('row', { name: 'Santa Catarina 90,55%' })).toBeInTheDocument();
    expect(within(tabela).getByRole('row', { name: 'Brasil 86,66%' })).toBeInTheDocument();
  });

  it('cada faixa diz, com seta, onde Orleans fica diante de SC e do Brasil: frequentar mais é melhor', async () => {
    await abrir();

    const faixa = tabelaDa(/^4 e 5 anos/).closest('.edu-acesso-faixa') as HTMLElement;
    const diante = within(faixa).getAllByRole('listitem');
    expect(diante.map((li) => li.textContent)).toEqual(['▼ 7,1 pontos abaixo de SC', '▼ 3,2 pontos abaixo do Brasil']);
    expect(diante[0]).toHaveClass('ruim');
    const creche = tabelaDa(/^0 a 3 anos/).closest('.edu-acesso-faixa') as HTMLElement;
    expect(within(creche).getAllByRole('listitem')[0]).toHaveClass('bom');
  });

  it('estudar em outra cidade não leva seta: não há sentido melhor', async () => {
    await abrir();

    expect(within(bloco(/estudar em outra cidade/i)).queryByText(/acima de SC|abaixo de SC/)).toBeNull();
  });

  it('2010 aparece abaixo da faixa, nos três lugares', async () => {
    await abrir();

    expect(screen.getByText('Em 2010: Orleans 35,1%, SC 34,2%, Brasil 23,3%.')).toBeInTheDocument();
  });

  it('a frase sai dos dados: acima, abaixo com os números, sem adjetivo', async () => {
    await abrir();

    expect(screen.getByText(/^Orleans fica acima de Santa Catarina e do Brasil em/)).toHaveTextContent(
      'Orleans fica acima de Santa Catarina e do Brasil em 0 a 3 anos e 15 a 17 anos. ' +
        'Fica abaixo dos dois em 4 e 5 anos (83,44% × 90,55% em SC) e 18 a 24 anos (25,10% × 28,20% em SC). ' +
        'Fica entre os dois em 6 a 14 anos.',
    );
    expect(bloco(/frequência à escola/i).textContent).not.toMatch(/um pouco/);
  });

  it('com os dados invertidos, a frase muda junto', async () => {
    const resposta = acesso();
    const [primeira] = resposta.frequencia!.faixas;
    primeira!.comparacao.porRede.todas = { orleans: 10, santaCatarina: 47.22, brasil: 33.33 };

    await abrir(resposta);

    expect(screen.getByText(/^Orleans fica/)).toHaveTextContent(
      /abaixo dos dois em 0 a 3 anos \(10,00% × 47,22% em SC\)/,
    );
  });

  it('acima de SC e abaixo do Brasil, a faixa fica entre os dois', async () => {
    const resposta = acesso();
    const [primeira] = resposta.frequencia!.faixas;
    primeira!.comparacao.porRede.todas = { orleans: 40, santaCatarina: 35, brasil: 45 };

    await abrir(resposta);

    expect(screen.getByText(/^Orleans fica/)).toHaveTextContent(/entre os dois em 0 a 3 anos e 6 a 14 anos/);
  });

  it('sem a comparação, não há frase, e SC e Brasil ficam em travessão', async () => {
    const resposta = acesso();
    for (const f of resposta.frequencia!.faixas) {
      f.comparacao.porRede.todas = { orleans: f.comparacao.porRede.todas!.orleans, santaCatarina: null, brasil: null };
    }

    await abrir(resposta);

    expect(screen.queryByText(/^Orleans fica/)).not.toBeInTheDocument();
    expect(within(tabelaDa(/^4 e 5 anos/)).getByRole('row', { name: 'Brasil —' })).toBeInTheDocument();
  });

  it.each([
    [/^0 a 3 anos/, 'Meta: até 2036, no Plano Nacional de Educação 60%'],
    [/^4 e 5 anos/, 'Meta: até 2028, no Plano Nacional de Educação 100%'],
    [/^6 a 14 anos/, 'Meta: até 2029, para toda a faixa de 6 a 17 anos, no Plano Nacional de Educação 100%'],
    [/^15 a 17 anos/, 'Meta: até 2029, para toda a faixa de 6 a 17 anos, no Plano Nacional de Educação 100%'],
  ])('a faixa %s tem linha de meta, também na tabela', async (nome, linha) => {
    await abrir();

    expect(within(tabelaDa(nome)).getByRole('row', { name: linha })).toBeInTheDocument();
  });

  it('18 a 24 anos não tem linha de meta', async () => {
    await abrir();

    expect(within(tabelaDa(/^18 a 24 anos/)).queryByRole('row', { name: /^Meta/ })).not.toBeInTheDocument();
  });

  it('a nota curta diz que a meta é nacional e que o dado é anterior à lei', async () => {
    await abrir();

    const nota = bloco(/frequência à escola/i).querySelector('.bloco-nota') as HTMLElement;
    expect(nota).toHaveTextContent('A meta é nacional, e o dado é de 2022, anterior à lei.');
  });

  it('o detalhe da lei fica em "Como ler": 6 a 17 é uma meta só, com o link da lei', async () => {
    await abrir();

    const comoLer = within(bloco(/frequência à escola/i))
      .getByText('Como ler')
      .closest('details') as HTMLElement;
    expect(comoLer).toHaveTextContent(/uma meta só/);
    expect(comoLer).toHaveTextContent(/De 18 a 24 anos, não há linha de meta/);
    expect(within(comoLer).getByRole('link', { name: /Lei 15\.388\/2026/ })).toHaveAttribute(
      'href',
      'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/L15388.htm',
    );
  });

  it('o bloco é fonte única e diz a fonte e o ano', async () => {
    await abrir();

    const noBloco = within(bloco(/frequência à escola/i));
    expect(noBloco.getByRole('button', { name: new RegExp(SELO) })).toBeInTheDocument();
    expect(noBloco.getByRole('link', { name: 'IBGE, Censo 2022' })).toBeInTheDocument();
  });
});

describe('Acesso: matrículas', () => {
  const linhaDaEtapa = (etapa: RegExp) => within(tabelaDa(/matrículas por rede/i)).getByRole('row', { name: etapa });

  it('cada etapa traz o total e as redes', async () => {
    await abrir();

    const linha = linhaDaEtapa(/^Ensino fundamental/);
    expect(linha).toHaveTextContent('1.500 matrículas');
    expect(within(linha).getByRole('cell', { name: '700' })).toBeInTheDocument();
    expect(within(linha).getByRole('cell', { name: '600' })).toBeInTheDocument();
    expect(within(linha).getByRole('cell', { name: '200' })).toBeInTheDocument();
  });

  it('rede sem matrícula na etapa é travessão, nunca zero', async () => {
    await abrir();

    const linha = linhaDaEtapa(/^Ensino médio/);
    expect(within(linha).getByRole('cell', { name: '—' })).toBeInTheDocument();
    expect(within(linha).queryByRole('cell', { name: '0' })).not.toBeInTheDocument();
  });

  it('a federal só aparece quando alguma etapa tem', async () => {
    const tabela = () => tabelaDa(/matrículas por rede/i);
    await abrir();
    expect(within(tabela()).queryByRole('columnheader', { name: 'Federal' })).not.toBeInTheDocument();
  });

  it('com matrícula federal, a coluna aparece', async () => {
    const resposta = acesso();
    resposta.matriculas!.etapas[3]!.federal = 12;

    await abrir(resposta);

    expect(within(tabelaDa(/matrículas por rede/i)).getByRole('columnheader', { name: 'Federal' })).toBeInTheDocument();
  });

  it('a frase traz o total e diz em que etapas a rede municipal tem matrícula', async () => {
    await abrir();

    const noBloco = bloco(/matrículas em 2025/i);
    expect(noBloco).toHaveTextContent('Em 2025, Orleans tem 3.000 matrículas.');
    expect(noBloco).toHaveTextContent(
      'A rede municipal tem matrículas em creche, pré-escola e ensino fundamental. A fonte não registra matrícula municipal em ensino médio.',
    );
  });

  it('escolas e docentes por etapa avisam que não se somam, e o que falta é travessão', async () => {
    await abrir();

    const noBloco = bloco(/escolas e docentes/i);
    const cartoes = within(noBloco)
      .getAllByRole('listitem')
      .map((c) => c.textContent);
    expect(cartoes).toContain('Educação infantil11 escolas77 docentes');
    expect(cartoes).toContain('Ensino médio2 escolas— docentes');
    expect(noBloco).toHaveTextContent(/mais de uma etapa/);
  });
});

describe('Acesso: estudar em outra cidade', () => {
  it('traz a comparação e a contagem de onde ela vem', async () => {
    await abrir();

    expect(within(tabelaDa(/outro município/i)).getByRole('row', { name: 'Orleans 12,5%' })).toBeInTheDocument();
    expect(bloco(/estudar em outra cidade/i)).toHaveTextContent('500 de 4.000 estudantes moradores de Orleans.');
  });

  it('diz a escala, que não vai a 100%', async () => {
    await abrir();

    expect(bloco(/estudar em outra cidade/i)).toHaveTextContent('Escala de 0 a 20%.');
  });

  it('valor acima de 20% alarga a escala, e o texto acompanha', async () => {
    const resposta = acesso();
    resposta.outroMunicipio!.comparacao.porRede.todas = { orleans: 32, santaCatarina: 8.1, brasil: 7.2 };

    await abrir(resposta);

    expect(bloco(/estudar em outra cidade/i)).toHaveTextContent('Escala de 0 a 32%.');
  });
});

describe('Acesso: Retrato do MEC', () => {
  const retrato = () => bloco(/procura por creche/i);

  it('"Não há demanda" vem sempre com "a Prefeitura informou ao MEC"', async () => {
    await abrir();

    expect(screen.getByText(/Não há demanda/)).toHaveTextContent('“Não há demanda”, a Prefeitura informou ao MEC');
  });

  it('quantidade na fila sem número é "Sem dado", nunca zero', async () => {
    await abrir();

    const linha = within(retrato()).getByText('Quantas crianças na lista de espera').parentElement;
    expect(linha).toHaveTextContent('Sem dado');
    expect(linha).not.toHaveTextContent('0');
  });

  it('o bloco diz que é declaração, e não contagem', async () => {
    await abrir();

    expect(retrato()).toHaveTextContent(/o que a Prefeitura informou ao MEC, e não uma contagem de crianças/i);
    expect(within(retrato()).getByRole('link', { name: /a Prefeitura informou ao MEC/ })).toBeInTheDocument();
  });

  it('tem selo de fonte única', async () => {
    await abrir();

    expect(within(retrato()).getByRole('button', { name: new RegExp(SELO) })).toBeInTheDocument();
  });

  const niveis = () => within(retrato()).getByRole('list', { name: 'Municípios de SC em cada nível' });

  it('o título diz que é a classificação do MEC da fila de creche', async () => {
    await abrir();

    expect(
      within(retrato()).getByRole('heading', { name: 'Como o MEC classificou a organização da fila de creche' }),
    ).toBeInTheDocument();
  });

  it('a abertura diz de onde vem a classificação, o nível de Orleans e quantos municípios de SC estão nele', async () => {
    await abrir();

    expect(retrato()).toHaveTextContent(
      'O MEC classificou cada município em quatro níveis, de 1 (Inicial) a 4 (Avançado), com base no que a própria ' +
        'Prefeitura respondeu sobre como cuida da procura por vaga em creche. Orleans ficou no nível 3 (Básico), ' +
        'como 90 dos 300 municípios de SC.',
    );
  });

  it('os números da abertura vêm da API', async () => {
    const resposta = acesso();
    resposta.retrato!.nivelDeOrleans = 'elementar';

    await abrir(resposta);

    expect(retrato()).toHaveTextContent('Orleans ficou no nível 2 (Elementar), como 150 dos 300 municípios de SC.');
  });

  it('o gráfico diz o eixo e mostra os municípios de SC em cada nível, com Orleans marcado', async () => {
    await abrir();

    expect(within(retrato()).getByText('Municípios de SC em cada nível', { selector: 'p' })).toBeInTheDocument();
    expect(
      within(niveis())
        .getAllByRole('listitem')
        .map((i) => i.textContent),
    ).toEqual(['40Nível 1 · Inicial', '150Nível 2 · Elementar', '90Nível 3 · BásicoOrleans', '20Nível 4 · Avançado']);
  });

  it('as respostas da Prefeitura vêm como a base da classificação', async () => {
    await abrir();

    const respostas = within(retrato()).getByRole('heading', { name: 'O que a Prefeitura respondeu' }).parentElement!;
    expect(respostas).toHaveTextContent('Algumas das respostas que entram na classificação');
    expect(within(respostas).getByText('Lista única para todo o município')).toBeInTheDocument();
  });

  it('Fonte e detalhes diz que a classificação é do MEC, sem a regra de cada nível, e liga ao Retrato', async () => {
    await abrir();

    await userEvent.click(within(retrato()).getByRole('button', { name: 'Fonte e detalhes' }));

    expect(retrato()).toHaveTextContent('A classificação é do MEC; o painel não publica aqui a regra de cada nível.');
    expect(within(retrato()).getByRole('link', { name: /Retrato da Educação Infantil 2025/ })).toHaveAttribute(
      'href',
      'https://mec.exemplo/retrato',
    );
  });

  it('nenhum nível ganha definição: cada nível só diz o nome e a contagem', async () => {
    const container = await abrir();

    for (const item of within(niveis()).getAllByRole('listitem')) {
      await userEvent.hover(item);
      expect(container.querySelector('.edu-acesso-nivel-dica')?.textContent).toMatch(
        /^Nível \d · [A-Za-zçá]+\d+ municípios de SC(Orleans está neste nível\.)?$/,
      );
      await userEvent.unhover(item);
    }
    expect(retrato()).not.toHaveTextContent(/(exige|significa|quer dizer|são os municípios que)/i);
  });

  const nivel = (nome: string) => within(niveis()).getByText(nome).closest('li') as HTMLElement;

  it('passar o mouse num nível abre a dica com o número de municípios de SC', async () => {
    const container = await abrir();

    const elementar = nivel('Nível 2 · Elementar');
    await userEvent.hover(elementar);

    expect(elementar).toHaveClass('is-ativo');
    expect(container.querySelector('.edu-acesso-nivel-dica')).toHaveTextContent(
      'Nível 2 · Elementar150 municípios de SC',
    );
    await userEvent.unhover(elementar);
    expect(container.querySelector('.edu-acesso-nivel-dica')).toBeNull();
  });

  it('a dica do nível de Orleans diz que Orleans está nele, e o teclado também abre', async () => {
    const container = await abrir();

    nivel('Nível 3 · Básico').focus();

    expect(await screen.findByText('Orleans está neste nível.')).toBeInTheDocument();
    expect(container.querySelector('.edu-acesso-nivel-dica')).toHaveTextContent('90 municípios de SC');
  });

  it('sem o nível de Orleans, a abertura e as barras ficam, sem o nível nem a marca', async () => {
    const resposta = acesso();
    resposta.retrato!.nivelDeOrleans = null;

    await abrir(resposta);

    expect(retrato()).toHaveTextContent(/O MEC classificou cada município em quatro níveis/);
    expect(retrato()).not.toHaveTextContent(/Orleans ficou no nível/);
    expect(nivel('Nível 3 · Básico')).not.toHaveTextContent('Orleans');
  });
});
