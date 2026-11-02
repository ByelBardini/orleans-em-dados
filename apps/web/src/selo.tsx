// O selo na tela e a conferência que alimenta a regra de selos.ts.
// A conferência vem de /api/conferencias; sem as duas fontes publicadas, não há selo.
import { conferenciaSchema } from '@orleans-em-dados/contracts';
import { useApi } from './api';
import type { DadosDoSelo } from './selos';

const ICONES = { confere: '✓', diverge: '!', pendente: '…' };

export function useConferencia(ano: number | null) {
  const { dados } = useApi(ano ? `/api/conferencias?ano=${ano}` : null, conferenciaSchema);
  return dados;
}

// `compacto`: versão de linha de tabela, sem link.
export function Selo({ selo, compacto = false }: { selo: DadosDoSelo | null; compacto?: boolean }) {
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
      {!compacto && (
        <a href="#conferencia" className="selo-link">
          Ver conferência →
        </a>
      )}
    </span>
  );
}
