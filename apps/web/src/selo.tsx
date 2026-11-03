// O selo na tela, com a regra de selos.ts. Conferido e fonte única são um símbolo, com o texto ao passar o mouse,
// tocar ou focar. Pendência fica escrita: fictício, atrasado ou aguardando muda como o número é lido.
import { importacoesSchema } from '@orleans-em-dados/contracts';
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent } from 'react';
import { useApi } from './api';
import { seloDeAtraso, type DadosDoSelo } from './selos';

const ICONES = { confere: '✓', pendente: '…', 'fonte-unica': '–' };
const LARGURA_DO_TEXTO = 280;
const ALTURA_DO_TEXTO = 140;
const MARGEM = 8;
const AFASTAMENTO = 6;

// O texto fica fixo na janela: a tabela com rolagem cortaria um balão preso ao símbolo.
function posicaoDoTexto(simbolo: DOMRect): CSSProperties {
  const largura = Math.min(LARGURA_DO_TEXTO, window.innerWidth - 2 * MARGEM);
  const left = Math.max(MARGEM, Math.min(simbolo.left, window.innerWidth - largura - MARGEM));
  return simbolo.bottom + ALTURA_DO_TEXTO > window.innerHeight
    ? { left, width: largura, bottom: window.innerHeight - simbolo.top + AFASTAMENTO }
    : { left, width: largura, top: simbolo.bottom + AFASTAMENTO };
}

function LinkDaSecao() {
  return (
    <a href="#discrepancias" className="selo-link">
      Ver discrepâncias →
    </a>
  );
}

function SeloEmSimbolo({ selo, comLink }: { selo: DadosDoSelo; comLink: boolean }) {
  const [posicao, setPosicao] = useState<CSSProperties | null>(null);
  const raiz = useRef<HTMLSpanElement>(null);
  const aberto = posicao !== null;
  const fechar = () => setPosicao(null);
  const abrir = () => {
    const simbolo = raiz.current?.getBoundingClientRect();
    if (simbolo) setPosicao(posicaoDoTexto(simbolo));
  };
  const aoSairDoFoco = (evento: FocusEvent) => {
    if (!raiz.current?.contains(evento.relatedTarget)) fechar();
  };

  useEffect(() => {
    if (!aberto) return;
    const aoTocar = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) fechar();
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') fechar();
    };
    document.addEventListener('pointerdown', aoTocar);
    document.addEventListener('keydown', aoTeclar);
    window.addEventListener('scroll', fechar, true);
    return () => {
      document.removeEventListener('pointerdown', aoTocar);
      document.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('scroll', fechar, true);
    };
  }, [aberto]);

  return (
    <span
      ref={raiz}
      className={`selo simbolo ${selo.estado}${aberto ? ' aberto' : ''}`}
      onMouseEnter={abrir}
      onMouseLeave={fechar}
      onFocus={abrir}
      onBlur={aoSairDoFoco}
    >
      <button
        type="button"
        className="selo-icone"
        aria-label={selo.motivo ? `${selo.titulo}. ${selo.motivo}` : selo.titulo}
        aria-expanded={aberto}
        onClick={abrir}
      >
        {ICONES[selo.estado]}
      </button>
      <span className="selo-texto" style={posicao ?? undefined}>
        <span className="selo-titulo">{selo.titulo}</span>
        {selo.motivo && <span className="selo-motivo">{selo.motivo}</span>}
        {comLink && <LinkDaSecao />}
      </span>
    </span>
  );
}

// Só o conferido pode ter caso na seção: fonte única e pendência não levam a ela.
// `compacto`: versão de linha de tabela, sem link. `semLink`: o link já está ao lado, na conta.
// `comTexto`: o selo é o próprio conteúdo, como a situação de um caso, e fica escrito.
export function Selo({
  selo,
  compacto = false,
  semLink = false,
  comTexto = false,
}: {
  selo: DadosDoSelo | null;
  compacto?: boolean;
  semLink?: boolean;
  comTexto?: boolean;
}) {
  if (!selo) return null;
  const comLink = !compacto && !semLink && selo.estado === 'confere';
  if (!comTexto && selo.estado !== 'pendente') return <SeloEmSimbolo selo={selo} comLink={comLink} />;
  return (
    <span className={`selo ${selo.estado}${compacto ? ' compacto' : ''}`}>
      <span className="selo-titulo">
        <span className="selo-icone" aria-hidden="true">
          {ICONES[selo.estado]}
        </span>
        {selo.titulo}
      </span>
      {selo.motivo && <span className="selo-motivo">{selo.motivo}</span>}
      {comLink && <LinkDaSecao />}
    </span>
  );
}

// Se /api/importacoes estiver fora do ar, a página continua com o dado, sem aviso falso.
export function AvisoDeAtraso({ indicador, ano }: { indicador: string; ano: number }) {
  const { dados } = useApi('/api/importacoes', importacoesSchema);
  return <Selo semLink selo={seloDeAtraso(dados, indicador, ano, new Date())} />;
}
