import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Resumo from '../../../src/paginas/educacao/Resumo';
import { TEXTO_PROIBIDO } from '../../support/conferidos';
import { resumo, resumoIndisponivel } from '../../support/educacao';
import { FetchFake } from '../../support/fetch-fake';

afterEach(() => vi.unstubAllGlobals());

const CAMINHO = '/api/educacao/resumo';
const FONTE_UNICA = 'fonte única, sem conferência';
const CONFERIDO = 'conferido com a Betha';
const DETALHES = 'Fonte e detalhes';

const abrir = async (resposta = resumo()) => {
  new FetchFake().responder(CAMINHO, resposta).instalar();
  const { container } = render(<Resumo />);
  await screen.findByRole('link', { name: /baixar csv/i });
  return container;
};

const cartao = (nome: string | RegExp) => screen.getByRole('article', { name: nome });
const LER = /aprendem a ler/;
const VAGA = /têm vaga/;
const FICAM = /ficam na escola/;
const NOTAS = /notas/;
const AULA = /Quem dá aula/;
const GASTO = /Quanto a Prefeitura gasta/;

// O que saiu do corpo mora no painel: o teste abre o painel e confere, para não provar só a ausência.
const comDetalhes = async (onde: HTMLElement) => {
  await userEvent.click(within(onde).getByRole('button', { name: DETALHES }));
  return onde;
};

describe('Resumo: estados', () => {
  it('enquanto carrega, diz que está carregando', () => {
    const fake = new FetchFake();
    fake.segurar = true;
    fake.responder(CAMINHO, resumo()).instalar();

    render(<Resumo />);

    expect(screen.getByText('Carregando os números…')).toBeInTheDocument();
  });

  it('com a API fora do ar, mostra o aviso e nenhuma pergunta', async () => {
    new FetchFake().responderTexto(CAMINHO, JSON.stringify({ erro: 'Erro interno' }), 500).instalar();

    render(<Resumo />);

    expect(await screen.findByText(/Não foi possível carregar: Erro interno/)).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('sem nenhuma coleta, avisa e não mostra pergunta nem CSV', async () => {
    new FetchFake().responder(CAMINHO, resumoIndisponivel()).instalar();

    render(<Resumo />);

    expect(await screen.findByText(/ainda não foram coletados/)).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /baixar csv/i })).not.toBeInTheDocument();
  });

  it('o CSV aponta para a rota da aba', async () => {
    await abrir();

    expect(screen.getByRole('link', { name: /baixar csv/i })).toHaveAttribute('href', '/api/educacao/resumo.csv');
  });

  it('não usa texto proibido nem travessão solto, nem dentro dos detalhes', async () => {
    const container = await abrir(
      resumo({
        ideb: {
          ano: '2025',
          fonte: { nome: 'IBGE', url: 'https://ibge.exemplo' },
          rede: 'publica',
          valores: { orleans: 7.2, santaCatarina: 6.9, brasil: null },
        },
      }),
    );
    await comDetalhes(cartao(NOTAS));

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
    expect(container.textContent).not.toContain('—');
  });
});

describe('Resumo: as seis perguntas', () => {
  it.each([
    [LER, '#educacao-aprendizado', /Ver aprendizado/],
    [VAGA, '#educacao-acesso', /Ver acesso/],
    [FICAM, '#educacao-permanencia', /Ver permanência/],
    [NOTAS, '#educacao-aprendizado', /Ver aprendizado/],
    [AULA, '#educacao-professores', /Ver professores e turmas/],
    [GASTO, '#educacao-dinheiro', /Ver dinheiro/],
  ])('%s leva para a aba %s, com o link e os detalhes na mesma linha do pé', async (pergunta, destino, link) => {
    await abrir();

    const ver = within(cartao(pergunta)).getByRole('link', { name: link });
    expect(ver).toHaveAttribute('href', destino);
    expect(within(ver.parentElement as HTMLElement).getByRole('button', { name: DETALHES })).toBeInTheDocument();
  });

  it('são seis, e nada mais vira cartão de pergunta', async () => {
    await abrir();

    expect(screen.getAllByRole('article')).toHaveLength(6);
  });

  it.each([
    [LER, 'SC 58%', 'INEP, alfabetização'],
    [VAGA, 'SC 41,75%', 'IBGE, Censo 2022'],
    [FICAM, 'SC 4,5%', 'Fonte fictícia'],
    [NOTAS, 'SC 6,9', 'Fonte fictícia'],
    [AULA, 'SC 95,5%', 'Fonte fictícia'],
    [GASTO, 'SICONFI registra', 'SICONFI, função 12'],
  ])('%s: o corpo não traz "%s" nem a fonte; o Detalhes traz', async (pergunta, texto, fonte) => {
    await abrir();

    const c = cartao(pergunta);
    expect(c).not.toHaveTextContent(texto);
    expect(within(c).queryByRole('link', { name: fonte })).not.toBeInTheDocument();
    await comDetalhes(c);
    expect(c).toHaveTextContent(texto);
    expect(within(c).getAllByRole('link', { name: fonte })[0]).toHaveAttribute('target', '_blank');
  });

  it.each([
    [LER, '13,0 pontos acima de SC', 'bom'],
    [LER, '9,0 pontos acima do Brasil', 'bom'],
    [VAGA, '2,5 pontos acima de SC', 'bom'],
    [FICAM, '3,0 pontos acima de SC', 'ruim'],
    [NOTAS, '4,3% acima de SC', 'bom'],
    [AULA, '2,0 pontos abaixo de SC', 'ruim'],
  ])('%s mostra a seta "%s", em tom %s', async (pergunta, texto, tom) => {
    await abrir();

    const seta = within(cartao(pergunta)).getByText(new RegExp(texto));
    expect(seta.closest('li')).toHaveClass(tom);
  });

  // O ano vem da API, nunca fixo: cada caso troca o ano e confere que o corpo diz o novo, sem abrir o Detalhes.
  it.each([
    ['alfabetizacao', LER, '2019', 'alfabetizados em 2019'],
    ['creche', VAGA, '2010', 'frequentavam creche em 2010'],
    ['abandono', FICAM, '2018', 'deixaram a escola durante 2018'],
    ['ideb', NOTAS, '2017', 'anos iniciais em 2017'],
    ['docentesSuperior', AULA, '2016', 'curso superior, em 2016'],
    ['gasto', GASTO, 2015, 'liquidados em 2015'],
    ['minimo', GASTO, 2014, 'aplicados em 2014'],
  ] as const)('o número de %s diz o ano no corpo do cartão', async (bloco, pergunta, ano, texto) => {
    const original = resumo()[bloco];
    await abrir(resumo({ [bloco]: original && { ...original, ano } }));

    const c = cartao(pergunta);
    expect(within(c).getByRole('button', { name: DETALHES })).toHaveAttribute('aria-expanded', 'false');
    expect(c).toHaveTextContent(texto);
  });

  it('o gasto não leva seta: não há melhor óbvio', async () => {
    await abrir();

    expect(within(cartao(GASTO)).queryByText(/acima|abaixo/)).not.toBeInTheDocument();
  });

  it('alfabetização: frase curta no corpo; a rede, a ressalva e a meta, no Detalhes', async () => {
    await abrir();

    const c = cartao(LER);
    expect(within(c).getByText('71%')).toBeInTheDocument();
    expect(c).toHaveTextContent('dos alunos do 2º ano estavam alfabetizados em 2025');
    expect(c).not.toHaveTextContent('Meta');
    await comDetalhes(c);
    expect(c).toHaveTextContent('Orleans: rede municipal');
    expect(c).toHaveTextContent('SC 58% · Brasil 62% (rede pública)');
    expect(c).toHaveTextContent('Meta de Orleans para 2025: 75%');
  });

  it('alfabetização sem a meta do ano não fala em meta', async () => {
    const { alfabetizacao } = resumo();
    await abrir(resumo({ alfabetizacao: alfabetizacao && { ...alfabetizacao, metaDeOrleans: null } }));

    expect(await comDetalhes(cartao(LER))).not.toHaveTextContent('Meta');
  });

  it('creche: no Detalhes, o Censo de todas as redes, 2010 e o que a Prefeitura informou ao MEC', async () => {
    await abrir();

    const c = cartao(VAGA);
    expect(within(c).getByText('44,25%')).toBeInTheDocument();
    expect(c).toHaveTextContent('das crianças de 0 a 3 anos frequentavam creche em 2022');
    expect(c).not.toHaveTextContent('2010');
    await comDetalhes(c);
    expect(c).toHaveTextContent('Em 2010 eram 30,5%');
    expect(c).toHaveTextContent('SC 41,75% · Brasil 29,50% (todas as redes');
    expect(c).toHaveTextContent('“Sem fila informada”, a Prefeitura informou ao MEC');
  });

  it('sem o Retrato do MEC, a creche segue, sem falar da Prefeitura', async () => {
    await abrir(resumo({ procuraPorCreche: null }));

    expect(within(cartao(VAGA)).getByText('44,25%')).toBeInTheDocument();
    expect(await comDetalhes(cartao(VAGA))).not.toHaveTextContent('MEC');
  });

  it('abandono mostra o ensino médio; a rede e o fundamental, com zero como número, no Detalhes', async () => {
    await abrir();

    const c = cartao(FICAM);
    expect(within(c).getByText('7,5%')).toBeInTheDocument();
    expect(c).toHaveTextContent('dos alunos do ensino médio deixaram a escola durante 2025');
    await comDetalhes(c);
    expect(c).toHaveTextContent('Nos anos iniciais, 0,0%; nos anos finais, 0,4%');
    expect(c).toHaveTextContent('SC 4,5% · Brasil 3,5% (rede pública)');
  });

  it('IDEB: escala no corpo; a rede e o Brasil, quando há dado, no Detalhes', async () => {
    await abrir();

    const c = cartao(NOTAS);
    expect(within(c).getByText('7,2')).toBeInTheDocument();
    expect(c).toHaveTextContent('é o IDEB dos anos iniciais em 2025, numa escala de 0 a 10');
    await comDetalhes(c);
    expect(c).toHaveTextContent('Anos iniciais: 1º ao 5º ano');
    expect(c).toHaveTextContent('SC 6,9 · Brasil 6,3 (rede pública)');
  });

  it('sem IDEB do Brasil, escreve "sem dado", sem travessão, e só a seta de SC fica', async () => {
    const { ideb } = resumo();
    await abrir(resumo({ ideb: ideb && { ...ideb, valores: { orleans: 7.2, santaCatarina: 6.9, brasil: null } } }));

    const c = cartao(NOTAS);
    expect(c).not.toHaveTextContent('do Brasil');
    await comDetalhes(c);
    expect(c).toHaveTextContent('SC 6,9 · Brasil sem dado (rede pública)');
    expect(c).not.toHaveTextContent('—');
  });

  it('quem dá aula: docentes com superior no corpo; SC, Brasil e as turmas no Detalhes', async () => {
    await abrir();

    const c = cartao(AULA);
    expect(within(c).getByText('93,5%')).toBeInTheDocument();
    expect(c).toHaveTextContent('dos docentes dos anos iniciais têm curso superior, em 2025');
    expect(c).not.toHaveTextContent('Turmas');
    await comDetalhes(c);
    expect(c).toHaveTextContent('SC 95,5% · Brasil 89,5% (rede pública)');
    expect(c).toHaveTextContent('Turmas: 15,5 alunos em média, nos anos iniciais. SC 20,5 · Brasil 21,5');
  });

  it('sem as turmas, a frase das turmas sai, e os docentes seguem', async () => {
    await abrir(resumo({ turmas: null }));

    expect(within(cartao(AULA)).getByText('93,5%')).toBeInTheDocument();
    expect(await comDetalhes(cartao(AULA))).not.toHaveTextContent('Turmas');
  });

  it('o gasto traz o selo da aba Dinheiro: conferido com a Betha só no ano conferido', async () => {
    await abrir();

    const c = cartao(GASTO);
    expect(within(c).getByText('R$ 41,25 mi')).toBeInTheDocument();
    expect(within(c).getAllByLabelText(CONFERIDO)).toHaveLength(1);
  });

  it.each(['diferenca', 'sem_betha'] as const)('gasto em %s fica como fonte única, sem "conferido"', async (nivel) => {
    const { gasto } = resumo();
    await abrir(resumo({ gasto: gasto && { ...gasto, conferencia: nivel, igualAoAnexo8: false } }));

    expect(screen.queryByLabelText(CONFERIDO)).not.toBeInTheDocument();
    expect(within(cartao(GASTO)).getAllByLabelText(FONTE_UNICA)).toHaveLength(2);
  });

  it('o gasto diz o Anexo 8 só quando é igual ao centavo, no Detalhes', async () => {
    await abrir();

    expect(cartao(GASTO)).not.toHaveTextContent('Anexo 8 do SIOPE traz');
    expect(await comDetalhes(cartao(GASTO))).toHaveTextContent('O Anexo 8 do SIOPE traz o mesmo valor.');
  });

  it('com o Anexo 8 diferente, não fala em mesmo valor', async () => {
    const { gasto } = resumo();
    await abrir(resumo({ gasto: gasto && { ...gasto, igualAoAnexo8: false } }));

    expect(await comDetalhes(cartao(GASTO))).not.toHaveTextContent('mesmo valor');
  });

  it('o mínimo legal é uma linha curta com o selo; o SICONFI e Discrepâncias, no Detalhes, sem rótulo de problema', async () => {
    await abrir();

    const c = cartao(GASTO);
    const linha = within(c).getByText(/da receita de impostos/);
    expect(linha).toHaveTextContent('27,75% da receita de impostos aplicados em 2025; a lei exige 25%');
    expect(within(linha).getByLabelText(FONTE_UNICA)).toBeInTheDocument();
    await comDetalhes(c);
    expect(c).toHaveTextContent('O SICONFI registra 27,25%');
    expect(within(c).getByRole('link', { name: /diferença em Discrepâncias/ })).toHaveAttribute(
      'href',
      '#discrepancias',
    );
  });

  it('com SIOPE e SICONFI iguais, não fala em diferença', async () => {
    const { minimo } = resumo();
    await abrir(resumo({ minimo: minimo && { ...minimo, difereDoSiconfi: false } }));

    const c = await comDetalhes(cartao(GASTO));
    expect(c).not.toHaveTextContent('SICONFI registra');
    expect(within(c).queryByRole('link', { name: /diferença em Discrepâncias/ })).not.toBeInTheDocument();
  });

  it('no mesmo percentual e valor diferente, a diferença é dita em reais', async () => {
    const { minimo } = resumo();
    await abrir(
      resumo({
        minimo: minimo && {
          ...minimo,
          percentual: 27.75,
          aplicado: 1000,
          siconfi: { percentual: 27.75, valor: 990 },
          difereDoSiconfi: true,
        },
      }),
    );

    expect(await comDetalhes(cartao(GASTO))).toHaveTextContent('O SICONFI registra o mesmo percentual e R$');
  });

  it.each([
    ['alfabetizacao', LER, 'Ver aprendizado'],
    ['creche', VAGA, 'Ver acesso'],
    ['abandono', FICAM, 'Ver permanência'],
    ['ideb', NOTAS, 'Ver aprendizado'],
    ['docentesSuperior', AULA, 'Ver professores e turmas'],
  ] as const)('sem %s, só aquele cartão muda: fica a pergunta e o link', async (bloco, pergunta, link) => {
    await abrir(resumo({ [bloco]: null }));

    const c = cartao(pergunta);
    expect(c).toHaveTextContent('Ainda sem dado coletado para esta pergunta.');
    expect(within(c).getByRole('link', { name: new RegExp(link) })).toBeInTheDocument();
    expect(within(c).queryByRole('button', { name: DETALHES })).not.toBeInTheDocument();
    expect(c).not.toHaveTextContent('—');
    const comAviso = screen.getAllByRole('article').filter((a) => a.textContent?.includes('Ainda sem dado'));
    expect(comAviso).toEqual([c]);
  });

  it('sem o gasto nem o mínimo, o cartão do dinheiro avisa, sem número e sem selo', async () => {
    await abrir(resumo({ gasto: null, minimo: null }));

    const c = cartao(GASTO);
    expect(c).toHaveTextContent('Ainda sem dado coletado para esta pergunta.');
    expect(c).not.toHaveTextContent('R$');
    expect(within(c).queryByLabelText(FONTE_UNICA)).not.toBeInTheDocument();
  });

  it('sem o SIOPE, o gasto segue; sem a DCA, o mínimo segue', async () => {
    await abrir(resumo({ minimo: null }));
    expect(within(cartao(GASTO)).getByText('R$ 41,25 mi')).toBeInTheDocument();
    expect(await comDetalhes(cartao(GASTO))).not.toHaveTextContent('receita de impostos');
  });
});

describe('Resumo: em poucos números', () => {
  const bloco = () => screen.getByRole('region', { name: /Em poucos números/ });
  const item = (valor: string) => within(bloco()).getByText(valor).closest('li') as HTMLElement;

  it('as matrículas são o total da API; a fonte e o ano, no Detalhes', async () => {
    await abrir();

    const li = item('3.150');
    expect(li).toHaveTextContent('matrículas da creche ao ensino médio');
    expect(li).not.toHaveTextContent('Fonte fictícia');
    await comDetalhes(li);
    expect(li).toHaveTextContent('Todas as redes. Fonte fictícia · 2025');
  });

  it('por morador leva o selo do gasto; o divisor vai para o Detalhes', async () => {
    await abrir();

    const li = item('R$ 1.650,50');
    expect(within(li).getByLabelText(CONFERIDO)).toBeInTheDocument();
    expect(li).not.toHaveTextContent('moradores');
    await comDetalhes(li);
    expect(li).toHaveTextContent('IBGE, estimativa 2025: 24.992 moradores');
  });

  // Pedido do usuário, vendo a tela em 05/11/2026: "Ano? Mês?". O ano vem da API e fica à vista, fora do Detalhes.
  it.each([
    ['matriculas', '3.150', '2024', 'matrículas da creche ao ensino médio em 2024'],
    ['gasto', 'R$ 1.650,50', 2023, 'de gasto com educação por morador, em 2023'],
    ['alfabetizacaoDosMoradores', '96,75%', '2010', 'sabem ler e escrever, no Censo 2010'],
  ] as const)('o número de %s diz o ano sem abrir o Detalhes', async (campo, valor, ano, texto) => {
    const original = resumo()[campo];
    await abrir(resumo({ [campo]: original && { ...original, ano } }));

    const li = item(valor);
    expect(within(li).getByRole('button', { name: DETALHES })).toHaveAttribute('aria-expanded', 'false');
    expect(li).toHaveTextContent(texto);
  });

  it('investimento por aluno é o da educação básica do SIOPE, com o ano à vista e o selo de fonte única', async () => {
    await abrir();

    const li = item('R$ 19.269');
    expect(li).toHaveTextContent('investidos por aluno da educação básica, em 2025');
    expect(within(li).getByLabelText(FONTE_UNICA)).toBeInTheDocument();
    await comDetalhes(li);
    expect(li).toHaveTextContent('SIOPE, Relatório de Indicadores · 2025');
  });

  it('sem a educação básica, o número é do ensino fundamental e diz isso', async () => {
    await abrir(resumo({ porAluno: { ...resumo().porAluno!, ano: 2023, etapa: 'fundamental', valor: 15000 } }));

    expect(item('R$ 15.000')).toHaveTextContent('investidos por aluno do ensino fundamental, em 2023');
  });

  it('sem o SIOPE, o por aluno sai, e o resto segue', async () => {
    await abrir(resumo({ porAluno: null }));

    expect(bloco()).not.toHaveTextContent('por aluno');
    expect(item('3.150')).toBeInTheDocument();
  });

  it('sem população, o por morador sai, sem travessão', async () => {
    const { gasto } = resumo();
    await abrir(resumo({ gasto: gasto && { ...gasto, porMorador: null, divisor: null } }));

    expect(bloco()).not.toHaveTextContent('por morador');
    expect(bloco()).not.toHaveTextContent('—');
  });

  it('a alfabetização dos moradores diz que é de 15 anos ou mais, com a fonte no Detalhes', async () => {
    await abrir();

    const li = item('96,75%');
    expect(li).toHaveTextContent('dos moradores com 15 anos ou mais sabem ler e escrever');
    expect(within(li).getByLabelText(FONTE_UNICA)).toBeInTheDocument();
    await comDetalhes(li);
    expect(li).toHaveTextContent('IBGE, Censo 2022 · 2022');
  });

  it('sem nenhum dos números, o bloco some', async () => {
    await abrir(resumo({ matriculas: null, gasto: null, porAluno: null, alfabetizacaoDosMoradores: null }));

    expect(screen.queryByRole('region', { name: /Em poucos números/ })).not.toBeInTheDocument();
  });
});

describe('Resumo: quem cuida de quê', () => {
  const bloco = () => screen.getByRole('region', { name: /Quem cuida de quê/ });
  const linha = (etapa: string) => {
    const termo = within(bloco()).getByText(etapa);
    return termo.nextElementSibling as HTMLElement;
  };

  it('quem atende cada etapa sai das matrículas por rede', async () => {
    await abrir();

    expect(linha('Creche e pré-escola')).toHaveTextContent('Prefeitura e escolas privadas');
    expect(linha('Ensino fundamental')).toHaveTextContent('Prefeitura, Estado e escolas privadas');
    expect(linha('Ensino médio')).toHaveTextContent('Estado e escolas privadas');
  });

  it('natureza da instituição é o campo, escrito como veio', async () => {
    await abrir();

    expect(linha('Ensino superior presencial')).toHaveTextContent('FACULDADE FICTÍCIA, Privada sem fins lucrativos');
  });

  it('sem o campo da natureza, a instituição sai sozinha', async () => {
    const { superior } = resumo();
    await abrir(resumo({ superior: superior && { ...superior, natureza: null } }));

    expect(linha('Ensino superior presencial').textContent).toBe('FACULDADE FICTÍCIA');
  });

  it('sem o Censo Superior, a linha some, e as etapas seguem', async () => {
    await abrir(resumo({ superior: null }));

    expect(within(bloco()).queryByText('Ensino superior presencial')).not.toBeInTheDocument();
    expect(linha('Ensino médio')).toBeInTheDocument();
  });

  it('a fonte e como as redes se comparam ficam num Detalhes só; que nada é por escola fica à vista', async () => {
    await abrir();

    expect(bloco()).toHaveTextContent('Nada aqui é mostrado por escola');
    expect(bloco()).not.toHaveTextContent('Rede com rede');
    expect(within(bloco()).getAllByRole('button', { name: DETALHES })).toHaveLength(1);
    await comDetalhes(bloco());
    expect(bloco()).toHaveTextContent('Rede com rede onde a fonte abre a rede');
    expect(within(bloco()).getAllByRole('link', { name: 'Fonte fictícia' })).toHaveLength(2);
    expect(bloco()).toHaveTextContent('Ensino superior: Fonte fictícia · 2024');
  });
});
