import type { Apoio } from '@orleans-em-dados/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Apoiar from '../../src/paginas/Apoiar';
import { TEXTO_PROIBIDO } from '../support/conferidos';

const APOIO: Apoio = {
  chave: 'contato@exemplo.test',
  nome: 'Fulano de Tal',
  cidade: 'ORLEANS',
  copiaECola:
    '00020126420014br.gov.bcb.pix0120contato@exemplo.test5204000053039865802BR5913Fulano de Tal6007ORLEANS' +
    '62070503***6304298A',
};

// A área de transferência do navegador, sem o sistema: guarda o que foi copiado.
class AreaDeTransferenciaFake {
  textos: string[] = [];
  writeText = async (texto: string) => {
    this.textos.push(texto);
  };
}

const instalarAreaDeTransferencia = (valor: AreaDeTransferenciaFake | undefined) =>
  Object.defineProperty(navigator, 'clipboard', { value: valor, configurable: true });

afterEach(() => instalarAreaDeTransferencia(undefined));

describe('Apoiar', () => {
  it('mostra o título, o QR do Pix com texto alternativo e o copia e cola num campo só de leitura', () => {
    render(<Apoiar apoio={APOIO} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Apoie o Orleans em Dados' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'QR Code do Pix para apoiar o Orleans em Dados' })).toHaveAttribute(
      'src',
      '/api/apoio/qrcode.svg',
    );
    const campo = screen.getByRole('textbox', { name: 'Pix copia e cola' });
    expect(campo).toHaveValue(APOIO.copiaECola);
    expect(campo).toHaveAttribute('readonly');
  });

  it('escreve a chave, quem recebe e que o app do banco pede o valor', () => {
    const { container } = render(<Apoiar apoio={APOIO} />);

    expect(container).toHaveTextContent('Chave Pix: contato@exemplo.test');
    expect(container).toHaveTextContent('Quem recebe: Fulano de Tal, ORLEANS');
    expect(container).toHaveTextContent('o app do banco pede o valor');
  });

  it('diz para quem vai o apoio, que não é a Prefeitura, que não é dedutível e o que ele paga', () => {
    const { container } = render(<Apoiar apoio={APOIO} />);

    expect(container).toHaveTextContent('vai para quem mantém o projeto, uma pessoa física');
    expect(container).toHaveTextContent('não para a Prefeitura de Orleans nem para órgão de controle nenhum');
    expect(container).toHaveTextContent('não é dedutível');
    expect(container).toHaveTextContent('a hospedagem e o domínio');
  });

  it('aponta outras formas de ajudar no guia de contribuição', () => {
    render(<Apoiar apoio={APOIO} />);

    expect(screen.getByRole('link', { name: 'Outras formas de ajudar' })).toHaveAttribute(
      'href',
      'https://github.com/ByelBardini/orleans-em-dados/blob/main/CONTRIBUTING.md',
    );
  });

  it.each([
    ['Dado divergente', 'https://github.com/ByelBardini/orleans-em-dados/issues/new?template=dado-divergente.yml'],
    ['Sugestão', 'https://github.com/ByelBardini/orleans-em-dados/issues/new?template=sugestao.yml'],
  ])('o link "%s" abre a issue nova já com o modelo certo', (nome, endereco) => {
    render(<Apoiar apoio={APOIO} />);

    expect(screen.getByRole('link', { name: nome })).toHaveAttribute('href', endereco);
  });

  it('copiar põe o código na área de transferência e anuncia', async () => {
    const area = new AreaDeTransferenciaFake();
    instalarAreaDeTransferencia(area);
    render(<Apoiar apoio={APOIO} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Código copiado');
    expect(area.textos).toEqual([APOIO.copiaECola]);
  });

  it('sem área de transferência (navegador antigo), o botão seleciona o código no campo', async () => {
    instalarAreaDeTransferencia(undefined);
    render(<Apoiar apoio={APOIO} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));

    const campo = screen.getByRole('textbox', { name: 'Pix copia e cola' }) as HTMLTextAreaElement;
    expect(await screen.findByRole('status')).toHaveTextContent('Código selecionado: copie com Ctrl+C');
    expect([campo.selectionStart, campo.selectionEnd]).toEqual([0, APOIO.copiaECola.length]);
  });

  it('antes de copiar, nada é anunciado', () => {
    render(<Apoiar apoio={APOIO} />);

    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('não usa o vocabulário proibido nas páginas', () => {
    const { container } = render(<Apoiar apoio={APOIO} />);

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
  });
});
