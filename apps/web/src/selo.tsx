// O selo na tela e a conferência que alimenta a regra de selos.ts.
// A conferência vem de /api/conferencias; sem as duas fontes publicadas, não há selo.
import { conferenciaSchema, importacoesSchema } from '@orleans-em-dados/contracts';
import { useApi } from './api';
import { seloDeAtraso, type DadosDoSelo } from './selos';

const ICONES = { confere: '✓', diverge: '!', pendente: '…' };

export function useConferencia(ano: number | null) {
  const { dados } = useApi(ano ? `/api/conferencias?ano=${ano}` : null, conferenciaSchema);
  return dados;
}

// `compacto`: versão de linha de tabela, sem link. `semLink`: tamanho normal, mas o selo não é da conferência.
export function Selo({
  selo,
  compacto = false,
  semLink = false,
}: {
  selo: DadosDoSelo | null;
  compacto?: boolean;
  semLink?: boolean;
}) {
  if (!selo) return null;
  return (
    <span className={`selo ${selo.estado}${compacto ? ' compacto' : ''}`}>
      <span className="selo-titulo">
        <span className="selo-icone" aria-hidden="true">
          {ICONES[selo.estado]}
        </span>
        {selo.titulo}
      </span>
      {selo.motivo && <span className="selo-motivo">{selo.motivo}</span>}
      {!compacto && !semLink && (
        <a href="#conferencia" className="selo-link">
          Ver conferência →
        </a>
      )}
    </span>
  );
}

// Se /api/importacoes estiver fora do ar, a página continua com o dado, sem aviso falso.
export function AvisoDeAtraso({ indicador, ano }: { indicador: string; ano: number }) {
  const { dados } = useApi('/api/importacoes', importacoesSchema);
  return <Selo semLink selo={seloDeAtraso(dados, indicador, ano, new Date())} />;
}
