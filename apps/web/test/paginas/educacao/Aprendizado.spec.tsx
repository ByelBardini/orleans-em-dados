import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Aprendizado from '../../../src/paginas/educacao/Aprendizado';
import { TEXTO_PROIBIDO } from '../../support/conferidos';
import { aprendizado, aprendizadoIndisponivel } from '../../support/educacao';
import { FetchFake } from '../../support/fetch-fake';

afterEach(() => vi.unstubAllGlobals());

const CAMINHO = '/api/educacao/aprendizado';

const abrir = async (resposta = aprendizado()) => {
  new FetchFake().responder(CAMINHO, resposta).instalar();
  const { container } = render(<Aprendizado />);
  await screen.findByRole('link', { name: /baixar csv/i });
  return container;
};

const bloco = (nome: RegExp) => screen.getByRole('region', { name: nome });
const tabelaDa = (nome: RegExp) => screen.getByRole('table', { name: nome });
const escolherRede = (nome: string) =>
  fireEvent.click(within(screen.getByRole('group', { name: 'Rede' })).getByRole('button', { name: nome }));
const SELO = 'fonte única, sem conferência';
// As células de uma linha de quadro, uma por coluna; o nome (com o apoio) fica de fora.
const celulasDa = (linha: HTMLElement) =>
  within(linha)
    .getAllByRole('cell')
    .map((c) => c.textContent);
const linhaDe = (tabela: HTMLElement, nome: RegExp) => within(tabela).getByRole('row', { name: nome });
// O apoio da linha (as setas) fica na linha logo abaixo, no quadro.
const apoioDe = (linha: HTMLElement) => linha.nextElementSibling as HTMLElement;
const abrirDetalhesDe = (regiao: HTMLElement) =>
  userEvent.hover(within(regiao).getAllByRole('button', { name: 'Fonte e detalhes' })[0] as HTMLElement);

describe('Aprendizado: estados', () => {
  it('enquanto carrega, diz que está carregando', () => {
    const fake = new FetchFake();
    fake.segurar = true;
    fake.responder(CAMINHO, aprendizado()).instalar();

    render(<Aprendizado />);

    expect(screen.getByText('Carregando os números…')).toBeInTheDocument();
  });

  it('com a API fora do ar, mostra o aviso e nenhum número', async () => {
    new FetchFake().responderTexto(CAMINHO, JSON.stringify({ erro: 'Erro interno' }), 500).instalar();

    render(<Aprendizado />);

    expect(await screen.findByText(/Não foi possível carregar: Erro interno/)).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('sem nenhuma coleta, avisa e não mostra bloco nem CSV', async () => {
    new FetchFake().responder(CAMINHO, aprendizadoIndisponivel()).instalar();

    render(<Aprendizado />);

    expect(await screen.findByText(/ainda não foram coletados/)).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /baixar csv/i })).not.toBeInTheDocument();
  });

  it('o CSV da aba está a um clique', async () => {
    await abrir();

    expect(screen.getByRole('link', { name: /baixar csv/i })).toHaveAttribute('href', '/api/educacao/aprendizado.csv');
  });

  it('nenhuma palavra proibida na página', async () => {
    const container = await abrir();

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
  });

  it.each([[/alfabetização no 2º ano/i], [/^IDEB/], [/nível socioeconômico/i], [/^ENEM/]])(
    'o bloco %s traz o selo de fonte única no título',
    async (nome) => {
      await abrir();

      expect(within(bloco(nome)).getByText(SELO)).toBeInTheDocument();
    },
  );
});

describe('Aprendizado: alfabetização', () => {
  it('a frase sai dos dados: Orleans abaixo da meta do ano', async () => {
    await abrir();

    expect(
      within(bloco(/alfabetização/i)).getByText(/Em 2025, Orleans teve 65%, abaixo da meta de 70%/),
    ).toBeInTheDocument();
  });

  it('acima da meta, a frase muda', async () => {
    const base = aprendizado();
    const alfabetizacao = base.alfabetizacao!;
    await abrir(
      aprendizado({
        alfabetizacao: {
          ...alfabetizacao,
          metas: alfabetizacao.metas.map((m) => (m.ano === '2025' ? { ...m, orleans: 60 } : m)),
        },
      }),
    );

    expect(within(bloco(/alfabetização/i)).getByText(/acima da meta de 60%/)).toBeInTheDocument();
  });

  it('a ressalva diz que Orleans é municipal, e SC e o Brasil, pública, dentro dos detalhes', async () => {
    await abrir();
    expect(bloco(/alfabetização/i).textContent).not.toMatch(/não são da mesma rede/);

    await abrirDetalhesDe(bloco(/alfabetização/i));

    const texto = bloco(/alfabetização/i).textContent;
    expect(texto).toMatch(/Orleans é rede municipal; Santa Catarina, rede pública; Brasil, rede pública/);
    expect(texto).toMatch(/não são da mesma rede/);
  });

  it('a participação de 84% fica escrita nos detalhes, com os outros lugares', async () => {
    await abrir();
    await abrirDetalhesDe(bloco(/alfabetização/i));

    expect(within(bloco(/alfabetização/i)).getByText(/Orleans 84%, SC 87,8%, Brasil 89%/)).toBeInTheDocument();
  });

  it('a série compara os três lugares, ano a ano, com a meta de Orleans ao lado', async () => {
    await abrir();

    expect(within(bloco(/alfabetização/i)).getByRole('img', { name: /alfabetização, ano a ano/i })).toBeInTheDocument();
    const tabela = tabelaDa(/alfabetização, ano a ano/i);
    expect(within(tabela).getByRole('row', { name: '2025 65% 63% 66% 70%' })).toBeInTheDocument();
    expect(within(tabela).getByRole('row', { name: '2024 68% 62% 59% —' })).toBeInTheDocument();
  });

  it('a escala realça a diferença e diz que não começa em zero', async () => {
    await abrir();

    expect(bloco(/alfabetização/i).textContent).toMatch(/A escala vai de 50 a 80: não começa em zero/);
  });

  it('a meta em texto continua texto, e meta ausente é travessão', async () => {
    await abrir();

    const quadro = screen.getByRole('table', { name: 'Alfabetização no 2º ano, Metas por ano' });
    expect(
      within(quadro)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Orleans', 'SC', 'Brasil']);
    expect(celulasDa(linhaDe(quadro, /^2030/))).toEqual(['80%', '> 80%', '> 80%']);
    expect(celulasDa(linhaDe(quadro, /^2027/))).toEqual(['—', '73%', '71%']);
  });

  it('as setas dizem Orleans diante de SC e do Brasil no ano, em pontos, com o tom do sentido', async () => {
    await abrir();

    const noBloco = within(bloco(/alfabetização/i));
    const sc = noBloco.getByText(/acima de SC/).closest('li') as HTMLElement;
    expect(sc).toHaveTextContent('▲ 2,0 pontos acima de SC');
    expect(sc).toHaveClass('bom');
    const brasil = noBloco.getByText(/abaixo do Brasil/).closest('li') as HTMLElement;
    expect(brasil).toHaveTextContent('▼ 1,0 ponto abaixo do Brasil');
    expect(brasil).toHaveClass('ruim');
  });

  it('sem a coleta, o bloco some e o resto segue', async () => {
    await abrir(aprendizado({ alfabetizacao: null, faltando: ['inep_alfabetizacao'] }));

    expect(screen.queryByRole('region', { name: /alfabetização/i })).not.toBeInTheDocument();
    expect(bloco(/^IDEB/)).toBeInTheDocument();
  });
});

describe('Aprendizado: IDEB e o alternador', () => {
  it('abre na rede pública', async () => {
    await abrir();

    expect(screen.getByRole('button', { name: 'Pública' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('na pública, 6,6 em 2025 é o melhor da série, e a frase diz isso', async () => {
    await abrir();

    expect(screen.getByText(/Anos iniciais, rede pública: 6,6 em 2025, o melhor IDEB da série/)).toBeInTheDocument();
  });

  it('na municipal, 6,4 em 2025 não é o melhor: a frase mostra o maior da série', async () => {
    await abrir();

    escolherRede('Municipal');

    expect(
      screen.getByText(/Anos iniciais, rede municipal: 6,4 em 2025\. O melhor da série foi 6,8, em 2023/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Anos iniciais.*o melhor IDEB da série/)).not.toBeInTheDocument();
  });

  it('o alternador muda a série e os números juntos', async () => {
    await abrir();
    const antes = tabelaDa(/IDEB dos anos iniciais, rede pública/);
    expect(within(antes).getByRole('row', { name: '2025 6,6 6,5 6,1' })).toBeInTheDocument();

    escolherRede('Municipal');

    const depois = tabelaDa(/IDEB dos anos iniciais, rede municipal/);
    expect(within(depois).getByRole('row', { name: '2023 6,8 6,3 5,8' })).toBeInTheDocument();
    expect(within(depois).getByRole('row', { name: '2025 6,4 6,5 6,1' })).toBeInTheDocument();
    expect(tabelaDa(/^Média das 5 áreas, rede municipal, 2025/)).toBeInTheDocument();
  });

  it('o alternador também muda as provas comparadas', async () => {
    await abrir();

    escolherRede('Municipal');

    const quadro = screen.getByRole('table', { name: 'Prova e aprovação, rede municipal, 2025, Anos iniciais' });
    expect(
      within(quadro)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Orleans', 'SC', 'Brasil']);
    expect(celulasDa(linhaDe(quadro, /^IDEB/))).toEqual(['6,4', '6,5', '6,1']);
    expect(celulasDa(linhaDe(quadro, /^Rendimento/))).toEqual(['0,96', '0,98', '0,98']);
    expect(celulasDa(linhaDe(quadro, /^Aprovação/))).toEqual(['96,3%', '98,0%', '98,0%']);
    expect(celulasDa(linhaDe(quadro, /^Matemática/))).toEqual(['239,84', '235,00', '227,79']);
    expect(celulasDa(linhaDe(quadro, /^Português/))).toEqual(['227,45', '222,00', '210,00']);
  });

  it('na prova e aprovação, IDEB, aprovação e notas levam seta; o rendimento não', async () => {
    await abrir();
    escolherRede('Municipal');

    const quadro = screen.getByRole('table', { name: 'Prova e aprovação, rede municipal, 2025, Anos iniciais' });
    const aprovacao = within(apoioDe(linhaDe(quadro, /^Aprovação/)))
      .getByText(/abaixo de SC/)
      .closest('li') as HTMLElement;
    expect(aprovacao).toHaveTextContent('▼ 1,7 ponto abaixo de SC');
    expect(aprovacao).toHaveClass('ruim');
    const ideb = within(apoioDe(linhaDe(quadro, /^IDEB/)))
      .getByText(/acima do Brasil/)
      .closest('li') as HTMLElement;
    expect(ideb).toHaveTextContent('▲ 4,9% acima do Brasil');
    expect(ideb).toHaveClass('bom');
    expect(within(apoioDe(linhaDe(quadro, /^Matemática/))).getByText(/acima de SC/)).toBeInTheDocument();
    expect(within(apoioDe(linhaDe(quadro, /^Português/))).getByText(/acima de SC/)).toBeInTheDocument();
    expect(linhaDe(quadro, /^Rendimento/)).not.toHaveClass('com-apoio');
  });

  it('a lacuna do médio fica dita, e o ano sem dado é travessão, nunca zero', async () => {
    await abrir();

    const tabela = tabelaDa(/IDEB do ensino médio, rede pública/);
    expect(within(tabela).getByRole('row', { name: '2021 — 3,6 3,9' })).toBeInTheDocument();
    expect(within(tabela).getByRole('row', { name: '2023 — 3,8 4,1' })).toBeInTheDocument();
    expect(screen.getByText(/Orleans sem dado em 2021 e 2023/)).toBeInTheDocument();
  });

  it('no médio da rede pública, avisa que a linha de SC é a estadual', async () => {
    await abrir();

    expect(screen.getByText(/Em SC, a rede pública do ensino médio é a linha estadual/)).toBeInTheDocument();

    escolherRede('Estadual');

    expect(screen.queryByText(/Em SC, a rede pública do ensino médio/)).not.toBeInTheDocument();
  });

  it('a rede sem dado no médio avisa, sem desenhar a série', async () => {
    await abrir();

    escolherRede('Municipal');

    expect(screen.getByText(/Ensino médio: sem dado nesta rede/)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /IDEB do ensino médio/ })).not.toBeInTheDocument();
  });

  it('rede em que Orleans não tem IDEB diz isso, e SC e o Brasil seguem', async () => {
    await abrir();

    escolherRede('Privada');

    expect(screen.getByText(/Anos iniciais: Orleans não tem IDEB nesta rede/)).toBeInTheDocument();
    expect(
      within(tabelaDa(/IDEB dos anos iniciais, rede privada/)).getByRole('row', { name: '2025 7,8 7,1' }),
    ).toBeInTheDocument();
  });

  it('sem o Brasil, a linha do Brasil some da série, sem coluna de travessões', async () => {
    const base = aprendizado();
    await abrir(
      aprendizado({
        ideb: {
          ...base.ideb!,
          etapas: base.ideb!.etapas.map((e) => ({
            ...e,
            series: { publica: { ...e.series.publica!, brasil: [] } },
          })),
        },
      }),
    );

    const tabela = tabelaDa(/IDEB dos anos iniciais, rede pública/);
    expect(within(tabela).queryByRole('columnheader', { name: 'Brasil' })).not.toBeInTheDocument();
    expect(within(tabela).getByRole('row', { name: '2025 6,6 6,5' })).toBeInTheDocument();
  });

  it('Orleans por rede: um quadro por etapa, uma coluna por rede de Orleans, prova e aprovação separadas', async () => {
    await abrir();

    const iniciais = screen.getByRole('table', { name: 'IDEB de Orleans por rede, 2025, Anos iniciais' });
    expect(
      within(iniciais)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Pública', 'Municipal']);
    expect(celulasDa(linhaDe(iniciais, /^IDEB/))).toEqual(['6,6', '6,4']);
    expect(celulasDa(linhaDe(iniciais, /^Aprovação/))).toEqual(['97,4%', '96,3%']);
    const medio = screen.getByRole('table', { name: 'IDEB de Orleans por rede, 2025, Ensino médio' });
    expect(
      within(medio)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Estadual']);
    expect(celulasDa(linhaDe(medio, /^Matemática/))).toEqual(['268,96']);
    expect(celulasDa(linhaDe(medio, /^Português/))).toEqual(['280,96']);
  });

  it('as duas leituras do IDEB dizem na tela o que cada uma compara', async () => {
    await abrir();

    const ideb = bloco(/^IDEB/);
    expect(
      within(ideb).getByRole('heading', { name: 'Orleans, SC e Brasil, rede pública, em 2025' }),
    ).toBeInTheDocument();
    expect(ideb).toHaveTextContent('Os três lugares na mesma rede, para comparar Orleans com SC e o Brasil.');
    expect(within(ideb).getByRole('heading', { name: 'Só Orleans, rede por rede, em 2025' })).toBeInTheDocument();
    expect(ideb).toHaveTextContent(
      'Sem SC nem Brasil: aqui a rede pública de Orleans se abre em municipal (Prefeitura) e estadual (Estado), e a pública junta as duas.',
    );
  });

  it('etapa sem IDEB da rede municipal diz que, ali, a pública é a estadual', async () => {
    await abrir();

    const medio = screen.getByRole('table', { name: 'IDEB de Orleans por rede, 2025, Ensino médio' });
    expect(medio.closest('section')).toHaveTextContent('Sem IDEB da rede municipal nesta etapa.');
  });

  it('o como ler do IDEB e o link do INEP ficam nos detalhes', async () => {
    await abrir();
    expect(within(bloco(/^IDEB/)).queryByRole('link', { name: 'INEP, arquivo do IDEB' })).not.toBeInTheDocument();

    await abrirDetalhesDe(bloco(/^IDEB/));

    expect(within(bloco(/^IDEB/)).getByText(/Rendimento vai de 0 a 1/)).toBeVisible();
    expect(within(bloco(/^IDEB/)).getByRole('link', { name: 'INEP, arquivo do IDEB' })).toBeVisible();
  });

  it('diz que o IBGE republica o INEP: não conta como conferência', async () => {
    await abrir();

    expect(within(bloco(/^IDEB/)).getByText(/o IBGE republica o INEP/i)).toBeInTheDocument();
  });

  it('o INSE mostra 2023 e muda com a rede', async () => {
    await abrir();

    const noBloco = within(bloco(/nível socioeconômico/i));
    expect(noBloco.getByRole('table', { name: /rede pública, 2023/ })).toBeInTheDocument();
    expect(noBloco.getByRole('row', { name: 'Orleans 5,58' })).toBeInTheDocument();

    escolherRede('Municipal');

    expect(within(bloco(/nível socioeconômico/i)).getByRole('row', { name: 'Orleans 5,52' })).toBeInTheDocument();
  });

  it('sem o IDEB, o bloco some e o ENEM segue', async () => {
    await abrir(aprendizado({ ideb: null, faltando: ['ibge_rede_escolar'] }));

    expect(screen.queryByRole('region', { name: /^IDEB/ })).not.toBeInTheDocument();
    expect(bloco(/^ENEM/)).toBeInTheDocument();
  });
});

describe('Aprendizado: ENEM', () => {
  it('avisa que a prova é voluntária e que não há dado por morador', async () => {
    await abrir();

    const texto = bloco(/^ENEM/).textContent;
    expect(texto).toMatch(/A prova é voluntária/);
    expect(texto).toMatch(/Não existe dado por morador/);
  });

  it('a tabela de quem fez a prova agrupa por ano e só tem as redes que vieram, sem linha da retida', async () => {
    await abrir();

    const quadros = within(bloco(/^ENEM/))
      .getAllByRole('table', { name: /^Quem fez a prova, \d{4}$/ })
      .map((t) => t.getAttribute('aria-label'));
    expect(quadros).toEqual(['Quem fez a prova, 2025', 'Quem fez a prova, 2024']);
    const de2025 = screen.getByRole('table', { name: 'Quem fez a prova, 2025' });
    expect(celulasDa(linhaDe(de2025, /^Privada/))).toEqual(['28', '22', '32', '68,8%']);
    const de2024 = screen.getByRole('table', { name: 'Quem fez a prova, 2024' });
    expect(celulasDa(linhaDe(de2024, /^Pública/))).toEqual(['113', '79', '181', '43,6%']);
    expect(within(de2024).queryByRole('row', { name: /^Privada/ })).not.toBeInTheDocument();
  });

  it('a média do ENEM leva seta: maior é melhor, em percentual do outro lugar', async () => {
    await abrir();

    const noBloco = within(bloco(/^ENEM/));
    const sc = noBloco.getAllByText(/abaixo de SC/)[0]!.closest('li') as HTMLElement;
    expect(sc).toHaveTextContent('▼ 1,8% abaixo de SC');
    expect(sc).toHaveClass('ruim');
    const brasil = noBloco.getAllByText(/acima do Brasil/)[0]!.closest('li') as HTMLElement;
    expect(brasil).toHaveTextContent('▲ 3,7% acima do Brasil');
    expect(brasil).toHaveClass('bom');
  });

  it('o como ler do ENEM e a fonte da 3ª série ficam nos detalhes', async () => {
    await abrir();

    await abrirDetalhesDe(bloco(/^ENEM/));

    expect(within(bloco(/^ENEM/)).getByText(/a da escola em que o aluno conclui/)).toBeVisible();
    expect(within(bloco(/^ENEM/)).getByRole('link', { name: /sinopse do Censo Escolar/ })).toBeVisible();
  });

  it('a média das 5 áreas vem antes das áreas, na rede escolhida', async () => {
    await abrir();

    const tabelas = within(bloco(/^ENEM/))
      .getAllByRole('table', { name: /rede pública, 2025$/ })
      .map((t) => t.getAttribute('aria-label'));
    expect(tabelas).toEqual(['Média das 5 áreas, rede pública, 2025', 'Redação, rede pública, 2025']);
  });

  it('presentes ÷ 3ª série fica escrito na rede escolhida, com o ano anterior', async () => {
    await abrir();

    const numeros = within(screen.getByRole('region', { name: /quem fez a prova, rede pública/i }));
    expect(numeros.getByText('44,3%')).toBeInTheDocument();
    expect(numeros.getByText(/43,6% em 2024/)).toBeInTheDocument();

    escolherRede('Todas');

    const todas = within(screen.getByRole('region', { name: /quem fez a prova, todas as redes/i }));
    expect(todas.getByText('48,2%')).toBeInTheDocument();
  });

  it('rede retida não tem número em "quem fez a prova"', async () => {
    const base = aprendizado();
    const enem = base.enem!;
    await abrir(
      aprendizado({
        enem: {
          ...enem,
          anos: enem.anos.map((a) => ({ ...a, redes: a.redes.filter((r) => r.rede !== 'privada') })),
        },
      }),
    );

    escolherRede('Privada');

    expect(screen.getByText(/Rede sem número publicado em Orleans/)).toBeInTheDocument();
  });

  it('a média compara os três lugares, com o Brasil presente, e a escala está escrita', async () => {
    await abrir();

    const tabela = tabelaDa(/^Média das 5 áreas, rede pública, 2025/);
    expect(within(tabela).getByRole('row', { name: 'Orleans 523,64' })).toBeInTheDocument();
    expect(within(tabela).getByRole('row', { name: 'Santa Catarina 533,00' })).toBeInTheDocument();
    expect(within(tabela).getByRole('row', { name: 'Brasil 505,00' })).toBeInTheDocument();
    expect(bloco(/^ENEM/).textContent).toMatch(/A escala vai de 400 a 800: não começa em zero/);
  });

  it('a escala comum das áreas do ENEM é dita uma vez só', async () => {
    await abrir();

    expect(bloco(/^ENEM/).textContent?.match(/A escala vai de 400 a 800/g)).toHaveLength(1);
  });

  it('o Brasil sem dado é travessão, nunca zero', async () => {
    const base = aprendizado();
    const enem = base.enem!;
    await abrir(
      aprendizado({
        enem: {
          ...enem,
          anos: enem.anos.map((a) => ({
            ...a,
            comparacoes: a.comparacoes.map((c) => ({
              ...c,
              porRede: { publica: { ...c.porRede.publica!, brasil: null } },
            })),
          })),
        },
      }),
    );

    expect(
      within(tabelaDa(/^Média das 5 áreas, rede pública, 2025/)).getByRole('row', { name: 'Brasil —' }),
    ).toBeInTheDocument();
  });

  it('sem a coleta, o bloco some e o resto segue', async () => {
    await abrir(aprendizado({ enem: null, faltando: ['inep_enem'] }));

    expect(screen.queryByRole('region', { name: /^ENEM/ })).not.toBeInTheDocument();
    expect(bloco(/^IDEB/)).toBeInTheDocument();
  });
});
