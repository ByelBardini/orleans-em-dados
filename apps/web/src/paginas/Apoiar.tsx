// Apoio ao projeto por Pix: para quem vai, o que paga, o QR e o copia e cola. A chave vem da API
// (`/api/apoio`, das variáveis PIX_* do servidor); sem ela, a página não existe.
import type { Apoio } from '@orleans-em-dados/contracts';
import { useRef, useState } from 'react';
import './Apoiar.css';

const REPOSITORIO = 'https://github.com/ByelBardini/orleans-em-dados';
const CONTRIBUIR = `${REPOSITORIO}/blob/main/CONTRIBUTING.md`;
// Os modelos de .github/ISSUE_TEMPLATE: a issue já abre com o formulário certo.
const ISSUE_DADO = `${REPOSITORIO}/issues/new?template=dado-divergente.yml`;
const ISSUE_SUGESTAO = `${REPOSITORIO}/issues/new?template=sugestao.yml`;

export default function Apoiar({ apoio }: { apoio: Apoio }) {
  const campo = useRef<HTMLInputElement>(null);
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
      <header className="apoiar-abertura">
        <p className="apoiar-chapeu">Projeto independente</p>
        <h1>
          Apoie o Orleans <em>em</em> Dados
        </h1>
        <p className="apoiar-entrada">
          O Orleans em Dados coleta, confere e publica os dados públicos de Orleans com a fonte de cada número. Se ele é
          útil para você, dá para apoiar por Pix.
        </p>
      </header>

      {/* Tríptico: para onde vai, o Pix no centro, outras formas de ajudar. */}
      <div className="apoiar-triptico">
        <section className="apoiar-lado" aria-labelledby="apoiar-destino-titulo">
          <h2 id="apoiar-destino-titulo" className="apoiar-rotulo">
            Para onde vai
          </h2>
          <p className="apoiar-lide">
            O apoio vai para quem mantém o projeto, uma pessoa física, e não para a Prefeitura de Orleans nem para órgão
            de controle nenhum.
          </p>
          <p>Não é doação a entidade: não é dedutível do imposto de renda.</p>
          <p>
            Ele paga a hospedagem e o domínio do site e, o que sobrar, o tempo de manter as coletas, as conferências e
            as páginas novas.
          </p>
        </section>

        <section className="apoiar-pix" aria-labelledby="apoiar-pix-titulo">
          <h2 id="apoiar-pix-titulo">Pix</h2>
          <img
            className="apoiar-qr"
            src="/api/apoio/qrcode.svg"
            alt="QR Code do Pix para apoiar o Orleans em Dados"
            width={280}
            height={280}
          />
          <p className="apoiar-instrucao">
            Aponte a câmera do app do banco, ou copie o código. Não há valor fixo: o app do banco pede o valor.
          </p>
          <div className="apoiar-campo">
            <label className="apoiar-rotulo" htmlFor="apoiar-codigo">
              Pix copia e cola
            </label>
            <div className="apoiar-copia">
              <input
                id="apoiar-codigo"
                ref={campo}
                className="apoiar-codigo"
                readOnly
                value={apoio.copiaECola}
                onFocus={(evento) => evento.currentTarget.select()}
              />
              <button type="button" className="apoiar-copiar" onClick={copiar}>
                Copiar código
              </button>
            </div>
            <span role="status" className="apoiar-aviso">
              {aviso}
            </span>
          </div>
          <dl className="apoiar-dados">
            {/* O espaço entre termo e valor fica no texto (leitores de tela, copiar e colar); na grade, não aparece. */}
            <dt>Chave Pix:</dt> <dd>{apoio.chave}</dd>
            <dt>Quem recebe:</dt>{' '}
            <dd>
              {apoio.nome}, {apoio.cidade}
            </dd>
          </dl>
        </section>

        <section className="apoiar-lado" aria-labelledby="apoiar-outras-titulo">
          <h2 id="apoiar-outras-titulo" className="apoiar-rotulo">
            Outras formas
          </h2>
          <p className="apoiar-lide">Sem dinheiro também ajuda.</p>
          <ul className="apoiar-formas">
            <li>
              <span>Avisar de um número que não bate com a fonte</span>
              <a href={ISSUE_DADO}>Dado divergente</a>
            </li>
            <li>
              <span>Sugerir uma página, um indicador ou uma fonte</span>
              <a href={ISSUE_SUGESTAO}>Sugestão</a>
            </li>
            <li>
              <span>Mexer no código, ou o que mais der</span>
              <a href={CONTRIBUIR}>Outras formas de ajudar</a>
            </li>
          </ul>
          <p className="apoiar-destaque">O projeto continua aberto e de graça para todo mundo, com ou sem apoio.</p>
        </section>
      </div>
    </article>
  );
}
