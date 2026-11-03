import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Capa from '../../src/paginas/Capa';
import {
  despesas,
  despesasSemConferencia,
  receitas,
  receitasDeExemplo,
  receitasSemConferencia,
  TEXTO_PROIBIDO,
} from '../support/conferidos';
import { FetchFake } from '../support/fetch-fake';
import { municipio, municipioIndisponivel } from '../support/municipio';
import { FILTROS } from '../support/respostas';

// O último exercício encerrado depende do relógio: as respostas ficam no ano anterior ao corrente.
const CORRENTE = new Date().getFullYear();
const ENCERRADO = CORRENTE - 1;
const CONFERIDO = 'conferido com o TCE-SC';
const FONTE_UNICA = 'fonte única, sem conferência';

afterEach(() => vi.unstubAllGlobals());

const qs = (ano: number) => new URLSearchParams({ ano: String(ano), entidade: '' }).toString();

function instalar({
  ibge = municipio(),
  receita = receitas(),
  despesa = despesas(),
}: { ibge?: unknown; receita?: unknown; despesa?: unknown } = {}) {
  return new FetchFake()
    .responder('/api/municipio', ibge)
    .responder(`/api/receitas?${qs(ENCERRADO)}`, receita)
    .responder(`/api/despesas/resumo?${qs(ENCERRADO)}`, despesa)
    .instalar();
}

const abrir = async (opcoes: Parameters<typeof instalar>[0] = {}, anos = [CORRENTE, ENCERRADO]) => {
  const fake = instalar(opcoes);
  const { container } = render(<Capa ano={anos[0] as number} entidade="" filtros={{ ...FILTROS, anos }} />);
  await screen.findByRole('heading', { level: 1 });
  await within(totais()).findAllByText(/./, { selector: '.numero-detalhe' });
  return { container, fake };
};

const totais = () => screen.getByRole('region', { name: 'Orleans em números' });
const celula = (rotulo: string | RegExp) => within(totais()).getByText(rotulo).parentElement as HTMLElement;
const valor = (rotulo: string | RegExp) => celula(rotulo).querySelector('.numero-valor');

describe('Capa: números', () => {
  it('população e PIB per capita trazem o próprio ano', async () => {
    await abrir();
    await within(totais()).findByText('População, estimativa 2026');

    expect(valor('População, estimativa 2026')).toHaveTextContent('24.901');
    expect(valor('PIB per capita, 2023')).toHaveTextContent('59.547');
  });

  it('PIB per capita diz o divisor, porque a população ao lado é de outro ano', async () => {
    await abrir();
    await within(totais()).findByText('PIB per capita, 2023');

    expect(celula('PIB per capita, 2023')).toHaveTextContent('PIB ÷ 23.661 moradores (Censo 2022)');
    expect(celula('PIB per capita, 2023')).toHaveTextContent('não é a renda do morador');
  });

  it('receita e despesa são do último exercício encerrado', async () => {
    await abrir();
    await within(totais()).findByText(`Receita arrecadada em ${ENCERRADO}`);

    expect(valor(`Receita arrecadada em ${ENCERRADO}`)).toHaveTextContent('1,2 mi');
    expect(valor(`Despesa empenhada em ${ENCERRADO}, sem a Câmara`)).toHaveTextContent('10,8 mi');
  });

  it('com os quatro números na tela, nenhum cartão leva selo nem link de discrepâncias', async () => {
    await abrir();
    await within(totais()).findByText('População, estimativa 2026');
    await within(totais()).findByText(`Receita arrecadada em ${ENCERRADO}`);

    expect(totais()).not.toHaveTextContent(CONFERIDO);
    expect(totais()).not.toHaveTextContent(FONTE_UNICA);
    expect(within(totais()).queryByRole('link')).not.toBeInTheDocument();
  });

  it('a abertura diz onde estão a origem e a conferência, sem prometer selo na capa', async () => {
    await abrir();

    expect(document.body).not.toHaveTextContent('com o que foi conferido');
    expect(document.querySelector('.capitular')).toHaveTextContent(/origem e a conferência .* na página de cada área/);
  });

  it('a despesa da capa é a da aba Despesas, sem a Câmara', async () => {
    const resposta = despesas();
    await abrir({ despesa: resposta });
    await within(totais()).findByText(`Despesa empenhada em ${ENCERRADO}, sem a Câmara`);

    // totais.empenhado de /api/despesas/resumo, que não leva a Câmara.
    expect(resposta.totais.empenhado).toBe(10791652.53);
    expect(valor(`Despesa empenhada em ${ENCERRADO}, sem a Câmara`)).toHaveTextContent('10,8 mi');
  });

  it('com o ano corrente parcial, a capa usa o último encerrado e não pede o corrente', async () => {
    const { fake } = await abrir();

    expect(fake.pedidos).toContain(`/api/receitas?${qs(ENCERRADO)}`);
    expect(fake.pedidos).not.toContain(`/api/receitas?${qs(CORRENTE)}`);
  });

  it('sem conferência no ano, o cartão financeiro fica sem número, com o aviso', async () => {
    await abrir({ receita: receitasSemConferencia(), despesa: despesasSemConferencia() });
    const cartao = await within(totais()).findByText(`Receita arrecadada em ${ENCERRADO}`);

    expect(cartao.parentElement).toHaveTextContent('Sem conferência entre as fontes');
    expect(valor(`Receita arrecadada em ${ENCERRADO}`)).toHaveTextContent('—');
    expect(valor(`Despesa empenhada em ${ENCERRADO}, sem a Câmara`)).toHaveTextContent('—');
  });

  it('dados de exemplo saem com o selo de fictícios, sem o de conferido', async () => {
    await abrir({ receita: receitasDeExemplo() });
    const cartao = await within(totais()).findByText(`Receita arrecadada em ${ENCERRADO}`);

    expect(cartao.parentElement).toHaveTextContent('dados fictícios');
    expect(cartao.parentElement).not.toHaveTextContent(CONFERIDO);
  });

  it('sem IBGE, os cartões do IBGE ficam sem número, e o resto segue', async () => {
    await abrir({ ibge: municipioIndisponivel() });
    await within(totais()).findByText(`Receita arrecadada em ${ENCERRADO}`);

    expect(valor('População')).toHaveTextContent('—');
    expect(valor('PIB per capita')).toHaveTextContent('—');
    expect(valor(`Receita arrecadada em ${ENCERRADO}`)).toHaveTextContent('1,2 mi');
  });

  it('sem exercício publicado, os cartões financeiros ficam sem número, e o IBGE segue', async () => {
    await abrir({}, []);
    await within(totais()).findByText('População, estimativa 2026');

    expect(valor('Receita arrecadada')).toHaveTextContent('—');
    expect(valor('População, estimativa 2026')).toHaveTextContent('24.901');
  });
});

describe('Capa: áreas', () => {
  it.each([
    ['Finanças', '#financas'],
    ['Para onde vai o dinheiro', '#para-onde-vai'],
    ['Demografia', '#conheca-orleans'],
    ['Economia', '#conheca-orleans'],
  ])('o cartão de %s leva para %s', async (nome, destino) => {
    await abrir();

    expect(screen.getByRole('link', { name: new RegExp(`^${nome}`) })).toHaveAttribute('href', destino);
  });

  it.each([['Educação'], ['Saúde'], ['Saneamento']])('%s diz "em breve", sem número e sem link', async (nome) => {
    await abrir();

    const cartao = screen.getByRole('heading', { name: nome }).closest('li') as HTMLElement;
    expect(cartao).toHaveTextContent('em breve');
    expect(cartao).not.toHaveTextContent(/\d/);
    expect(within(cartao).queryByRole('link')).not.toBeInTheDocument();
  });

  it('não usa texto proibido', async () => {
    const { container } = await abrir();

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
  });
});
