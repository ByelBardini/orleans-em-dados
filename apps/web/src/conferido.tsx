// O que as páginas de dados dizem sobre a conferência: a conta até o total da fonte, o que aguarda o
// TCE-SC e o estado sem conferência. Os valores vêm do bloco `conferencia` da API; nada é recalculado.
import type { DespesasResumo, Receitas } from '@orleans-em-dados/contracts';
import type { ReactNode } from 'react';
import { MESES_LONGOS, moeda } from './format';
import { Selo } from './selo';
import { seloAguardando } from './selos';

/** "até setembro de 2026" no ano em curso; vazio no encerrado, em que o ano inteiro está conferido. */
export const ateOMes = (parcial: boolean | null | undefined, mes: number | null | undefined, ano: number) =>
  parcial && mes ? `até ${MESES_LONGOS[mes - 1]} de ${ano}` : '';

export const LINK_DISCREPANCIAS = '#discrepancias';

// `semLink` e `titulo`: na própria seção, a conta não aponta para si mesma e diz de qual área é.
type Apresentacao = { semLink?: boolean; titulo?: string };

function Conta({
  linhas,
  total,
  semLink = false,
  titulo = 'A conta do conferido',
  children,
}: Apresentacao & {
  linhas: readonly { rotulo: string; valor: number | null }[];
  total: { rotulo: string; valor: number | null };
  children?: ReactNode;
}) {
  return (
    <div className="conta" role="group" aria-label={titulo}>
      <dl>
        {linhas.map((l) => (
          <div key={l.rotulo}>
            <dt>{l.rotulo}</dt>
            <dd>{moeda(l.valor)}</dd>
          </div>
        ))}
        <div className="conta-total">
          <dt>{total.rotulo}</dt>
          <dd>{moeda(total.valor)}</dd>
        </div>
      </dl>
      {children}
      {!semLink && (
        <a href={LINK_DISCREPANCIAS} className="selo-link">
          Ver discrepâncias →
        </a>
      )}
    </div>
  );
}

// A receita fecha pela Betha: conferido + em discrepância + aguardando = total da Betha.
export function ContaDaReceita({
  conferencia: c,
  ...apresentacao
}: Apresentacao & { conferencia: Receitas['conferencia'] }) {
  const soNoTce = Number(c.diferencaTce) > 0;
  const abaixoDasDuas = Number(c.conferido) < Number(c.totalBetha) && Number(c.conferido) < Number(c.totalTce);
  return (
    <Conta
      {...apresentacao}
      linhas={[
        { rotulo: 'conferido', valor: c.conferido },
        { rotulo: '+ em discrepância', valor: c.diferencaBetha },
        ...(Number(c.aguardandoTce) > 0 ? [{ rotulo: '+ aguardando TCE', valor: c.aguardandoTce }] : []),
      ]}
      total={{ rotulo: '= total da Betha', valor: c.totalBetha }}
    >
      {soNoTce && <p className="conta-nota">Só o TCE-SC registra mais {moeda(c.diferencaTce)}, fora desta conta.</p>}
      {abaixoDasDuas && (
        <p className="conta-nota">
          O conferido é só o que as duas fontes registram; por isso pode ficar abaixo de cada uma.
        </p>
      )}
    </Conta>
  );
}

// A despesa só tem conta no exercício encerrado: empenhado, pela 57170.
export function ContaDaDespesa({
  conferido,
  conferencia: c,
  ...apresentacao
}: Apresentacao & {
  conferido: number | null;
  conferencia: DespesasResumo['conferencia'];
}) {
  if (c.totalBetha === null) return null;
  return (
    <Conta
      {...apresentacao}
      linhas={[
        { rotulo: 'conferido', valor: conferido },
        { rotulo: '+ em discrepância', valor: c.diferencaBetha },
      ]}
      total={{ rotulo: '= total da Betha', valor: c.totalBetha }}
    />
  );
}

// Os empenhos, em valor original (57140): casados + sem par na Betha + aguardando = total da 57140.
// Outra visão da mesma execução: nunca soma com a despesa.
export function ContaDosEmpenhos({
  conferido,
  emDiscrepancia,
  aguardando,
  total,
  soNoTce,
  titulo,
}: {
  conferido: number | null;
  emDiscrepancia: number;
  aguardando: number;
  total: number;
  soNoTce: number;
  titulo: string;
}) {
  return (
    <Conta
      semLink
      titulo={titulo}
      linhas={[
        { rotulo: 'conferido', valor: conferido },
        { rotulo: '+ em discrepância', valor: emDiscrepancia },
        ...(aguardando > 0 ? [{ rotulo: '+ aguardando TCE', valor: aguardando }] : []),
      ]}
      total={{ rotulo: '= total da Betha', valor: total }}
    >
      {soNoTce > 0 && <p className="conta-nota">Só o TCE-SC registra mais {moeda(soNoTce)}, fora desta conta.</p>}
    </Conta>
  );
}

export function AvisoDaReceitaAguardando({
  valor,
  mes,
}: {
  valor: number | null | undefined;
  mes: number | null | undefined;
}) {
  if (!(Number(valor) > 0)) return null;
  const depois = mes ? ` depois de ${MESES_LONGOS[mes - 1]}` : '';
  return (
    <Selo
      selo={seloAguardando(
        `${moeda(valor)} da Betha${depois} ainda não chegaram ao TCE-SC, que recebe os dados com atraso. Entram quando a remessa chegar.`,
      )}
    />
  );
}

const NOMES_DAS_COLETAS: Record<string, string> = {
  receitas: 'receitas da Betha',
  despesas: 'despesas da Betha',
  empenhos: 'empenhos da Betha',
  tcesc_receitas: 'receitas do TCE-SC',
  tcesc_empenhos: 'empenhos do TCE-SC',
};

// Sem as duas fontes não há o que conferir, e a página não mostra número nenhum.
export function SemConferencia({ ano, faltando }: { ano: number; faltando?: readonly string[] | undefined }) {
  const coletas = (faltando ?? []).map((f) => NOMES_DAS_COLETAS[f] ?? f);
  return (
    <section className="secao solta sem-conferencia">
      <h1 className="secao-titulo">Ainda não dá para conferir {ano}.</h1>
      <p className="nota-serif">
        Este painel só mostra o que foi conferido entre as fontes, e {ano} ainda não tem as duas publicadas.
        {coletas.length > 0 && ` Falta publicar: ${coletas.join(', ')}.`} Por isso, nenhum valor aparece aqui.
      </p>
    </section>
  );
}
