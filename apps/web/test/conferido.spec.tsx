import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  ateOMes,
  ContaDaDespesa,
  ContaDaReceita,
  linhaDoConferido,
  SecaoDaConta,
  SemConferencia,
} from '../src/conferido';
import { despesasParciais, receitasParciais } from './support/conferidos';

describe('linhaDoConferido', () => {
  it('diz o conferido em milhões e a parte do total do Portal da Transparência', () => {
    expect(linhaDoConferido({ area: 'Receita', conferido: 153008914.28, total: 163492213.08 })).toBe(
      'Receita: R$ 153,0 mi conferidos, 93,6% do total do Portal da Transparência.',
    );
  });

  it('sem área, a linha começa pelo valor', () => {
    expect(linhaDoConferido({ conferido: 50, total: 100 })).toBe(
      'R$ 0,0 mi conferidos, 50,0% do total do Portal da Transparência.',
    );
  });

  it('conferido zero não vira "0%": diz que nada confere', () => {
    expect(linhaDoConferido({ area: 'Despesa', conferido: 0, total: 1000 })).toBe(
      'Despesa: nada confere entre as fontes neste recorte.',
    );
  });

  it.each([
    ['total nulo', 100, null],
    ['total zero', 100, 0],
    ['conferido nulo', null, 100],
  ])('%s: sem linha', (_nome, conferido, total) => {
    expect(linhaDoConferido({ conferido, total })).toBeNull();
  });
});

describe('SecaoDaConta', () => {
  const abrir = () =>
    render(
      <SecaoDaConta titulo="Como se chega a estes números" resumo={['Receita: R$ 1,0 mi conferidos, 50,0% do total.']}>
        <ContaDaReceita explicada titulo="A conta da receita" conferencia={receitasParciais().conferencia} />
      </SecaoDaConta>,
    );

  it('a linha de resumo fica à vista, e a conta começa recolhida', () => {
    const { container } = abrir();

    const secao = screen.getByRole('heading', { name: 'Como se chega a estes números' }).closest('section')!;
    expect(secao).toHaveTextContent('Receita: R$ 1,0 mi conferidos, 50,0% do total.');
    const detalhes = container.querySelector('details')!;
    expect(detalhes).not.toHaveAttribute('open');
    expect(within(detalhes).getByText('Ver a conta').tagName).toBe('SUMMARY');
    expect(detalhes).toContainElement(container.querySelector('.conta'));
    expect(detalhes).toHaveTextContent('Tribunal de Contas do Estado');
    expect(secao.querySelector(':scope > p.conta-resumo')).toHaveTextContent('Receita');
  });

  it('clicar em "Ver a conta" abre a conta', async () => {
    const { container } = abrir();

    await userEvent.click(screen.getByText('Ver a conta'));
    expect(container.querySelector('details')).toHaveAttribute('open');
  });

  it('duas áreas: uma linha por área, e um recolhido só', () => {
    const { container } = render(
      <SecaoDaConta titulo="Como se chega a estes números" resumo={['Receita: linha.', 'Despesa: linha.']}>
        <p>conta</p>
      </SecaoDaConta>,
    );

    expect([...container.querySelectorAll('.conta-resumo')].map((p) => p.textContent)).toEqual([
      'Receita: linha.',
      'Despesa: linha.',
    ]);
    expect(container.querySelectorAll('details')).toHaveLength(1);
  });
});

describe('ateOMes', () => {
  it('no parcial, diz o mês por extenso e o ano', () => {
    expect(ateOMes(true, 9, 2026)).toBe('até setembro de 2026');
  });

  it.each([
    ['encerrado', false, 12],
    ['sem conferência', null, null],
    ['parcial sem mês', true, null],
  ])('%s não tem período', (_nome, parcial, mes) => {
    expect(ateOMes(parcial, mes, 2026)).toBe('');
  });
});

describe('ContaDaDespesa', () => {
  it('sem total da fonte, como no ano em curso, não há conta', () => {
    const { container } = render(<ContaDaDespesa conferido={100} conferencia={despesasParciais().conferencia} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ContaDaReceita', () => {
  const conferencia = receitasParciais().conferencia;

  it('sem explicada, a conta compacta não traz as explicações', () => {
    const { container } = render(<ContaDaReceita conferencia={conferencia} />);
    expect(container.querySelector('.conta-explica')).toBeNull();
    expect(container.querySelector('.conta-explicada')).toBeNull();
  });

  it('com explicada, cada parcela e o total dizem o que são', () => {
    const { container } = render(<ContaDaReceita explicada conferencia={conferencia} />);
    expect(container.querySelectorAll('.conta-explica')).toHaveLength(4);
  });

  it('sem o mês limite, a parcela que aguarda não cita mês', () => {
    render(<ContaDaReceita explicada conferencia={{ ...conferencia, limites: null }} />);
    expect(screen.getByText(/^Ainda não chegou ao TCE-SC/)).toBeInTheDocument();
  });

  it.each([
    ['zero', 0],
    ['nulo', null],
  ])('aguardando %s não vira parcela', (_nome, aguardandoTce) => {
    render(<ContaDaReceita explicada conferencia={{ ...conferencia, aguardandoTce }} />);
    expect(screen.queryByText('+ aguardando TCE')).not.toBeInTheDocument();
  });
});

describe('SemConferencia', () => {
  it('coleta sem nome conhecido sai como veio, sem sumir', () => {
    render(<SemConferencia ano={2026} faltando={['nova_coleta']} />);
    expect(screen.getByText(/Falta publicar: nova_coleta\./)).toBeInTheDocument();
  });

  // O Farol do TCE-SC tem receitas desde 2018 e empenhos desde 2023: ano anterior nunca vai chegar.
  it('o que a fonte não publica vira "o TCE-SC não publica", sem "ainda", com o primeiro ano de cada', () => {
    render(
      <SemConferencia
        ano={2016}
        faltando={['tcesc_receitas', 'tcesc_empenhos']}
        foraDaFonte={['tcesc_receitas', 'tcesc_empenhos']}
      />,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'O TCE-SC não publica as receitas nem os empenhos de 2016.',
    );
    expect(document.body).toHaveTextContent('receitas a partir de 2018 e empenhos a partir de 2023');
    expect(document.body).not.toHaveTextContent(/ainda/i);
  });

  it('só os empenhos fora da fonte: o título fala só deles', () => {
    render(<SemConferencia ano={2019} faltando={['tcesc_empenhos']} foraDaFonte={['tcesc_empenhos']} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('O TCE-SC não publica os empenhos de 2019.');
  });

  it('sem a lista do que falta, explica do mesmo jeito', () => {
    render(<SemConferencia ano={2026} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ainda não dá para conferir 2026.');
    expect(screen.queryByText(/Falta publicar/)).not.toBeInTheDocument();
  });
});
