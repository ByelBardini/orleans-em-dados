import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Dinheiro from '../../../src/paginas/educacao/Dinheiro';
import { TEXTO_PROIBIDO } from '../../support/conferidos';
import { dinheiro, dinheiroIndisponivel } from '../../support/educacao';
import { FetchFake } from '../../support/fetch-fake';

afterEach(() => vi.unstubAllGlobals());

const CAMINHO = '/api/educacao/dinheiro';

const abrir = async (resposta = dinheiro()) => {
  new FetchFake().responder(CAMINHO, resposta).instalar();
  const { container } = render(<Dinheiro />);
  await screen.findByRole('link', { name: /baixar csv/i });
  return container;
};

const bloco = (nome: string | RegExp) => screen.getByRole('region', { name: nome });
const textoDe = (elemento: HTMLElement) => (elemento.textContent ?? '').replace(/\s+/g, ' ');
const seloEm = (elemento: HTMLElement, nome: string | RegExp) =>
  within(elemento).queryByRole('button', { name: new RegExp(nome) });
const FONTE_UNICA = 'fonte única, sem conferência';
const linhaDo = (elemento: HTMLElement, ano: number) =>
  within(elemento)
    .getAllByRole('row')
    .find((linha) => within(linha).queryByRole('rowheader', { name: String(ano) })) as HTMLElement;

const abrirDetalhes = (elemento: HTMLElement) =>
  userEvent.click(within(elemento).getByRole('button', { name: 'Fonte e detalhes' }));

const coluna = (elemento: HTMLElement, ano: number) =>
  elemento.querySelector<HTMLElement>(`.bpa-coluna[data-ano="${ano}"]`) as HTMLElement;
const dicaAoPassar = async (elemento: HTMLElement, ano: number) => {
  await userEvent.hover(coluna(elemento, ano));
  return textoDe(elemento.querySelector('.bpa-dica') as HTMLElement);
};
// A conta de um ano: cada linha é termo e valor, e `valorNa` acha a linha pelo termo.
const contaDe = (ano: number) => within(bloco(CONTA)).getByRole('group', { name: String(ano) });
const valorNa = (conta: HTMLElement, termo: string) => {
  const linha = [...conta.querySelectorAll('dt')].find((dt) => textoDe(dt).includes(termo));
  return linha ? textoDe(linha.nextElementSibling as HTMLElement).trim() : null;
};

const MINIMO = /o mínimo de 25%/i;
const FUNDEB = /fundeb na remuneração/i;
const GASTO = /quanto foi gasto/i;
const ETAPA = /gasto por etapa/i;
const ACOES = /em que o dinheiro foi gasto/i;
const REPASSES = /repasses recebidos/i;
const CONTA = /a conta do fundeb/i;
const POR_ALUNO = /investimento por aluno/i;

describe('Dinheiro: estados', () => {
  it('enquanto carrega, diz que está carregando', () => {
    const fake = new FetchFake();
    fake.segurar = true;
    fake.responder(CAMINHO, dinheiro()).instalar();

    render(<Dinheiro />);

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('sem nenhuma coleta, avisa e não mostra bloco', async () => {
    new FetchFake().responder(CAMINHO, dinheiroIndisponivel()).instalar();

    render(<Dinheiro />);

    expect(await screen.findByText(/ainda não foram coletados/i)).toBeInTheDocument();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('o bloco sem coleta some, e o resto segue', async () => {
    await abrir(dinheiro({ repasses: null, faltando: ['receitas'] }));

    expect(screen.queryByRole('region', { name: REPASSES })).toBeNull();
    expect(bloco(CONTA)).toBeInTheDocument();
  });

  it('o CSV da aba tem link', async () => {
    await abrir();

    expect(screen.getByRole('link', { name: /baixar csv/i })).toHaveAttribute('href', '/api/educacao/dinheiro.csv');
  });

  it('nenhum texto da aba usa palavra proibida', async () => {
    const container = await abrir();

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
  });

  it('a abertura sai do último exercício e diz que os valores são nominais', async () => {
    const container = await abrir();

    const texto = textoDe(container);
    expect(texto).toContain('Em 2025, a Prefeitura gastou R$ 37,5 milhões com educação');
    expect(texto).toContain('aplicou 28,63% da receita de impostos');
    expect(texto).toContain('nominais, sem correção pela inflação');
  });
});

describe('Dinheiro: o mínimo de 25%', () => {
  it('o selo é fonte única, mesmo com o percentual igual ao do SICONFI', async () => {
    await abrir();

    expect(seloEm(bloco(MINIMO), FONTE_UNICA)).toBeInTheDocument();
  });

  it('a frase nomeia o ano abaixo do mínimo, e a tabela traz a linha de 25%', async () => {
    await abrir();

    const noBloco = bloco(MINIMO);
    expect(textoDe(noBloco)).toContain('Orleans ficou acima em todos os anos, menos em 2021');
    const tabela = within(noBloco).getByRole('table', { name: /aplicado em educação/i });
    expect(within(tabela).getByRole('rowheader', { name: 'Mínimo legal' }).closest('tr')).toHaveTextContent('25,00%');
    expect(linhaDo(tabela, 2021)).toHaveTextContent('23,28%');
  });

  it('com todos os anos acima, a frase diz isso, e a nota da Emenda sai', async () => {
    const base = dinheiro();
    await abrir(
      dinheiro({
        minimo: {
          ...base.minimo!,
          anos: base.minimo!.anos.filter((a) => a.ano !== 2021),
        },
      }),
    );

    const texto = textoDe(bloco(MINIMO));
    expect(texto).toContain('Orleans ficou acima em todos os anos');
    expect(texto).not.toContain('Emenda');
  });

  it('a dica da barra traz o valor aplicado em reais', async () => {
    await abrir();

    expect(await dicaAoPassar(bloco(MINIMO), 2025)).toContain('R$ 30.000.000,00 aplicados em educação');
  });

  it('o aviso do SICONFI é uma linha com os anos, e a lista fica no detalhe', async () => {
    await abrir();

    const resumo = within(bloco(MINIMO)).getByText(/registram valores diferentes/);
    expect(resumo.tagName).toBe('SUMMARY');
    expect(textoDe(resumo)).toBe('SIOPE e SICONFI registram valores diferentes em 2020, 2021 e 2025');
  });

  it('2021 traz a nota da Emenda 119, que afastou as penalidades de 2020 e 2021', async () => {
    await abrir();

    expect(textoDe(bloco(MINIMO))).toContain(
      'A Emenda Constitucional 119, de 2022, afastou as penalidades por não aplicar o mínimo em 2020 e 2021',
    );
  });

  it('o que o SIOPE registra sobre 2021 fica escrito', async () => {
    await abrir();

    expect(textoDe(bloco(MINIMO))).toContain(
      'O SIOPE registra R$ 1.000.000,50 a menos em 2021 e R$ 1.200.000,00 complementados em 2022',
    );
  });

  it('a hipótese da Emenda para a diferença de 2023 não vai para a tela', async () => {
    const container = await abrir();

    expect(textoDe(container)).not.toMatch(/emenda[^.]*2023|2023[^.]*emenda/i);
  });

  it('o aviso traz o valor do SICONFI e leva a Discrepâncias', async () => {
    await abrir();

    const noBloco = bloco(MINIMO);
    expect(textoDe(noBloco)).toContain('2025: SIOPE 28,63% (R$ 30.000.000,00); SICONFI 28,31% (R$ 29.700.000,00)');
    expect(within(noBloco).getByRole('link', { name: /ver em discrepâncias/i })).toHaveAttribute(
      'href',
      '#discrepancias',
    );
  });

  it('ano em que o percentual é igual e o valor difere também entra no aviso', async () => {
    await abrir();

    expect(textoDe(bloco(MINIMO))).toContain(
      '2021: SIOPE 23,28% (R$ 14.604.000,00); SICONFI 23,28% (R$ 14.603.900,50)',
    );
  });

  it('ano igual nas duas fontes fica fora do aviso', async () => {
    await abrir();

    expect(textoDe(bloco(MINIMO))).not.toContain('2022: SIOPE');
  });

  it('sem diferença em ano nenhum, não há aviso nem link', async () => {
    const base = dinheiro();
    await abrir(
      dinheiro({
        minimo: { ...base.minimo!, anos: base.minimo!.anos.map((a) => ({ ...a, difereDoSiconfi: false })) },
      }),
    );

    expect(within(bloco(MINIMO)).queryByRole('link', { name: /ver em discrepâncias/i })).toBeNull();
  });
});

describe('Dinheiro: Fundeb na remuneração', () => {
  it('a tabela traz o mínimo de cada ano: 60% em 2020 e 70% depois', async () => {
    await abrir();

    const tabela = within(bloco(FUNDEB)).getByRole('table', { name: /fundeb na remuneração/i });
    expect(linhaDo(tabela, 2020)).toHaveTextContent('60,00%');
    expect(linhaDo(tabela, 2021)).toHaveTextContent('70,00%');
  });

  it('a frase cita os dois mínimos', async () => {
    await abrir();

    expect(textoDe(bloco(FUNDEB))).toContain('pelo menos 70% do Fundeb');
    expect(textoDe(bloco(FUNDEB))).toContain('em 2020, eram 60%');
  });

  it('com todos os anos acima do mínimo de cada um, a frase diz isso', async () => {
    await abrir();

    expect(textoDe(bloco(FUNDEB))).toContain('Orleans ficou acima em todos os anos');
  });

  it('a dica da barra traz o valor na remuneração; sem ele, só o percentual e o mínimo', async () => {
    await abrir();

    const noBloco = bloco(FUNDEB);
    expect(await dicaAoPassar(noBloco, 2021)).toContain('R$ 9.000.000,00 na remuneração');
    const semValor = await dicaAoPassar(noBloco, 2020);
    expect(semValor).toContain('80,66%');
    expect(semValor).not.toContain('R$');
  });

  it('o aviso do SICONFI sem o valor do SIOPE fica só com o percentual', async () => {
    await abrir();

    expect(textoDe(bloco(FUNDEB))).toContain('2020: SIOPE 80,66%; SICONFI 87,13% (R$ 8.000.000,00)');
  });
});

describe('Dinheiro: gasto', () => {
  // Um cartão por ano: o gasto em destaque e, embaixo, por morador e participação, cada valor em <strong>.
  const quadroDo = (ano: number) => within(bloco(GASTO)).getByRole('group', { name: `Gasto em ${ano}` });
  const valoresDo = (quadro: HTMLElement) => [...quadro.querySelectorAll('strong')].map((v) => textoDe(v).trim());
  const linhaDoGasto = (quadro: HTMLElement) => quadro.querySelector('strong')?.parentElement as HTMLElement;
  const abrirDivisor = (quadro: HTMLElement) =>
    userEvent.click(within(quadro).getByRole('button', { name: 'como se calcula' }));

  it('cada ano é um cartão com gasto, por morador e participação, sem tabela nem seta', async () => {
    await abrir();

    const quadro = quadroDo(2025);
    expect(within(quadro).getByRole('heading', { name: '2025' })).toBeInTheDocument();
    expect(valoresDo(quadro)).toEqual(['R$ 37.500.000,00', 'R$ 1.562,50', '25,6%']);
    expect(textoDe(quadro)).toContain('R$ 1.562,50 por morador');
    expect(textoDe(quadro)).toContain('25,6% da despesa total');
    expect(within(quadro).queryByRole('table')).toBeNull();
    expect(quadro).not.toHaveTextContent('Orleans');
    expect(quadroDo(2023)).toBeInTheDocument();
    expect(within(bloco(GASTO)).queryByText(/acima de SC|abaixo de SC/)).toBeNull();
  });

  it('o selo do ano fica na linha do gasto', async () => {
    await abrir();

    expect(seloEm(linhaDoGasto(quadroDo(2025)), 'conferido com a Betha')).toBeInTheDocument();
  });

  it('cada ano tem o próprio selo: conferido com a Betha ou fonte única', async () => {
    await abrir();

    expect(seloEm(quadroDo(2025), 'conferido com a Betha')).toBeInTheDocument();
    expect(seloEm(quadroDo(2023), FONTE_UNICA)).toBeInTheDocument();
  });

  it('ano com diferença na conferência fica como fonte única', async () => {
    const base = dinheiro();
    await abrir(
      dinheiro({
        gasto: {
          ...base.gasto!,
          anos: base.gasto!.anos.map((a) => (a.ano === 2025 ? { ...a, conferencia: 'diferenca' as const } : a)),
        },
      }),
    );

    expect(seloEm(quadroDo(2025), FONTE_UNICA)).toBeInTheDocument();
  });

  it('o selo do título diz os anos conferidos', async () => {
    await abrir();

    const titulo = within(bloco(GASTO)).getAllByRole('button', { name: /conferido com a Betha em 2024 e 2025/ });
    expect(titulo).toHaveLength(1);
  });

  it('sem ano conferido, o título fica em fonte única', async () => {
    const base = dinheiro();
    await abrir(
      dinheiro({
        gasto: { ...base.gasto!, anos: base.gasto!.anos.map((a) => ({ ...a, conferencia: 'sem_betha' as const })) },
      }),
    );

    expect(within(bloco(GASTO)).queryByRole('button', { name: /conferido com a Betha em/ })).toBeNull();
  });

  it('o Anexo 8 fica em Fonte e detalhes, que diz em que anos ele traz o mesmo valor', async () => {
    await abrir();

    expect(textoDe(bloco(GASTO))).not.toContain('Anexo 8');
    await abrirDetalhes(bloco(GASTO));
    expect(textoDe(bloco(GASTO))).toContain('Em 2024 e 2025, o Anexo 8 do SIOPE traz o mesmo valor.');
    expect(quadroDo(2025)).not.toHaveTextContent('Anexo 8');
  });

  it('o ano em que o Anexo 8 difere leva a Discrepâncias', async () => {
    await abrir();

    const noBloco = bloco(GASTO);
    await abrirDetalhes(noBloco);
    expect(textoDe(noBloco)).toContain('Em 2023, o Anexo 8 do SIOPE traz outro valor');
    expect(within(noBloco).getByRole('link', { name: /ver em discrepâncias/i })).toHaveAttribute(
      'href',
      '#discrepancias',
    );
  });

  it('o divisor do por morador fica na dica, fora da linha à vista', async () => {
    await abrir();

    expect(textoDe(bloco(GASTO))).not.toContain('moradores,');
    await abrirDivisor(quadroDo(2023));
    expect(quadroDo(2023)).toHaveTextContent('÷ 23.000 moradores, Censo 2022');
    await abrirDivisor(quadroDo(2025));
    expect(quadroDo(2025)).toHaveTextContent('÷ 24.000 moradores, estimativa 2025');
  });

  it('a dica da barra do gasto traz o gasto por morador', async () => {
    await abrir();

    expect(await dicaAoPassar(bloco(GASTO), 2025)).toContain('R$ 1.562,50 por morador');
  });

  it('sem população, por morador é travessão, sem conta escrita', async () => {
    const base = dinheiro();
    await abrir(
      dinheiro({
        gasto: { ...base.gasto!, anos: base.gasto!.anos.map((a) => ({ ...a, divisor: null, porMorador: null })) },
      }),
    );

    expect(valoresDo(quadroDo(2025))[1]).toBe('—');
    expect(within(quadroDo(2025)).queryByRole('button', { name: 'como se calcula' })).toBeNull();
    expect(quadroDo(2025)).not.toHaveTextContent('moradores');
  });

  it('a participação diz, em Fonte e detalhes, que a Câmara fica fora da conta', async () => {
    await abrir();

    expect(valoresDo(quadroDo(2025))[2]).toBe('25,6%');
    await abrirDetalhes(bloco(GASTO));
    expect(textoDe(bloco(GASTO))).toContain('sem a função 01, a Câmara');
  });

  it('a nota das etapas diz onde estão o transporte e a merenda', async () => {
    await abrir();

    const texto = textoDe(bloco(ETAPA));
    expect(texto).toContain('o transporte escolar (R$ 3.950.000,00) está todo no fundamental');
    expect(texto).toContain('a merenda (R$ 1.650.000,00), em Outras');
  });

  it('sem as ações, a nota das etapas fica sem valor, nunca com zero', async () => {
    const base = dinheiro();
    await abrir(dinheiro({ gasto: { ...base.gasto!, acoesNasEtapas: null } }));

    const texto = textoDe(bloco(ETAPA));
    expect(texto).toContain('O transporte escolar está todo no fundamental, e a merenda, em Outras');
    expect(texto).not.toContain('R$ 0,00');
  });

  it('as partes da etapa saem com o percentual', async () => {
    await abrir();

    const tabela = within(bloco(ETAPA)).getByRole('table', { name: /gasto por etapa/i });
    expect(linhaDo(tabela, 2025)).toHaveTextContent('54,9%');
    expect(linhaDo(tabela, 2025)).toHaveTextContent('39,6%');
  });
});

describe('Dinheiro: ações e natureza', () => {
  it('o selo é fonte única, e a nota diz que só o total é conferido', async () => {
    await abrir();

    const noBloco = bloco(ACOES);
    expect(seloEm(noBloco, FONTE_UNICA)).toBeInTheDocument();
    expect(textoDe(noBloco)).toContain('Só o total é conferido');
  });

  it('sem o total conferido, a nota não diz que ele é', async () => {
    const base = dinheiro();
    await abrir(
      dinheiro({
        acoes: { ...base.acoes!, anos: base.acoes!.anos.map((a) => ({ ...a, totalConferido: false })) },
      }),
    );

    expect(textoDe(bloco(ACOES))).not.toContain('Só o total é conferido');
  });

  it('o que é a natureza da despesa fica em Fonte e detalhes', async () => {
    await abrir();

    expect(textoDe(bloco(ACOES))).not.toContain('31 pessoal');
    await abrirDetalhes(bloco(ACOES));
    expect(textoDe(bloco(ACOES))).toContain('Natureza é o grupo da despesa: 31 pessoal, 33 custeio, 44 investimento.');
  });

  it('o título é do último exercício, e a ação sem gasto não aparece', async () => {
    await abrir();

    const noBloco = bloco(ACOES);
    expect(within(noBloco).getByRole('heading', { level: 2 })).toHaveTextContent('em 2025');
    expect(textoDe(noBloco)).toContain('Manutenção do Transporte Escolar');
    expect(textoDe(noBloco)).not.toContain('Aquisição de Veículo');
  });

  it('cada ação é uma barra com o valor ao lado do nome, e a dica diz a parte do total', async () => {
    const container = await abrir();

    const lista = within(bloco(ACOES)).getByRole('list', { name: /gasto por ação/i });
    const transporte = within(lista).getByText('Manutenção do Transporte Escolar').closest('li') as HTMLElement;
    expect(textoDe(transporte)).toContain('Manutenção do Transporte Escolar R$ 3.950.000,00');

    await userEvent.hover(transporte);
    expect(textoDe(container.querySelector('.bh-dica') as HTMLElement)).toContain('10,5% do total de 2025');
  });

  it('pessoal, custeio e investimento saem em percentual, ano a ano', async () => {
    await abrir();

    const tabela = within(bloco(ACOES)).getByRole('table', { name: /natureza/i });
    expect(linhaDo(tabela, 2025)).toHaveTextContent('68,3%');
    expect(linhaDo(tabela, 2024)).toHaveTextContent('64,0%');
  });
});

describe('Dinheiro: repasses', () => {
  it('o selo é conferido com o TCE-SC', async () => {
    await abrir();

    expect(seloEm(bloco(REPASSES), 'conferido com o TCE-SC')).toBeInTheDocument();
  });

  it('a rubrica conferida sai com o valor, e a de fora, sem número', async () => {
    await abrir();

    const noBloco = bloco(REPASSES);
    const fundeb = within(noBloco).getByText('Fundeb').closest('li') as HTMLElement;
    expect(textoDe(fundeb)).toContain('R$ 17.500.000,00');
    const fora = within(noBloco).getByText('Programa Escola em Tempo Integral').closest('li') as HTMLElement;
    expect(textoDe(fora)).toContain('fora do conferido');
    expect(textoDe(fora)).not.toContain('R$');
  });

  it('a equivalência diz "equivale a", com a conta escrita, e nunca "cobriu"', async () => {
    await abrir();

    const texto = textoDe(bloco(REPASSES));
    expect(texto).toContain('equivalem a 35,5% do gasto');
    expect(texto).toContain('R$ 1.400.000,00 de R$ 3.950.000,00');
    expect(texto).not.toMatch(/cobriu|coberto|cobre/i);
  });

  it('a equivalência traz o ano anterior quando ele existe', async () => {
    await abrir();

    expect(textoDe(bloco(REPASSES))).toContain('2024: 36,7%');
  });

  it('repasse fora do conferido não vira percentual', async () => {
    const base = dinheiro();
    const [ano2024, ano2025] = base.repasses!.anos;
    await abrir(
      dinheiro({
        repasses: {
          ...base.repasses!,
          anos: [
            ano2024!,
            {
              ...ano2025!,
              equivalencias: ano2025!.equivalencias.map((e) =>
                e.chave === 'transporte' ? { ...e, repasses: null, percentual: null } : e,
              ),
            },
          ],
        },
      }),
    );

    expect(textoDe(bloco(REPASSES))).toContain('Transporte escolar: sem conta, porque um dos repasses ficou fora');
  });
});

describe('Dinheiro: a conta do Fundeb', () => {
  it('cada ano arma a conta: recebido, menos a contribuição, dá o saldo, ao lado do resultado oficial', async () => {
    await abrir();

    const conta = contaDe(2025);
    expect(valorNa(conta, 'Recebido do fundo')).toContain('R$ 17.500.000,00');
    expect(valorNa(conta, 'Contribuição ao fundo')).toContain('R$ 16.000.000,00');
    expect(valorNa(conta, 'Recebido − contribuição')).toBe('R$ 1.500.000,00');
    expect(valorNa(conta, 'Resultado oficial')).toBe('R$ 1.419.999,50');
  });

  it('os sinais da conta ficam escritos nos termos', async () => {
    await abrir();

    const termos = [...contaDe(2025).querySelectorAll('dt')].map((dt) => textoDe(dt).trim());
    expect(termos.slice(0, 3)).toEqual(['+ Recebido do fundo', '− Contribuição ao fundo', '= Recebido − contribuição']);
  });

  it('o ano que fecha diz que fecha ao centavo', async () => {
    await abrir();

    expect(valorNa(contaDe(2024), 'Diferença')).toBe('fecha ao centavo');
  });

  it('o ano que não fecha mostra a diferença, com sinal', async () => {
    await abrir();

    expect(valorNa(contaDe(2025), 'Diferença')).toBe('−R$ 80.000,50');
  });

  it('a diferença fica sem causa afirmada', async () => {
    await abrir();

    const texto = textoDe(bloco(CONTA));
    expect(texto).toContain('Os demonstrativos publicados não explicam essa diferença');
    expect(texto).not.toMatch(/porque|devido|causa|erro/i);
  });

  it('sem diferença em ano nenhum, a frase sobre ela sai', async () => {
    const base = dinheiro();
    await abrir(
      dinheiro({
        contaDoFundeb: {
          ...base.contaDoFundeb!,
          anos: base.contaDoFundeb!.anos.filter((a) => a.ano !== 2025),
        },
      }),
    );

    expect(textoDe(bloco(CONTA))).not.toContain('não explicam');
  });

  it('ano sem a receita conferida mostra só o que há, na faixa que diz que a conta não é refeita', async () => {
    await abrir();

    const conta = contaDe(2023);
    expect(valorNa(conta, 'Contribuição ao fundo')).toBe('R$ 11.600.000,00');
    expect(valorNa(conta, 'Resultado oficial')).toBe('R$ 2.600.000,00');
    expect(within(conta).queryByText(/Recebido do fundo/)).toBeNull();
    expect(within(conta).queryByText('Diferença')).toBeNull();
    const faixa = within(bloco(CONTA)).getByRole('group', { name: /sem a conta refeita/i });
    expect(faixa).toContainElement(conta);
    expect(faixa).toHaveTextContent('Sem a receita conferida com o TCE-SC em 2023, a conta não é refeita.');
  });

  it('o aviso da faixa é dito uma vez só, com os anos que vêm dos dados', async () => {
    const base = dinheiro();
    const semReceita = (ano: number) => ({ ...base.contaDoFundeb!.anos[0]!, ano });
    await abrir(
      dinheiro({
        contaDoFundeb: {
          ...base.contaDoFundeb!,
          anos: [2020, 2021, 2022, 2023].map(semReceita).concat(base.contaDoFundeb!.anos.slice(1)),
        },
      }),
    );

    const texto = textoDe(bloco(CONTA));
    expect(texto).toContain('Sem a receita conferida com o TCE-SC em 2020 a 2023, a conta não é refeita.');
    expect(texto.match(/Sem a receita conferida/g)).toHaveLength(1);
    expect(contaDe(2020)).toBeInTheDocument();
  });

  it('com todos os anos com a conta completa, a faixa não aparece', async () => {
    const base = dinheiro();
    await abrir(
      dinheiro({
        contaDoFundeb: { ...base.contaDoFundeb!, anos: base.contaDoFundeb!.anos.filter((a) => a.recebido !== null) },
      }),
    );

    expect(within(bloco(CONTA)).queryByRole('group', { name: /sem a conta refeita/i })).toBeNull();
    expect(textoDe(bloco(CONTA))).not.toContain('Sem a receita conferida');
  });

  it('o recebido e a contribuição conferidos têm o selo do TCE-SC', async () => {
    await abrir();

    expect(within(contaDe(2024)).getAllByRole('button', { name: /conferido com o TCE-SC/ })).toHaveLength(2);
    expect(seloEm(contaDe(2023), 'conferido com o TCE-SC')).toBeNull();
  });

  it('o resultado oficial segue fonte única, no título', async () => {
    await abrir();

    expect(seloEm(bloco(CONTA), FONTE_UNICA)).toBeInTheDocument();
  });
});

describe('Dinheiro: por aluno', () => {
  it('educação básica de 2022 é travessão, e a nota diz por quê', async () => {
    await abrir();

    const noBloco = bloco(POR_ALUNO);
    const tabela = within(noBloco).getByRole('table', { name: /educação básica/i });
    expect(linhaDo(tabela, 2022)).toHaveTextContent('—');
    expect(textoDe(noBloco)).toContain('o SIOPE não recomenda');
  });

  it('os valores são rotulados como nominais', async () => {
    await abrir();

    expect(textoDe(bloco(POR_ALUNO))).toContain('reais nominais');
  });

  it('infantil e fundamental saem com o valor do ano', async () => {
    await abrir();

    const tabela = within(bloco(POR_ALUNO)).getByRole('table', { name: /educação infantil/i });
    expect(linhaDo(tabela, 2025)).toHaveTextContent('R$ 13.181');
  });
});
