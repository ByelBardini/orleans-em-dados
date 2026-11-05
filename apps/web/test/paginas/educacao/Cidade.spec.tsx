import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Cidade from '../../../src/paginas/educacao/Cidade';
import { TEXTO_PROIBIDO } from '../../support/conferidos';
import { cidade, cidadeIndisponivel } from '../../support/educacao';
import { FetchFake } from '../../support/fetch-fake';

afterEach(() => vi.unstubAllGlobals());

const CAMINHO = '/api/educacao/cidade';

const abrir = async (resposta = cidade()) => {
  new FetchFake().responder(CAMINHO, resposta).instalar();
  const { container } = render(<Cidade />);
  await screen.findByRole('link', { name: /baixar csv/i });
  return container;
};

const bloco = (nome: string | RegExp) => screen.getByRole('region', { name: nome });
const itemDe = (lista: HTMLElement, rotulo: string) =>
  within(lista).getByText(rotulo, { selector: '.edu-cidade-rotulo-barra' }).closest('li') as HTMLElement;
const SELO = 'fonte única, sem conferência';
type Dados = ReturnType<typeof cidade>;
const comOferta = (trocas: Partial<NonNullable<Dados['oferta']>>) => {
  const dados = cidade();
  return cidade({ oferta: { ...(dados.oferta as NonNullable<Dados['oferta']>), ...trocas } });
};
const comMoradores = (trocas: Partial<NonNullable<Dados['moradores']>>) => {
  const dados = cidade();
  return cidade({ moradores: { ...(dados.moradores as NonNullable<Dados['moradores']>), ...trocas } });
};
const comIgc = (trocas: Partial<NonNullable<Dados['igc']>>) => {
  const dados = cidade();
  return cidade({ igc: { ...(dados.igc as NonNullable<Dados['igc']>), ...trocas } });
};

describe('Cidade: estados', () => {
  it('enquanto carrega, diz que está carregando', () => {
    const fake = new FetchFake();
    fake.segurar = true;
    fake.responder(CAMINHO, cidade()).instalar();

    render(<Cidade />);

    expect(screen.getByText('Carregando os números…')).toBeInTheDocument();
  });

  it('com a API fora do ar, mostra o aviso e nenhum número', async () => {
    new FetchFake().responderTexto(CAMINHO, JSON.stringify({ erro: 'Erro interno' }), 500).instalar();

    render(<Cidade />);

    expect(await screen.findByText(/Não foi possível carregar: Erro interno/)).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('sem nenhuma coleta, avisa e não mostra bloco nem CSV', async () => {
    new FetchFake().responder(CAMINHO, cidadeIndisponivel()).instalar();

    render(<Cidade />);

    expect(await screen.findByText(/ainda não foram coletados/)).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /baixar csv/i })).not.toBeInTheDocument();
  });

  it('sem o lote do ensino superior, a oferta some e os moradores seguem', async () => {
    await abrir(cidade({ oferta: null, igc: null, cursos: null, faltando: ['inep_superior'] }));

    expect(screen.queryByRole('region', { name: /cursos oferecidos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /nota da instituição/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /não se somam/i })).not.toBeInTheDocument();
    expect(bloco(/moradores que fazem faculdade/i)).toBeInTheDocument();
  });

  it('o CSV da aba está a um clique', async () => {
    await abrir();

    expect(screen.getByRole('link', { name: /baixar csv/i })).toHaveAttribute('href', '/api/educacao/cidade.csv');
  });

  it('nenhuma palavra proibida na página', async () => {
    const container = await abrir();

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
  });

  it('nada de cor, raça ou deficiência na página', async () => {
    const container = await abrir();

    expect(container.textContent).not.toMatch(/\bcor\b|raça|deficiência/i);
  });

  it('o título avisa que a aba junta dois assuntos', async () => {
    await abrir();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/dois assuntos/i);
  });

  it.each([
    [/saber ler e escrever/i],
    [/quantos anos estudaram/i],
    [/moradores que fazem faculdade/i],
    [/cursos oferecidos/i],
    [/nota da instituição/i],
    [/matrículas por curso/i],
  ])('o bloco %s traz o selo de fonte única no título', async (nome) => {
    await abrir();

    expect(within(bloco(nome)).getByText(SELO)).toBeInTheDocument();
  });
});

describe('Cidade: alfabetização', () => {
  it('a taxa dos três lugares vem escrita, com duas casas, como a fonte', async () => {
    await abrir();

    const texto = bloco(/saber ler e escrever/i).textContent;
    expect(texto).toContain('97,27%');
    expect(texto).toContain('SC 97,33%');
    expect(texto).toContain('Brasil 93,01%');
  });

  it('diz quantos moradores não sabem ler e escrever', async () => {
    await abrir();

    expect(bloco(/saber ler e escrever/i)).toHaveTextContent('512 moradores com 15 anos ou mais');
  });

  it('sem a contagem, a frase dos moradores sai, sem dizer zero', async () => {
    const dados = cidade();
    await abrir(
      cidade({
        alfabetizacao: { ...(dados.alfabetizacao as NonNullable<Dados['alfabetizacao']>), naoAlfabetizados: null },
      }),
    );

    expect(bloco(/saber ler e escrever/i).textContent).not.toMatch(/\b0 moradores|não sabem/);
  });

  it('a frase da idade aponta a menor taxa de Orleans, dos dados', async () => {
    await abrir();

    expect(bloco(/saber ler e escrever/i)).toHaveTextContent('A menor taxa por idade é a de 75 anos ou mais: 88,75%.');
  });

  const quadroDa = (grupo: 'Por grupo' | 'Por idade') =>
    within(bloco(/saber ler e escrever/i)).getByRole('table', { name: `Sabem ler e escrever, 2022, ${grupo}` });
  const linhaNo = (quadro: HTMLElement, nome: string) =>
    within(quadro)
      .getAllByRole('row')
      .find((linha) => within(linha).queryByRole('rowheader', { name: new RegExp(`^${nome}`) })) as HTMLElement;
  const celulasDa = (linha: HTMLElement) =>
    within(linha)
      .getAllByRole('cell')
      .map((c) => c.textContent);

  it('grupo e idade viram dois quadros, com os nomes da tela e Orleans, SC e Brasil lado a lado', async () => {
    await abrir();

    expect(celulasDa(linhaNo(quadroDa('Por grupo'), 'Área rural'))).toEqual(['96,62%', '97,00%', '90,00%']);
    expect(celulasDa(linhaNo(quadroDa('Por idade'), '75 anos ou mais'))).toEqual(['88,75%', '97,00%', '90,00%']);
  });

  it('a faixa sem dado nos três lugares fica com travessão, nunca zero, e sem seta', async () => {
    await abrir();

    const linha = linhaNo(quadroDa('Por idade'), '18 e 19 anos');
    expect(celulasDa(linha)).toEqual(['—', '—', '—']);
    expect(linha.querySelector('.cmp-diante')).toBeNull();
  });

  it('cada faixa diz, com seta, onde Orleans fica diante de SC e do Brasil: mais é melhor', async () => {
    await abrir();

    const rural = linhaNo(quadroDa('Por grupo'), 'Área rural');
    const diante = within(rural.nextElementSibling as HTMLElement).getAllByRole('listitem');
    expect(diante.map((li) => li.textContent)).toEqual(['▼ 0,4 ponto abaixo de SC', '▲ 6,6 pontos acima do Brasil']);
    expect(diante[0]).toHaveClass('ruim');
    expect(diante[1]).toHaveClass('bom');
  });

  it('o total de 15 anos ou mais também leva a seta diante de SC e do Brasil', async () => {
    await abrir();

    const numeros = bloco(/saber ler e escrever/i).querySelector('.edu-cidade-numeros') as HTMLElement;
    expect(
      within(numeros)
        .getByText(/abaixo de SC/)
        .closest('li'),
    ).toHaveTextContent('▼ 0,1 ponto abaixo de SC');
    expect(
      within(numeros)
        .getByText(/acima do Brasil/)
        .closest('li'),
    ).toHaveClass('bom');
  });

  it('avisa que a faixa de 75 anos está dentro da de 65', async () => {
    await abrir();

    expect(bloco(/saber ler e escrever/i)).toHaveTextContent(/75 anos ou mais estão também em 65 anos ou mais/);
  });
});

describe('Cidade: anos de estudo e instrução', () => {
  it('anos de estudo saem em anos', async () => {
    await abrir();

    const tabela = screen.getByRole('table', { name: /^25 anos ou mais/ });
    expect(within(tabela).getByRole('row', { name: 'Orleans 9,5 anos' })).toBeInTheDocument();
  });

  it('anos de estudo levam a seta: mais anos é melhor', async () => {
    await abrir();

    const quantos = bloco(/quantos anos estudaram/i);
    const [abaixo] = within(quantos).getAllByText(/6,9% abaixo de SC/);
    expect(abaixo?.closest('li')).toHaveClass('ruim');
  });

  it.each([
    ['Curso superior completo', '▼ 1,0 ponto abaixo de SC', 'ruim'],
    ['Ensino médio completo ou mais', '▼ 5,0 pontos abaixo de SC', 'ruim'],
    ['Sem instrução ou fundamental incompleto', '▲ 4,0 pontos acima de SC', 'ruim'],
  ])('o nível %s leva a seta no sentido do que é melhor', async (nivel, texto, tom) => {
    await abrir();

    const lista = screen.getByRole('list', { name: new RegExp(`^${nivel}`) });
    const seta = (lista.parentElement as HTMLElement).querySelector('.cmp-diante li') as HTMLElement;
    expect(seta).toHaveTextContent(texto);
    expect(seta).toHaveClass(tom);
  });

  it('com menos gente sem instrução que SC, a seta de Orleans é a boa', async () => {
    const dados = cidade();
    const escolaridade = dados.escolaridade as NonNullable<Dados['escolaridade']>;
    await abrir(
      cidade({
        escolaridade: {
          ...escolaridade,
          niveis: escolaridade.niveis.map((n) =>
            n.nivel === 'sem_instrucao'
              ? {
                  ...n,
                  comparacao: {
                    ...n.comparacao,
                    porRede: { todas: { orleans: 30, santaCatarina: 31.5, brasil: 34.5 } },
                  },
                }
              : n,
          ),
        },
      }),
    );

    const lista = screen.getByRole('list', { name: /^Sem instrução/ });
    const seta = (lista.parentElement as HTMLElement).querySelector('.cmp-diante li') as HTMLElement;
    expect(seta).toHaveTextContent('▼ 1,5 ponto abaixo de SC');
    expect(seta).toHaveClass('bom');
  });

  it('o nível traz o percentual e o denominador em pessoas', async () => {
    await abrir();

    const quantos = bloco(/quantos anos estudaram/i);
    const superior = within(quantos).getByRole('list', { name: /^Curso superior completo/ });
    expect(itemDe(superior, 'Orleans')).toHaveTextContent('Orleans 21,5%');
    expect(itemDe(superior, 'Brasil')).toHaveTextContent('Brasil 19,5%');
    await userEvent.click(within(quantos).getByRole('button', { name: 'Fonte e detalhes' }));
    expect(quantos).toHaveTextContent('15.000 moradores com 25 anos ou mais');
  });

  it('a barra de Orleans é a vermelha; SC e Brasil, não', async () => {
    await abrir();

    const superior = screen.getByRole('list', { name: /^Curso superior completo/ });
    expect(itemDe(superior, 'Orleans')).toHaveClass('orleans');
    expect(itemDe(superior, 'Santa Catarina')).not.toHaveClass('orleans');
  });

  it('passar o mouse no nível abre a dica com o lugar e o valor; sair fecha', async () => {
    await abrir();

    const medio = screen.getByRole('list', { name: /^Ensino médio completo ou mais/ });
    await userEvent.hover(itemDe(medio, 'Santa Catarina'));
    expect(medio.querySelector('.edu-cidade-dica')).toHaveTextContent('Santa Catarina53,5%');
    expect(itemDe(medio, 'Santa Catarina')).toHaveClass('is-ativa');

    await userEvent.unhover(itemDe(medio, 'Santa Catarina'));
    expect(medio.querySelector('.edu-cidade-dica')).toBeNull();
  });

  it('o teclado também abre a dica, pelo foco no item', async () => {
    await abrir();

    const medio = screen.getByRole('list', { name: /^Ensino médio completo ou mais/ });
    itemDe(medio, 'Orleans').focus();

    expect(await within(medio).findByText('48,5%', { selector: '.edu-cidade-dica *' })).toBeInTheDocument();
  });

  it('avisa que os níveis não somam 100%', async () => {
    await abrir();

    expect(bloco(/quantos anos estudaram/i)).toHaveTextContent(/não somam 100%/);
  });
});

describe('Cidade: moradores na faculdade', () => {
  it('traz as contagens da graduação e da pós', async () => {
    await abrir();

    const moradores = bloco(/moradores que fazem faculdade/i);
    expect(moradores).toHaveTextContent('580 moradores cursam graduação');
    expect(moradores).toHaveTextContent('395 fazem a graduação em Orleans');
    expect(moradores).toHaveTextContent('186 fazem em outro município');
    expect(moradores).toHaveTextContent('110 fazem especialização, mestrado ou doutorado (40 em outro município)');
  });

  it('quando as partes não fecham, a nota mostra a conta e explica pela amostra', async () => {
    await abrir();

    expect(bloco(/moradores que fazem faculdade/i)).toHaveTextContent(
      '395 + 186 = 581, e o total é 580: o Censo é amostra, e cada número vem arredondado.',
    );
  });

  it('quando as partes fecham, não há nota de arredondamento', async () => {
    await abrir(comMoradores({ graduacao: 581 }));

    expect(bloco(/moradores que fazem faculdade/i).textContent).not.toMatch(/arredondado/);
  });

  it('sem uma das partes, a nota não faz conta', async () => {
    await abrir(comMoradores({ emOutroMunicipio: null }));

    expect(bloco(/moradores que fazem faculdade/i).textContent).not.toMatch(/arredondado/);
  });

  it('graduação em outro município compara os três lugares', async () => {
    await abrir();

    const lista = screen.getByRole('list', { name: /^Dos moradores na graduação/ });
    expect(itemDe(lista, 'Orleans')).toHaveTextContent('Orleans 32,1%');
    expect(itemDe(lista, 'Santa Catarina')).toHaveTextContent('Santa Catarina 26,9%');
    expect(itemDe(lista, 'Brasil')).toHaveTextContent('Brasil 27,2%');
  });
});

describe('Cidade: moradores e oferta lado a lado', () => {
  it('os dois números ficam separados, cada um com o próprio ano', async () => {
    await abrir();

    const lado = bloco(/não se somam/i);
    const moradores = within(lado).getByText('Moradores de Orleans na graduação').closest('div') as HTMLElement;
    const oferta = within(lado).getByText('Matrículas nos cursos presenciais em Orleans').closest('div') as HTMLElement;
    expect(moradores).toHaveTextContent('2022');
    expect(moradores).toHaveTextContent('580');
    expect(oferta).toHaveTextContent('2024');
    expect(oferta).toHaveTextContent('1.400');
  });

  it('nenhum total junta moradores e oferta', async () => {
    const container = await abrir();

    // 580 + 1.400
    expect(container.textContent).not.toMatch(/1\.980/);
  });
});

describe('Cidade: oferta', () => {
  it('a natureza da instituição é a do campo do INEP', async () => {
    await abrir();

    expect(bloco(/cursos oferecidos/i)).toHaveTextContent(
      'Oferta presencial na cidade: FICTICIA, instituição privada sem fins lucrativos.',
    );
  });

  it('sem o campo, a frase não diz a natureza', async () => {
    await abrir(comOferta({ natureza: null }));

    const oferta = bloco(/cursos oferecidos/i);
    expect(oferta).toHaveTextContent('Oferta presencial na cidade: FICTICIA.');
    expect(oferta.textContent).not.toMatch(/privada/i);
  });

  it('avisa que os números contam todos os alunos, morem ou não em Orleans', async () => {
    await abrir();

    expect(bloco(/cursos oferecidos/i)).toHaveTextContent(/todos os alunos, morem ou não em Orleans/);
  });

  it('o perfil mostra o percentual e o denominador', async () => {
    await abrir();

    const perfil = screen.getByRole('list', { name: /^Quem estuda/ });
    expect(itemDe(perfil, 'Estudam à noite')).toHaveTextContent('Estudam à noite 1.232 de 1.400 88,0%');
  });

  it('a barra do perfil vai de 0 a 100%', async () => {
    await abrir();

    const perfil = screen.getByRole('list', { name: /^Quem estuda/ });
    expect(itemDe(perfil, 'Estudam à noite').querySelector<HTMLElement>('.edu-cidade-barra')?.style.width).toBe('88%');
  });

  it('perfil em "menos de 5" fica em texto, sem percentual nem barra', async () => {
    const { oferta } = cidade();
    await abrir(
      comOferta({
        perfil: (oferta as NonNullable<Dados['oferta']>).perfil.map((p) =>
          p.recorte === 'fies' ? { recorte: 'fies', pessoas: 'menos de 5', percentual: null } : p,
        ),
      }),
    );

    const fies = itemDe(screen.getByRole('list', { name: /^Quem estuda/ }), 'Têm FIES');
    expect(fies).toHaveTextContent('Têm FIES menos de 5 de 1.400 —');
    expect(fies.querySelector('.edu-cidade-barra')).toBeNull();
    expect(fies).not.toHaveAttribute('tabindex');
  });

  it('o aviso do ensino a distância diz que o dado é limitado, segundo o INEP, e só traz o total', async () => {
    await abrir();

    const oferta = bloco(/cursos oferecidos/i);
    expect(oferta).toHaveTextContent('11 matrículas, em 6 instituições');
    expect(oferta).toHaveTextContent(/dado por município é limitado, segundo o INEP/);
    expect(oferta).toHaveTextContent(/só o total/);
  });

  it('o ensino a distância sem dado aparece com travessão, nunca zero', async () => {
    await abrir(comOferta({ ead: { instituicoes: null, matriculas: null, ingressantes: null } }));

    expect(bloco(/cursos oferecidos/i)).toHaveTextContent('— matrículas, em — instituições');
  });

  it('os docentes abrem a titulação, por escrito', async () => {
    await abrir();

    const tabela = screen.getByRole('table', { name: /titulação/i });
    expect(within(tabela).getByRole('row', { name: '150 docentes 40 70 40' })).toBeInTheDocument();
  });
});

describe('Cidade: IGC', () => {
  it('a frase traz faixa, nota e a distribuição de SC', async () => {
    await abrir();

    expect(bloco(/nota da instituição/i)).toHaveTextContent(
      'Faixa 3 de 5 (nota 2,41) no IGC de 2023. Em SC, 50 das 80 instituições com nota estão nessa mesma faixa.',
    );
  });

  it('sem a distribuição de SC, sai só a segunda frase', async () => {
    await abrir(comIgc({ distribuicaoEmSc: [], instituicoesEmSc: null }));

    const igc = bloco(/nota da instituição/i);
    expect(igc).toHaveTextContent('Faixa 3 de 5 (nota 2,41) no IGC de 2023.');
    expect(igc.textContent).not.toMatch(/instituições com nota/);
  });

  it('sem a faixa de Orleans na distribuição, a frase de SC também sai', async () => {
    await abrir(comIgc({ distribuicaoEmSc: [{ faixa: 4, instituicoes: 30 }], instituicoesEmSc: 30 }));

    expect(bloco(/nota da instituição/i).textContent).not.toMatch(/instituições com nota/);
  });

  it('sem conceito, diz isso e não inventa faixa', async () => {
    await abrir(comIgc({ faixa: null, continuo: null }));

    const igc = bloco(/nota da instituição/i);
    expect(igc).toHaveTextContent('Sem conceito no IGC de 2023.');
    expect(igc.textContent).not.toMatch(/Faixa \d de 5/);
  });

  it('a faixa de Orleans é a marcada, e só ela', async () => {
    await abrir();

    const faixas = within(screen.getByRole('list', { name: /^Faixas do IGC/ })).getAllByRole('listitem');
    expect(faixas.map((f) => f.getAttribute('aria-current'))).toEqual([null, null, 'true', null, null]);
  });

  it('a distribuição de SC traz as instituições por faixa e aponta a de Orleans', async () => {
    await abrir();

    const distribuicao = screen.getByRole('list', { name: /^Instituições de SC com nota, por faixa/ });
    expect(itemDe(distribuicao, 'Faixa 3')).toHaveTextContent('Faixa 3 a da instituição de Orleans 50 instituições');
    expect(itemDe(distribuicao, 'Faixa 3')).toHaveClass('orleans');
    expect(itemDe(distribuicao, 'Faixa 4')).toHaveTextContent('Faixa 4 22 instituições');
    expect(itemDe(distribuicao, 'Faixa 4')).not.toHaveClass('orleans');
  });

  it('o hover na distribuição de SC não pinta de vermelho, porque o dado é do estado', async () => {
    await abrir();

    const distribuicao = screen.getByRole('list', { name: /^Instituições de SC com nota, por faixa/ });
    await userEvent.hover(itemDe(distribuicao, 'Faixa 4'));

    expect(itemDe(distribuicao, 'Faixa 4')).toHaveClass('is-ativa');
    expect(itemDe(distribuicao, 'Faixa 4')).not.toHaveClass('vermelho-no-hover');
  });

  it('sem a distribuição de SC, não há lista de faixas do estado', async () => {
    await abrir(comIgc({ distribuicaoEmSc: [], instituicoesEmSc: null }));

    expect(screen.queryByRole('list', { name: /^Instituições de SC/ })).not.toBeInTheDocument();
  });
});

describe('Cidade: cursos', () => {
  // Os números do curso ficam separados, um por item, abaixo da barra: não espremidos ao lado do nome.
  const numerosDoCurso = (item: HTMLElement) =>
    [...item.querySelectorAll('.edu-cidade-numero-do-curso')].map((n) => n.textContent);

  it('mostra matrículas, entradas, formados e o corte do curso, cada número separado', async () => {
    await abrir();

    const direito = within(bloco(/matrículas por curso/i))
      .getByText('Direito (bacharelado)')
      .closest('li') as HTMLElement;
    expect(direito.querySelector('.edu-cidade-valor')).toHaveTextContent('230 matrículas');
    expect(numerosDoCurso(direito)).toEqual(['70 entraram', '25 formaram', '150 mulheres', '230 à noite']);
  });

  it('a barra do curso é relativa ao curso com mais matrículas', async () => {
    await abrir();

    const lista = within(bloco(/matrículas por curso/i));
    const barra = (curso: string) =>
      lista.getByText(curso).closest('li')?.querySelector<HTMLElement>('.edu-cidade-barra')?.style.width;
    expect(barra('Direito (bacharelado)')).toBe('100%');
    // 170 ÷ 230 = 73,91%
    expect(barra('Veterinária Fictícia (bacharelado)')).toBe('73.91%');
  });

  it('passar o mouse no curso pinta a barra de vermelho e a dica traz as vagas', async () => {
    await abrir();

    const direito = within(bloco(/matrículas por curso/i))
      .getByText('Direito (bacharelado)')
      .closest('li') as HTMLElement;
    await userEvent.hover(direito);

    expect(direito).toHaveClass('is-ativa', 'vermelho-no-hover');
    expect(direito.querySelector('.edu-cidade-dica')).toHaveTextContent('90 vagas');
  });

  it('curso sem o corte não mostra sexo nem turno, e a nota diz a regra', async () => {
    await abrir();

    const lista = within(bloco(/matrículas por curso/i));
    const pequeno = lista.getByText('Curso Pequeno (licenciatura)').closest('li') as HTMLElement;
    expect(pequeno).toHaveTextContent('8 matrículas');
    expect(pequeno.textContent).not.toMatch(/mulheres|à noite/);
    expect(bloco(/matrículas por curso/i)).toHaveTextContent(/menos de 10 matrículas não mostra o corte/);
  });

  it('contagem abaixo de 5 fica no texto da fonte, sem número', async () => {
    await abrir();

    const minimo = within(bloco(/matrículas por curso/i))
      .getByText('Curso Mínimo (bacharelado)')
      .closest('li') as HTMLElement;
    expect(minimo.querySelector('.edu-cidade-valor')).toHaveTextContent('menos de 5 matrículas');
    expect(numerosDoCurso(minimo)).toEqual(['menos de 5 entraram', 'menos de 5 formaram']);
    expect(minimo.querySelector('.edu-cidade-barra')).toBeNull();
  });

  it('zero à noite é dado, e aparece', async () => {
    await abrir();

    const vet = within(bloco(/matrículas por curso/i))
      .getByText('Veterinária Fictícia (bacharelado)')
      .closest('li') as HTMLElement;
    expect(vet).toHaveTextContent('0 à noite');
  });

  it('o grau tecnológico aparece com acento, mesmo que a fonte venha sem', async () => {
    await abrir();

    expect(within(bloco(/matrículas por curso/i)).getByText('Design Fictício (tecnológico)')).toBeInTheDocument();
  });
});
