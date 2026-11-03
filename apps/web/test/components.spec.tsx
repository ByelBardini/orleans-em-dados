import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Meta } from '@orleans-em-dados/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Alternador,
  BarraDividida,
  BarrasMensais,
  escala,
  Estado,
  Filtros,
  Fonte,
  LinhaAcumulada,
  ListaPontos,
  Numero,
  SeletorTema,
} from '../src/components';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  vi.unstubAllGlobals();
});

describe('escala', () => {
  it('escolhe passo redondo e topo acima do máximo', () => {
    expect(escala(34, 3)).toEqual({ topo: 40, passos: [20] });
  });

  it('o topo sempre deixa folga sobre o máximo', () => {
    const { topo } = escala(100, 4);
    expect(topo).toBeGreaterThan(100);
  });

  it.each([0, -5, Number.NaN])('máximo %s não tem marcas e o topo não é zero', (maximo) => {
    expect(escala(maximo)).toEqual({ topo: 1, passos: [] });
  });
});

describe('Estado', () => {
  it('carregando avisa que está carregando', () => {
    render(<Estado carregando erro={null} />);
    expect(screen.getByText('Carregando os números…')).toBeInTheDocument();
  });

  it('erro tem prioridade e cita a mensagem', () => {
    render(<Estado carregando erro="HTTP 502" />);
    expect(screen.getByText('Não foi possível carregar: HTTP 502')).toBeInTheDocument();
    expect(screen.queryByText('Carregando os números…')).not.toBeInTheDocument();
  });

  it('sem carregar nem erro, não mostra nada', () => {
    const { container } = render(<Estado carregando={false} erro={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Numero', () => {
  it('mostra rótulo, valor, detalhe e selo', () => {
    render(
      <Numero rotulo="Arrecadado" detalhe="no ano" selo={<em>selo</em>}>
        171,1
      </Numero>,
    );
    expect(screen.getByText('Arrecadado')).toBeInTheDocument();
    expect(screen.getByText('171,1')).toBeInTheDocument();
    expect(screen.getByText('no ano')).toBeInTheDocument();
    expect(screen.getByText('selo')).toBeInTheDocument();
  });

  it.each([
    [150, '100%'],
    [-10, '0%'],
    [40, '40%'],
  ])('barra de %s fica limitada entre 0 e 100: %s', (barra, largura) => {
    const { container } = render(
      <Numero rotulo="x" barra={barra}>
        1
      </Numero>,
    );
    expect(container.querySelector('.trilho span')).toHaveStyle({ width: largura });
  });

  it('barra zero ainda desenha o trilho', () => {
    const { container } = render(
      <Numero rotulo="x" barra={0}>
        1
      </Numero>,
    );
    expect(container.querySelector('.trilho')).toBeInTheDocument();
  });
});

describe('ListaPontos', () => {
  const itens = [
    { nome: 'Saúde', valor: 2_000_000 },
    { nome: 'Educação', valor: 1_000_000 },
  ];

  it('mostra nome e valor em milhões', () => {
    render(<ListaPontos itens={itens} />);
    expect(screen.getByText('Saúde')).toBeInTheDocument();
    expect(screen.getByText('2,0')).toBeInTheDocument();
  });

  it('com comUnidade, o valor diz que está em milhões', () => {
    const { container } = render(<ListaPontos comUnidade itens={itens} />);
    expect(container.querySelector('.lp-valor')).toHaveTextContent(/^2,0 mi$/);
  });

  it('com comUnidade, valor nulo continua só com o travessão', () => {
    const { container } = render(<ListaPontos comUnidade itens={[{ nome: 'Fora', valor: null }]} />);
    expect(container.querySelector('.lp-valor')).toHaveTextContent(/^—$/);
  });

  it('sem comUnidade, a unidade fica com a legenda da seção', () => {
    const { container } = render(<ListaPontos itens={itens} />);
    expect(container.querySelector('.lp-valor')).toHaveTextContent(/^2,0$/);
  });

  it('o trilho é proporcional ao maior item', () => {
    const { container } = render(<ListaPontos itens={itens} />);
    const barras = container.querySelectorAll('.trilho span');
    expect(barras[0]).toHaveStyle({ width: '100%' });
    expect(barras[1]).toHaveStyle({ width: '50%' });
  });

  it('valor negativo não desenha barra para trás', () => {
    const { container } = render(<ListaPontos itens={[...itens, { nome: 'Ajuste', valor: -500 }]} />);
    expect(container.querySelectorAll('.trilho span')[2]).toHaveStyle({ width: '0%' });
  });

  it('valor nulo sai com travessão e sem percentual, e não como zero', () => {
    const { container } = render(<ListaPontos itens={[{ nome: 'Fora', valor: null }]} total={4_000_000} />);
    expect(container.querySelector('.lp-valor')).toHaveTextContent('—');
    expect(container.querySelector('.lp-pct')).toBeNull();
  });

  it('com total, mostra o percentual', () => {
    render(<ListaPontos itens={itens} total={4_000_000} />);
    expect(screen.getByText('50,0%')).toBeInTheDocument();
  });

  it('com aoClicar, o nome vira botão que entrega o item', async () => {
    const aoClicar = vi.fn();
    render(<ListaPontos itens={itens} aoClicar={aoClicar} />);

    await userEvent.click(screen.getByRole('button', { name: 'Educação' }));

    expect(aoClicar).toHaveBeenCalledWith(itens[1]);
  });

  it('sem aoClicar, o nome não é botão', () => {
    render(<ListaPontos itens={itens} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Alternador', () => {
  const opcoes = [
    { valor: '', nome: 'Todas' },
    { valor: '728', nome: 'Prefeitura' },
  ];

  it('marca a opção ativa', () => {
    render(<Alternador rotulo="Entidade" opcoes={opcoes} valor="728" aoMudar={() => {}} />);
    expect(screen.getByRole('button', { name: 'Prefeitura' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicar avisa com o valor da opção', async () => {
    const aoMudar = vi.fn();
    render(<Alternador rotulo="Entidade" opcoes={opcoes} valor="" aoMudar={aoMudar} />);

    await userEvent.click(screen.getByRole('button', { name: 'Prefeitura' }));

    expect(aoMudar).toHaveBeenCalledWith('728');
  });
});

describe('Filtros', () => {
  const props = {
    anos: [2026, 2025],
    ano: 2025,
    setAno: () => {},
    entidades: [{ codigo: '728', sigla: 'Prefeitura', nome: 'Prefeitura Municipal' }],
    entidade: '',
    setEntidade: () => {},
  };

  it('trocar o ano avisa com o número', async () => {
    const setAno = vi.fn();
    render(<Filtros {...props} setAno={setAno} />);

    await userEvent.selectOptions(screen.getByLabelText('Ano'), '2026');

    expect(setAno).toHaveBeenCalledWith(2026);
  });

  it('entidade tem a opção Todas, além das do catálogo', () => {
    render(<Filtros {...props} />);
    const grupo = screen.getByRole('group', { name: 'Entidade' });
    expect(
      within(grupo)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Todas', 'Prefeitura']);
  });

  it('sem anos nem entidades, não oferece os campos', () => {
    render(<Filtros {...props} anos={[]} entidades={[]} />);
    expect(screen.queryByLabelText('Ano')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});

const META: Meta = {
  coletaId: 1,
  fonte: 'Portal da Transparência Betha — Orleans/SC',
  consultaId: 57153,
  consultaNome: 'Receitas Orçamentárias',
  urlOrigem: 'https://transparencia.betha.cloud/consulta/57153',
  ano: 2025,
  filtro: { ano: ['2025'] },
  origem: 'api',
  iniciadoEm: '2025-03-01T12:00:00.000Z',
  coletadoEm: '2025-03-01T12:00:00.000Z',
  totalHits: 1469,
  capturados: 1469,
  idsUnicos: 1469,
  camposAusentes: {},
  status: 'totalizador_conciliado',
  exemplo: false,
  conferencia: [{ campo: 'valor', titulo: null, fonte: 10, calculado: 10, diferenca: 0 }],
};

describe('Fonte', () => {
  it('diz de onde vem, com link para a consulta original', () => {
    render(<Fonte meta={META} />);
    expect(screen.getByText(/Portal da Transparência Betha/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Receitas Orçamentárias (57153)', hidden: true })).toHaveAttribute(
      'href',
      'https://transparencia.betha.cloud/consulta/57153',
    );
  });

  it('o nível da conferência vem por extenso, sob o rótulo "Conferência"', () => {
    render(<Fonte meta={META} />);
    const nivel = screen.getByText('Somatório conciliado com o totalizador da fonte');
    expect(nivel.previousElementSibling).toHaveTextContent(/^Conferência$/);
  });

  it('status sem texto próprio aparece como veio', () => {
    render(<Fonte meta={{ ...META, status: 'outro' }} />);
    expect(screen.getByText('outro')).toBeInTheDocument();
  });

  it('sem meta, não mostra nada', () => {
    const { container } = render(<Fonte meta={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SeletorTema', () => {
  const sistema = (escuro: boolean) => vi.stubGlobal('matchMedia', () => ({ matches: escuro }));

  it('sem escolha salva, segue o sistema', () => {
    sistema(true);
    render(<SeletorTema />);
    expect(screen.getByRole('button', { name: 'Usar tema claro' })).toBeInTheDocument();
  });

  it('trocar aplica o tema, salva a escolha e inverte o botão', async () => {
    sistema(false);
    render(<SeletorTema />);

    await userEvent.click(screen.getByRole('button', { name: 'Usar tema escuro' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('tema')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Usar tema claro' })).toBeInTheDocument();
  });

  it('localStorage bloqueado não impede a troca', async () => {
    sistema(false);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    render(<SeletorTema />);

    await userEvent.click(screen.getByRole('button', { name: 'Usar tema escuro' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    setItem.mockRestore();
  });
});

describe('gráficos', () => {
  const meses = [
    { rotulo: 'jan', nome: 'janeiro', a: 2_000_000, b: 1_000_000 },
    { rotulo: 'fev', nome: 'fevereiro', a: null, b: 500_000 },
  ];

  it('BarrasMensais descreve o gráfico para quem não enxerga e mostra a dica ao passar o mouse', async () => {
    const { container } = render(
      <BarrasMensais meses={meses} series={['Arrecadado', 'Empenhado']} descricao="Mês a mês" />,
    );

    expect(screen.getByRole('img', { name: 'Mês a mês' })).toBeInTheDocument();
    await userEvent.hover(container.querySelector('.barras-mes-grupo') as Element);

    expect(screen.getByText('janeiro')).toBeInTheDocument();
    expect(screen.getByText('Arrecadado: R$ 2,0 mi')).toBeInTheDocument();
  });

  it('LinhaAcumulada sem meta não mostra o previsto', () => {
    render(
      <LinhaAcumulada
        acumulado={[1_000_000, 2_000_000]}
        meta={0}
        rotulos={['jan', 'fev']}
        nomes={['janeiro', 'fevereiro']}
        descricao="Acumulado"
      />,
    );
    expect(screen.queryByText(/Previsto/)).not.toBeInTheDocument();
    expect(screen.getByText('2,0')).toBeInTheDocument();
  });

  it('LinhaAcumulada com meta mostra o previsto', () => {
    render(
      <LinhaAcumulada
        acumulado={[1_000_000]}
        meta={12_000_000}
        rotulos={['jan']}
        nomes={['janeiro']}
        descricao="Acumulado"
      />,
    );
    expect(screen.getByText('Previsto: 12,0')).toBeInTheDocument();
  });

  describe('LinhaAcumulada: dica do mês', () => {
    const ROTULOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const NOMES = [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ];
    const abrirLinha = (acumulado: number[], meta: number) => {
      const { container } = render(
        <LinhaAcumulada acumulado={acumulado} meta={meta} rotulos={ROTULOS} nomes={NOMES} descricao="Acumulado" />,
      );
      const zona = (i: number) => container.querySelectorAll('.linha-zona')[i] as HTMLElement;
      return { container, zona };
    };

    it('o mês abaixo do ritmo diz arrecadado, previsto e quanto falta', async () => {
      const { container, zona } = abrirLinha([1_000_000, 2_000_000, 3_000_000], 60_000_000);

      await userEvent.hover(zona(2));

      const dica = container.querySelector('.dica') as HTMLElement;
      expect(dica).toHaveTextContent('Até março');
      expect(dica).toHaveTextContent('Arrecadado: R$ 3,0 mi');
      expect(dica).toHaveTextContent('Previsto: R$ 15,0 mi');
      expect(dica).toHaveTextContent('R$ 12,0 mi atrás do ritmo');
    });

    it('o mês acima do ritmo diz que está à frente', async () => {
      const { container, zona } = abrirLinha([3_000_000], 12_000_000);

      await userEvent.hover(zona(0));

      expect(container.querySelector('.dica')).toHaveTextContent('R$ 2,0 mi à frente do ritmo');
    });

    it('a diferença bate com os dois números arredondados da dica', async () => {
      const { container, zona } = abrirLinha([140_449_999], 12 * 164_360_000);

      await userEvent.hover(zona(0));

      const dica = container.querySelector('.dica') as HTMLElement;
      expect(dica).toHaveTextContent('Arrecadado: R$ 140,4 mi');
      expect(dica).toHaveTextContent('Previsto: R$ 164,4 mi');
      expect(dica).toHaveTextContent('R$ 24,0 mi atrás do ritmo');
    });

    it('mês ainda sem arrecadação mostra só o previsto, sem virar zero', async () => {
      const { container, zona } = abrirLinha([1_000_000], 60_000_000);

      await userEvent.hover(zona(11));

      const dica = container.querySelector('.dica') as HTMLElement;
      expect(dica).toHaveTextContent('Até dezembro');
      expect(dica).toHaveTextContent('Previsto: R$ 60,0 mi');
      expect(dica).not.toHaveTextContent('Arrecadado');
      expect(dica).not.toHaveTextContent('ritmo');
    });

    it('sem meta, a dica mostra só o arrecadado', async () => {
      const { container, zona } = abrirLinha([1_000_000], 0);

      await userEvent.hover(zona(0));

      const dica = container.querySelector('.dica') as HTMLElement;
      expect(dica).toHaveTextContent('Arrecadado: R$ 1,0 mi');
      expect(dica).not.toHaveTextContent('Previsto');
      expect(dica).not.toHaveTextContent('ritmo');
    });

    it('a guia vertical fica na posição do mês', async () => {
      const { container, zona } = abrirLinha([1_000_000], 60_000_000);

      await userEvent.hover(zona(11));

      expect(container.querySelector('.linha-guia')).toHaveStyle({ left: '100%' });
    });

    it('tirar o mouse some com a dica e com a guia', async () => {
      const { container, zona } = abrirLinha([1_000_000], 60_000_000);

      await userEvent.hover(zona(0));
      await userEvent.unhover(zona(0));

      expect(container.querySelector('.dica')).toBeNull();
      expect(container.querySelector('.linha-guia')).toBeNull();
    });

    it('tocar no mês mantém a dica aberta', async () => {
      const { container, zona } = abrirLinha([1_000_000], 60_000_000);

      await userEvent.click(zona(0));

      expect(container.querySelector('.dica')).toHaveTextContent('Até janeiro');
    });
  });

  it('BarraDividida esconde as partes zeradas e mostra o percentual das outras', () => {
    render(
      <BarraDividida
        descricao="Por entidade"
        total={4_000_000}
        partes={[
          { nome: 'Prefeitura', valor: 3_000_000, classe: 'a' },
          { nome: 'Câmara', valor: 1_000_000, classe: 'b', detalhe: 'TCE-SC' },
          { nome: 'Vazia', valor: 0, classe: 'c' },
        ]}
      />,
    );
    expect(screen.getByText('3,0 mi · 75,0%')).toBeInTheDocument();
    expect(screen.getByText('(TCE-SC)')).toBeInTheDocument();
    expect(screen.queryByText('Vazia')).not.toBeInTheDocument();
  });
});
