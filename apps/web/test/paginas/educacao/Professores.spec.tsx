import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Professores from '../../../src/paginas/educacao/Professores';
import { TEXTO_PROIBIDO } from '../../support/conferidos';
import { professores, professoresIndisponivel } from '../../support/educacao';
import { FetchFake } from '../../support/fetch-fake';

afterEach(() => vi.unstubAllGlobals());

const CAMINHO = '/api/educacao/professores';

const abrir = async (resposta = professores()) => {
  new FetchFake().responder(CAMINHO, resposta).instalar();
  const { container } = render(<Professores />);
  await screen.findByRole('link', { name: /baixar csv/i });
  return container;
};

const bloco = (nome: string | RegExp) => screen.getByRole('region', { name: nome });
const tabelaDa = (nome: RegExp) => screen.getByRole('table', { name: nome });
const tabelaNoBloco = (doBloco: RegExp, nome: RegExp) => within(bloco(doBloco)).getByRole('table', { name: nome });
const escolherRede = (nome: string) => userEvent.click(screen.getByRole('button', { name: nome }));
const SELO = 'fonte única, sem conferência';
const coluna = (figura: RegExp, ano: string) =>
  screen.getByRole('img', { name: figura }).querySelector<HTMLElement>(`[data-ano="${ano}"]`) as HTMLElement;
const abrirDetalhes = (doBloco: RegExp) =>
  userEvent.click(within(bloco(doBloco)).getByRole('button', { name: 'Fonte e detalhes' }));
const setasDa = (tabela: HTMLElement) =>
  Array.from(tabela.closest('.cmp')?.querySelectorAll('.cmp-diante li') ?? []).map((li) => [
    li.textContent,
    li.className,
  ]);
const dicaDa = (figura: RegExp) => screen.getByRole('img', { name: figura }).querySelector('.bpa-dica');

describe('Professores: estados', () => {
  it('enquanto carrega, diz que está carregando', () => {
    const fake = new FetchFake();
    fake.segurar = true;
    fake.responder(CAMINHO, professores()).instalar();

    render(<Professores />);

    expect(screen.getByText('Carregando os números…')).toBeInTheDocument();
  });

  it('com a API fora do ar, mostra o aviso e nenhum número', async () => {
    new FetchFake().responderTexto(CAMINHO, JSON.stringify({ erro: 'Erro interno' }), 500).instalar();

    render(<Professores />);

    expect(await screen.findByText(/Não foi possível carregar: Erro interno/)).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('sem nenhuma coleta, avisa e não mostra bloco nem CSV', async () => {
    new FetchFake().responder(CAMINHO, professoresIndisponivel()).instalar();

    render(<Professores />);

    expect(await screen.findByText(/ainda não foram coletados/)).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /baixar csv/i })).not.toBeInTheDocument();
  });

  it('sem a coleta da RAIS, o bloco some e o resto segue', async () => {
    await abrir(professores({ rais: null, faltando: ['inep_remuneracao'] }));

    expect(screen.queryByRole('region', { name: /2021/ })).not.toBeInTheDocument();
    expect(bloco(/temporári/i)).toBeInTheDocument();
  });

  it('sem os blocos do INEP, o alternador de rede some', async () => {
    await abrir(professores({ turmas: null, horas: null, formacao: null, docentesSuperior: null, regularidade: null }));

    expect(screen.queryByRole('group', { name: 'Rede' })).not.toBeInTheDocument();
    expect(bloco(/temporári/i)).toBeInTheDocument();
  });

  it('o CSV da aba está a um clique', async () => {
    await abrir();

    expect(screen.getByRole('link', { name: /baixar csv/i })).toHaveAttribute('href', '/api/educacao/professores.csv');
  });

  it('nenhuma palavra proibida na página', async () => {
    const container = await abrir();

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
  });

  it('nada de contagem de escolas deduzida do percentual', async () => {
    const container = await abrir();

    expect(container.textContent).not.toMatch(/cerca de \d+ escolas/i);
  });

  it.each([
    /turmas/i,
    /horas de aula/i,
    /alunos por docente/i,
    /quem dá as aulas/i,
    /docentes com curso superior/i,
    /mesma escola/i,
    /temporári/i,
    /salário mediano/i,
    /2021/,
  ])('o bloco %s leva o selo de fonte única no título', async (nome) => {
    await abrir();

    expect(within(bloco(nome)).getByRole('button', { name: new RegExp(SELO) })).toBeInTheDocument();
  });
});

describe('Professores: alternador de rede', () => {
  it('abre na rede pública', async () => {
    await abrir();

    expect(screen.getByRole('button', { name: 'Pública' })).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(tabelaNoBloco(/tamanho das turmas/i, /^Anos iniciais, rede pública/)).getByRole('row', {
        name: 'Orleans 18,0 alunos',
      }),
    ).toBeInTheDocument();
  });

  it('trocar a rede muda as turmas, a formação e a regularidade juntas', async () => {
    await abrir();

    await escolherRede('Municipal');

    expect(
      within(tabelaNoBloco(/tamanho das turmas/i, /^Anos iniciais, rede municipal/)).getByRole('row', {
        name: 'Orleans 15,5 alunos',
      }),
    ).toBeInTheDocument();
    expect(
      within(bloco(/quem dá as aulas/i)).getByRole('table', { name: /^Educação infantil, rede municipal/ }),
    ).toBeInTheDocument();
    expect(bloco(/mesma escola/i)).toHaveTextContent(/rede municipal/);
  });

  it('rede sem dado na etapa diz que não tem, sem zero', async () => {
    await abrir();

    await escolherRede('Estadual');

    const turmas = bloco(/tamanho das turmas/i);
    expect(within(turmas).getAllByText('Sem dado nesta rede.').length).toBeGreaterThan(0);
  });
});

describe('Professores: turmas e horas', () => {
  it('a frase compara com SC na rede escolhida, com os números', async () => {
    await abrir();

    expect(bloco(/tamanho das turmas/i)).toHaveTextContent(
      'Na rede pública, Orleans tem menos alunos por turma que Santa Catarina em anos iniciais (18,0 × 22,0).',
    );
  });

  it('horas de aula mostram horas, nos três lugares', async () => {
    await abrir();
    await escolherRede('Todas');

    const tabela = tabelaNoBloco(/horas de aula/i, /^Creche, todas as redes/);
    expect(within(tabela).getByRole('row', { name: 'Orleans 9,1 horas' })).toBeInTheDocument();
    expect(within(tabela).getByRole('row', { name: 'Brasil 7,7 horas' })).toBeInTheDocument();
  });
});

describe('Professores: formação', () => {
  it('a adequação diz que conta aulas, e os docentes com superior, pessoas', async () => {
    await abrir();

    expect(bloco(/quem dá as aulas/i)).toHaveTextContent(/conta as aulas, não as pessoas/);
    expect(bloco(/docentes com curso superior/i)).toHaveTextContent(/conta pessoas, não aulas/);
  });

  it('a nota do art. 62 fica ao lado do grupo 5, com as etapas e sem dizer que é ilegal', async () => {
    await abrir();

    const termo = within(bloco(/quem dá as aulas/i)).getByText('Grupo 5', { selector: 'dt' });
    const definicao = termo.nextElementSibling;
    expect(definicao).toHaveTextContent(/LDB \(art\. 62\)/);
    expect(definicao).toHaveTextContent(/curso normal de nível médio/);
    expect(definicao).toHaveTextContent(/educação infantil e nos cinco primeiros anos do ensino fundamental/);
    expect(definicao).not.toHaveTextContent(/ilegal/i);
  });

  it('o grupo 1 compara a rede escolhida nas etapas', async () => {
    await abrir();

    const tabela = tabelaDa(/^Aulas com licenciatura na área: Educação infantil, rede pública/);
    expect(within(tabela).getByRole('row', { name: 'Orleans 37,0%' })).toBeInTheDocument();
    expect(within(tabela).getByRole('row', { name: 'Santa Catarina 64,0%' })).toBeInTheDocument();
  });

  it('as barras empilhadas têm os cinco grupos nos três lugares, e zero fica escrito', async () => {
    await abrir();

    const tabela = tabelaDa(/^Educação infantil, rede pública: percentual de aulas/);
    expect(within(tabela).getByRole('row', { name: 'Orleans 37,0% 1,0% 42,0% 0,0% 20,0%' })).toBeInTheDocument();
  });

  it('a frase traz o grupo 1 da rede escolhida, Orleans × SC', async () => {
    await abrir();

    expect(bloco(/quem dá as aulas/i)).toHaveTextContent(
      'Na rede pública, na educação infantil, 37,0% das aulas são dadas por professor com licenciatura na área; em Santa Catarina, 64,0%.',
    );
  });
});

describe('Professores: regularidade', () => {
  it('a frase compara rede com rede, com a mesma rede em SC', async () => {
    await abrir();

    await escolherRede('Municipal');

    expect(bloco(/mesma escola/i)).toHaveTextContent(
      'Na rede municipal, 21,4% das escolas de Orleans estão no nível baixo; em Santa Catarina, 19,9%.',
    );
  });

  it('trocar para a estadual muda os dois números', async () => {
    await abrir();

    await escolherRede('Estadual');

    expect(bloco(/mesma escola/i)).toHaveTextContent(
      'Na rede estadual, 80,0% das escolas de Orleans estão no nível baixo; em Santa Catarina, 76,6%.',
    );
  });

  it('diz que é percentual de escolas', async () => {
    await abrir();

    expect(bloco(/mesma escola/i)).toHaveTextContent(/percentual de escolas/);
  });
});

describe('Professores: alunos por docente', () => {
  it('traz o valor por ano, em tabela, na rede municipal', async () => {
    await abrir();

    const tabela = tabelaDa(/^Alunos por docente na creche, rede municipal/);
    expect(within(tabela).getByRole('row', { name: '2025 11,8' })).toBeInTheDocument();
  });

  it('avisa, nos detalhes, que o docente pode contar em mais de uma etapa', async () => {
    await abrir();

    await abrirDetalhes(/alunos por docente/i);

    expect(bloco(/alunos por docente/i)).toHaveTextContent(/pode contar em mais de uma etapa/);
  });

  it('a frase traz o último ano das duas etapas', async () => {
    await abrir();

    expect(bloco(/alunos por docente/i)).toHaveTextContent(
      'Em 2025, a rede municipal tem 11,8 alunos por docente na creche e 11,0 na pré-escola.',
    );
  });

  it('a dica do ano mostra a conta, matrículas e docentes', async () => {
    await abrir();

    await userEvent.hover(coluna(/^Alunos por docente na creche/, '2025'));

    expect(dicaDa(/^Alunos por docente na creche/)).toHaveTextContent('472 matrículas ÷ 40 docentes');
  });

  it('na dica, docente sem dado é travessão, nunca zero', async () => {
    await abrir();

    await userEvent.hover(coluna(/^Alunos por docente na pré-escola/, '2024'));

    expect(dicaDa(/^Alunos por docente na pré-escola/)).toHaveTextContent('500 matrículas ÷ — docentes');
  });

  it('ano sem conta fica sem barra e com travessão', async () => {
    await abrir();

    const tabela = tabelaDa(/^Alunos por docente na pré-escola, rede municipal/);
    expect(within(tabela).getByRole('row', { name: '2024 —' })).toBeInTheDocument();
  });
});

describe('Professores: temporários', () => {
  it('a frase diz "entre os profissionais declarados" e rotula maio', async () => {
    await abrir();

    expect(bloco(/temporári/i)).toHaveTextContent(
      'Entre os profissionais declarados, a parte da carga horária do magistério feita por temporários passou de 10,0% em maio de 2024 para 45,0% em maio de 2026.',
    );
  });

  it('2026 é rotulado como maio, foto e não exercício', async () => {
    await abrir();

    const tabela = tabelaDa(/^Carga horária temporária no magistério/);
    expect(within(tabela).getByRole('row', { name: '2026 45,0%' })).toBeInTheDocument();
    expect(bloco(/temporári/i)).toHaveTextContent(/foto de maio/);
    expect(bloco(/temporári/i)).toHaveTextContent(/não o exercício/);
  });

  it('carga de 0% é zero, não travessão', async () => {
    await abrir();

    const tabela = tabelaDa(/^Carga horária temporária dos outros profissionais/);
    expect(within(tabela).getByRole('row', { name: '2025 0,0%' })).toBeInTheDocument();
  });

  it('a dica da barra diz a foto de maio e quantos profissionais foram declarados', async () => {
    await abrir();

    await userEvent.hover(coluna(/^Carga horária temporária no magistério/, '2026'));

    expect(dicaDa(/^Carga horária temporária no magistério/)).toHaveTextContent(
      'Foto de maio de 2026: 150 profissionais declarados',
    );
  });

  it('a dica traz o texto da fonte quando os profissionais são menos de 5', async () => {
    await abrir();

    await userEvent.hover(coluna(/^Carga horária temporária dos outros/, '2024'));

    expect(dicaDa(/^Carga horária temporária dos outros/)).toHaveTextContent('menos de 5 profissionais declarados');
  });

  it('nos detalhes, os profissionais trazem o texto da fonte quando são menos de 5', async () => {
    await abrir();

    await abrirDetalhes(/temporári/i);

    expect(bloco(/temporári/i)).toHaveTextContent(/menos de 5 em maio de 2024/);
  });
});

describe('Professores: remuneração', () => {
  it('a frase traz efetivo e temporário do último maio, em reais nominais', async () => {
    await abrir();

    const remuneracao = bloco(/salário mediano/i);
    expect(remuneracao.textContent?.replace(/\s/g, ' ')).toContain(
      'Em maio de 2026, no magistério: R$ 6.600,50 para efetivos e R$ 6.100,25 para temporários, por 40 horas semanais.',
    );
    expect(remuneracao).toHaveTextContent(/nominais/);
  });

  it('a dica da mediana traz os centavos e a foto de maio', async () => {
    await abrir();

    await userEvent.hover(coluna(/magistério, efetivos/i, '2026'));

    expect(dicaDa(/magistério, efetivos/i)?.textContent?.replace(/\s/g, ' ')).toContain(
      'R$ 6.600,50 na foto de maio de 2026',
    );
  });

  it('cada gráfico da mediana diz no título que é a foto de maio', async () => {
    await abrir();

    expect(
      within(bloco(/salário mediano/i)).getByRole('heading', { level: 3, name: /^Magistério, efetivos/ }),
    ).toHaveTextContent(/foto de maio/);
  });

  it('mediana nula fica sem barra e com travessão', async () => {
    await abrir();

    const figura = screen.getByRole('img', { name: /outros profissionais, temporários/i });
    expect(figura.querySelectorAll('.bpa-barra')).toHaveLength(2);
    const tabela = tabelaDa(/outros profissionais, temporários/i);
    expect(within(tabela).getByRole('row', { name: '2025 —' })).toBeInTheDocument();
  });

  it('explica a regra das 10 pessoas nos detalhes e diz que são os profissionais declarados', async () => {
    await abrir();

    await abrirDetalhes(/salário mediano/i);

    expect(bloco(/salário mediano/i)).toHaveTextContent(/menos de 10 pessoas/);
    expect(bloco(/salário mediano/i)).toHaveTextContent(/entre os profissionais declarados/);
  });
});

describe('Professores: RAIS', () => {
  it('diz que a base é outra, e o ano', async () => {
    await abrir();

    expect(bloco(/2021/)).toHaveTextContent(/outra base/);
    expect(bloco(/2021/)).toHaveTextContent(/não se compara/);
  });

  it('SC aparece como rede pública, e os detalhes dizem por que não há linha municipal', async () => {
    await abrir();
    await abrirDetalhes(/2021/);

    const rais = bloco(/2021/);
    expect(within(rais).getByText('Toda a rede pública de SC')).toBeInTheDocument();
    expect(rais).toHaveTextContent(/não tem linha municipal/);
  });

  it('os três valores ficam em reais, com centavos', async () => {
    await abrir();

    const rais = bloco(/2021/);
    expect(
      within(rais).getByText('Rede municipal de Orleans').nextElementSibling?.textContent?.replace(/\s/g, ' '),
    ).toContain('R$ 3.900,50');
    expect(
      within(rais).getByText('Redes municipais do Brasil').nextElementSibling?.textContent?.replace(/\s/g, ' '),
    ).toContain('R$ 5.150,75');
  });

  it('média sem dado é travessão, nunca zero', async () => {
    const resposta = professores();
    await abrir(
      professores({
        rais: resposta.rais && {
          ...resposta.rais,
          linhas: resposta.rais.linhas.map((l) => (l.lugar === 'brasil' ? { ...l, mediaPor40h: null } : l)),
        },
      }),
    );

    expect(within(bloco(/2021/)).getByText('Redes municipais do Brasil').nextElementSibling).toHaveTextContent('—');
  });
});

describe('Professores: setas diante de SC e do Brasil', () => {
  it('aulas com licenciatura na área abaixo de SC descem a seta como pior: mais é melhor', async () => {
    await abrir();

    expect(setasDa(tabelaDa(/^Aulas com licenciatura na área: Educação infantil, rede pública/))).toEqual([
      ['▼ 27,0 pontos abaixo de SC', 'ruim'],
      ['▼ 32,0 pontos abaixo do Brasil', 'ruim'],
    ]);
  });

  it('docentes com curso superior abaixo de SC descem a seta como pior', async () => {
    await abrir();

    expect(setasDa(tabelaNoBloco(/docentes com curso superior/i, /^Ensino médio, rede pública/))).toEqual([
      ['▼ 2,0 pontos abaixo de SC', 'ruim'],
      ['▼ 4,0 pontos abaixo do Brasil', 'ruim'],
    ]);
  });

  it.each([/tamanho das turmas/i, /horas de aula/i, /mesma escola/i, /temporári/i, /salário mediano/i, /2021/])(
    'o bloco %s não leva seta: não há melhor óbvio',
    async (nome) => {
      await abrir();
      await escolherRede('Todas');

      expect(bloco(nome).querySelector('.cmp-diante')).toBeNull();
    },
  );
});
