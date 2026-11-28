// O que as páginas de dados dizem sobre a conferência: a conta até o total da fonte, o que aguarda o
// TCE-SC e o estado sem conferência. Os valores vêm do bloco `conferencia` da API; nada é recalculado.
import type { DespesasResumo, Receitas } from '@orleans-em-dados/contracts';
import type { ReactNode } from 'react';
import { emMilhoes, MESES_LONGOS, moeda, pct } from './format';
import {
  avisoDeLacuna,
  DESDE_QUANDO_O_TCE_PUBLICA,
  naoPublica,
  naoPublicaNaBetha,
  notaDaDeducao,
} from './semConferencia';

/** "até setembro de 2026" no ano em curso; vazio no encerrado, em que o ano inteiro está conferido. */
export const ateOMes = (parcial: boolean | null | undefined, mes: number | null | undefined, ano: number) =>
  parcial && mes ? `até ${MESES_LONGOS[mes - 1]} de ${ano}` : '';

export const LINK_DISCREPANCIAS = '/discrepancias';

// A especificação (§7.3) pede que a comparação diga isto. É a única frase da interface com estas palavras.
export const FRASE_DA_DIFERENCA =
  'Diferença entre fontes pode decorrer de critério, abrangência ou atualização, e não indica, por si só, erro nem irregularidade.';

// `semLink` e `titulo`: na própria seção, a conta não aponta para si mesma e diz de qual área é.
// `explicada`: a conta deitada, de `SecaoDaConta`, em que cada parcela diz o que é.
type Apresentacao = { semLink?: boolean; titulo?: string; explicada?: boolean };
type Linha = { rotulo: string; valor: number | null; explicacao?: string };

const EM_DISCREPANCIA = 'A parte do Portal da Transparência que difere do TCE-SC. Cada caso está em Discrepâncias.';
const TOTAL_DA_BETHA = 'O total publicado no portal da transparência do município.';

/** A linha à vista da conta: o conferido e a parte que ele é do total do Portal da Transparência. O total fica só na
 *  conta, nunca como número. Conferido zero diz que nada confere, sem "0%"; sem total ou conferido, não há linha. */
export function linhaDoConferido({
  area,
  conferido,
  total,
}: {
  area?: string;
  conferido: number | string | null;
  total: number | string | null;
}): string | null {
  if (conferido === null || total === null || Number(total) === 0) return null;
  const inicio = area ? `${area}: ` : '';
  if (Number(conferido) === 0) return `${inicio}nada confere entre as fontes neste recorte.`;
  return `${inicio}${emMilhoes(Number(conferido))} conferidos, ${pct(Number(conferido), Number(total))} do total do Portal da Transparência.`;
}

// Os cartões ficam com o número. Aqui fica uma linha por área, à vista, e a conta explicada, recolhida: as fontes e o
// que cada parcela quer dizer abrem em "Ver a conta".
export function SecaoDaConta({
  titulo,
  resumo,
  children,
}: {
  titulo: string;
  resumo: readonly string[];
  children: ReactNode;
}) {
  return (
    <section className="secao solta faixa-conta">
      <h2 className="secao-titulo">{titulo}</h2>
      {resumo.map((linha) => (
        <p key={linha} className="conta-resumo">
          {linha}
        </p>
      ))}
      <details className="conta-detalhes">
        <summary>Ver a conta</summary>
        <p className="nota-serif">
          O número do cartão é só o que as duas fontes registram igual: o Portal da Transparência do município, e o
          TCE-SC, sistema do Tribunal de Contas do Estado. O resto continua na conta, separado.
        </p>
        {children}
      </details>
    </section>
  );
}

function Conta({
  linhas,
  total,
  semLink = false,
  titulo = 'A conta do conferido',
  explicada = false,
  children,
}: Apresentacao & {
  linhas: readonly Linha[];
  total: Linha;
  children?: ReactNode;
}) {
  return (
    <div className={`conta${explicada ? ' conta-explicada' : ''}`} role="group" aria-label={titulo}>
      <dl>
        {linhas.map((l) => (
          <div key={l.rotulo}>
            <dt>{l.rotulo}</dt>
            <dd>{moeda(l.valor)}</dd>
            {explicada && l.explicacao && <dd className="conta-explica">{l.explicacao}</dd>}
          </div>
        ))}
        <div className="conta-total">
          <dt>{total.rotulo}</dt>
          <dd>{moeda(total.valor)}</dd>
          {explicada && total.explicacao && <dd className="conta-explica">{total.explicacao}</dd>}
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
  const mes = c.limites?.mesReceita;
  const aguarda = `${mes ? `Depois de ${MESES_LONGOS[mes - 1]}, ainda` : 'Ainda'} não chegou ao TCE-SC, que recebe os dados com atraso. Entra quando a remessa chegar.`;
  return (
    <Conta
      {...apresentacao}
      linhas={[
        {
          rotulo: 'conferido',
          valor: c.conferido,
          explicacao: 'O que o Portal da Transparência e o TCE-SC registram igual, ao centavo. É o número do cartão.',
        },
        { rotulo: '+ em discrepância', valor: c.diferencaBetha, explicacao: EM_DISCREPANCIA },
        ...(Number(c.aguardandoTce) > 0
          ? [{ rotulo: '+ aguardando TCE', valor: c.aguardandoTce, explicacao: aguarda }]
          : []),
      ]}
      total={{ rotulo: '= total do Portal da Transparência', valor: c.totalBetha, explicacao: TOTAL_DA_BETHA }}
    >
      {soNoTce && <p className="conta-nota">Só o TCE-SC registra mais {moeda(c.diferencaTce)}, fora desta conta.</p>}
      {c.receitaBruta && c.deducaoSoTce !== null && c.deducaoSoTce !== 0 && (
        <p className="conta-nota">{notaDaDeducao(c.deducaoSoTce)}</p>
      )}
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
        {
          rotulo: 'conferido',
          valor: conferido,
          explicacao:
            'O empenhado que o Portal da Transparência e o TCE-SC registram igual, por entidade, já descontadas as anulações. É o número do cartão.',
        },
        { rotulo: '+ em discrepância', valor: c.diferencaBetha, explicacao: EM_DISCREPANCIA },
      ]}
      total={{ rotulo: '= total do Portal da Transparência', valor: c.totalBetha, explicacao: TOTAL_DA_BETHA }}
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
      total={{ rotulo: '= total do Portal da Transparência', valor: total }}
    >
      {soNoTce > 0 && <p className="conta-nota">Só o TCE-SC registra mais {moeda(soNoTce)}, fora desta conta.</p>}
    </Conta>
  );
}

type EntidadeSemBetha = Receitas['conferencia']['entidadesSemBetha'][number];

/** Acima da manchete: a fonte única (o TCE-SC não publica o ano) e, em destaque, a entidade que a Betha
 *  não publica, com o que o TCE-SC registra dela. Os dois limitam o que o número quer dizer. */
export function AvisosDaConferencia({
  ano,
  fonteUnica,
  lacunas = [],
}: {
  ano: number;
  fonteUnica?: string | null;
  lacunas?: readonly EntidadeSemBetha[];
}) {
  if (!fonteUnica && !lacunas.length) return null;
  return (
    <div className="avisos-da-conferencia">
      {fonteUnica && <p className="aviso-neutro">{fonteUnica}</p>}
      {lacunas.map((e) => (
        <p key={e.codigo} className="aviso">
          {avisoDeLacuna(e, ano)} <a href={LINK_DISCREPANCIAS}>Ver discrepâncias →</a>
        </p>
      ))}
    </div>
  );
}

/** Conferência disponível e nada conferido: o cartão diz por quê, em vez de mostrar R$ 0,0. Nulo quando
 *  há conferido, ou quando não há conferência (fonte única, exemplo, sem as duas fontes). */
export function motivoSemConferido(c: Receitas['conferencia'], ano: number): ReactNode | null {
  if (!c.disponivel || c.fonteUnica || Number(c.conferido) !== 0) return null;
  const [lacuna] = c.entidadesSemBetha;
  if (lacuna) return `Sem parte conferida. ${naoPublicaNaBetha(lacuna.entidade, ano)}.`;
  return (
    <>
      Nada confere entre as fontes neste recorte. <a href={LINK_DISCREPANCIAS}>Ver discrepâncias</a>
    </>
  );
}

const NOMES_DAS_COLETAS: Record<string, string> = {
  receitas: 'receitas do Portal da Transparência',
  despesas: 'despesas do Portal da Transparência',
  empenhos: 'empenhos do Portal da Transparência',
  tcesc_receitas: 'receitas do TCE-SC',
  tcesc_empenhos: 'empenhos do TCE-SC',
};

// Sem as duas fontes não há o que conferir, e a página não mostra número nenhum.
export function SemConferencia({
  ano,
  faltando,
  foraDaFonte,
}: {
  ano: number;
  faltando?: readonly string[] | undefined;
  foraDaFonte?: readonly string[] | undefined;
}) {
  if (foraDaFonte?.length) {
    return (
      <section className="secao solta sem-conferencia">
        <h1 className="secao-titulo">{naoPublica(foraDaFonte, ano)}.</h1>
        <p className="nota-serif">
          Este painel só mostra o que foi conferido entre as fontes. {DESDE_QUANDO_O_TCE_PUBLICA} Por isso, nenhum valor
          de {ano} aparece aqui.
        </p>
      </section>
    );
  }
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
