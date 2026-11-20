// Apoio ao projeto por Pix: para quem vai, o que paga, o QR e o copia e cola. A chave vem da API
// (`/api/apoio`, das variáveis PIX_* do servidor); sem ela, a página não existe.
import type { Apoio } from '@orleans-em-dados/contracts';
import { useRef, useState } from 'react';
import './Apoiar.css';

const CONTRIBUIR = 'https://github.com/ByelBardini/orleans-em-dados/blob/main/CONTRIBUTING.md';

export default function Apoiar({ apoio }: { apoio: Apoio }) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const [aviso, setAviso] = useState('');

  const selecionar = () => {
    campo.current?.focus();
    campo.current?.setSelectionRange(0, apoio.copiaECola.length);
    setAviso('Código selecionado: copie com Ctrl+C');
  };
  const copiar = async () => {
    // Navegador antigo, ou sem permissão: o código fica selecionado para copiar à mão.
    if (!navigator.clipboard) return selecionar();
    try {
      await navigator.clipboard.writeText(apoio.copiaECola);
      setAviso('Código copiado');
    } catch {
      selecionar();
    }
  };

  return (
    <article className="apoiar">
      <h1>Apoie o Orleans em Dados</h1>
      <p className="apoiar-entrada">
        O Orleans em Dados é um projeto independente: coleta, confere e publica os dados públicos de Orleans com a fonte
        de cada número. Se ele é útil para você, dá para apoiar por Pix.
      </p>

      <div className="apoiar-grade">
        <section className="apoiar-pix" aria-labelledby="apoiar-pix-titulo">
          <h2 id="apoiar-pix-titulo">Pix</h2>
          <img
            className="apoiar-qr"
            src="/api/apoio/qrcode.svg"
            alt="QR Code do Pix para apoiar o Orleans em Dados"
            width={240}
            height={240}
          />
          <p>
            Aponte a câmera do app do banco para o QR, ou copie o código. Não há valor fixo: o app do banco pede o
            valor.
          </p>
          <label className="apoiar-rotulo" htmlFor="apoiar-codigo">
            Pix copia e cola
          </label>
          <textarea
            id="apoiar-codigo"
            ref={campo}
            className="apoiar-codigo"
            readOnly
            rows={4}
            value={apoio.copiaECola}
            onFocus={(evento) => evento.currentTarget.select()}
          />
          <div className="apoiar-acoes">
            <button type="button" className="botao-link" onClick={copiar}>
              Copiar código
            </button>
            <span role="status" className="apoiar-aviso">
              {aviso}
            </span>
          </div>
          <dl className="apoiar-dados">
            <div>
              <dt>Chave Pix:</dt> <dd>{apoio.chave}</dd>
            </div>
            <div>
              <dt>Quem recebe:</dt>{' '}
              <dd>
                {apoio.nome}, {apoio.cidade}
              </dd>
            </div>
          </dl>
        </section>

        <section className="apoiar-texto" aria-labelledby="apoiar-destino-titulo">
          <h2 id="apoiar-destino-titulo">Para onde vai</h2>
          <p>
            O apoio vai para quem mantém o projeto, uma pessoa física, e não para a Prefeitura de Orleans nem para órgão
            de controle nenhum. Não é doação a entidade: não é dedutível do imposto de renda.
          </p>
          <p>
            Ele paga a hospedagem e o domínio do site e, o que sobrar, o tempo de manter as coletas, as conferências e
            as páginas novas. O projeto continua aberto e de graça para todo mundo, com ou sem apoio.
          </p>
          <h2>Outras formas</h2>
          <p>
            Avisar de um número que não bate com a fonte, sugerir uma página ou mexer no código também ajuda.{' '}
            <a href={CONTRIBUIR}>Outras formas de ajudar</a>
          </p>
        </section>
      </div>
    </article>
  );
}
