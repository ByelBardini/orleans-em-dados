// O selo na tela, com a regra de selos.ts.
import { importacoesSchema } from '@orleans-em-dados/contracts';
import { useApi } from './api';
import { seloDeAtraso, type DadosDoSelo } from './selos';

const ICONES = { confere: '✓', pendente: '…', 'fonte-unica': '–' };

// Só o conferido pode ter caso na seção: fonte única e pendência não levam a ela.
// `compacto`: versão de linha de tabela, sem link. `semLink`: o link já está ao lado, na conta.
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
      {!compacto && !semLink && selo.estado === 'confere' && (
        <a href="#discrepancias" className="selo-link">
          Ver discrepâncias →
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
