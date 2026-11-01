// Selos da conferência Betha × TCE-SC exibidos nas páginas de dados.
// A conferência vem de /api/conferencias; sem as duas fontes publicadas, não há selo.
// Linguagem: "provável"/"possível" quando a causa não foi comprovada.

import { useApi } from './api.js';
import { data, MESES_LONGOS, moeda, numero } from './format.js';

const N = Number;
const centavos = (v) => Math.round(N(v ?? 0) * 100);
// Diferença Betha − TCE por extenso, sem sinal: o leitor não precisa saber a ordem da subtração.
const sinal = (v) => `${moeda(Math.abs(v))} a mais ${v > 0 ? 'na Betha' : 'no TCE-SC'}`;
const ICONES = { confere: '✓', diverge: '!', pendente: '…' };

export function useConferencia(ano) {
  const { dados } = useApi(ano ? `/api/conferencias?ano=${ano}` : null);
  return dados?.disponivel ? dados : null;
}

// `compacto`: versão de linha de tabela, sem link.
export function Selo({ selo, compacto = false }) {
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

// No ano em curso, o TCE ainda não recebeu os últimos meses: isso é pendência, não divergência.
const pendencia = (conf, tipo) =>
  !conf.parcial
    ? null
    : `${tipo === 'empenhos' ? `Empenhos após ${data(conf.limites.dataEmpenho)}` : `Meses após ${MESES_LONGOS[conf.limites.mesReceita - 1]}`} ainda não conferidos: o TCE-SC recebe os dados com atraso.`;

const doRecorte = (linhas, entidade) => (entidade ? linhas.filter((l) => l.codigoEntidade === entidade) : linhas);

// Receita arrecadada da entidade (ou de todas) contra o TCE, com a maior causa apontada.
export function seloReceita(conf, entidade) {
  if (!conf) return null;
  const linhas = doRecorte(conf.receitaPorEntidade, entidade);
  if (!linhas.length) return null;
  const dif = linhas.reduce((s, l) => s + centavos(l.diferenca), 0) / 100;
  const ate = conf.parcial ? ` até ${MESES_LONGOS[conf.limites.mesReceita - 1]}` : '';
  if (dif === 0) {
    return { estado: 'confere', titulo: `Confere com o TCE-SC${ate}`, motivo: pendencia(conf, 'receitas') };
  }
  const rubricas = doRecorte(conf.receitaPorNatureza, entidade);
  const [maior] = rubricas;
  const outras = rubricas.length - 1;
  return {
    estado: 'diverge',
    titulo: `Difere do TCE-SC: ${sinal(dif)}${ate}`,
    motivo: [
      maior &&
        `Maior diferença: rubrica ${maior.natureza} (${maior.entidade}), ${sinal(maior.diferenca)}. ${maior.nota}`,
      outras > 0 && `Há mais ${outras} rubrica${outras > 1 ? 's' : ''} com diferença.`,
      pendencia(conf, 'receitas'),
    ]
      .filter(Boolean)
      .join(' '),
  };
}

// Empenhos (57140) da entidade contra o TCE, registro a registro.
export function seloEmpenhos(conf, entidade) {
  if (!conf) return null;
  const linhas = doRecorte(conf.empenhos, entidade);
  if (!linhas.length) return null;
  const soma = (k) => linhas.reduce((s, l) => s + N(l[k]), 0);
  const soBetha = soma('soBetha');
  const soTce = soma('soTce');
  const ate = conf.parcial ? ` até ${data(conf.limites.dataEmpenho)}` : '';
  if (!soBetha && !soTce) {
    return {
      estado: 'confere',
      titulo: `Todos os ${numero(soma('casados'))} empenhos constam no TCE-SC${ate}`,
      motivo: pendencia(conf, 'empenhos'),
    };
  }
  const semPar = doRecorte(conf.empenhosSemPar, entidade).filter((e) => e.fonte === 'betha');
  const antigos = semPar.filter((e) => e.numeroNaOutra || e.ocorrencia > 1).length;
  return {
    estado: 'diverge',
    titulo: soBetha
      ? `${numero(soBetha)} empenhos não constam no TCE-SC (${moeda(soma('valorSoBetha'))})`
      : `${numero(soTce)} empenhos do TCE-SC não aparecem aqui`,
    motivo: [
      antigos &&
        `${numero(antigos)} deles parecem versões antigas de empenhos renumerados ou registros repetidos: aparecem na lista, mas ficam fora das somas desta página.`,
      soBetha && soTce && `Outros ${numero(soTce)} empenhos do TCE-SC (${moeda(soma('valorSoTce'))}) não aparecem na Betha.`,
      pendencia(conf, 'empenhos'),
    ]
      .filter(Boolean)
      .join(' '),
  };
}

// Despesa orçamentária (57170) contra o TCE-SC por entidade, nas três etapas.
// No ano em curso o TCE está incompleto: o selo usa a conferência empenho a empenho.
export function seloDespesa(conf, entidade) {
  if (!conf) return null;
  if (conf.parcial) return seloEmpenhos(conf, entidade);
  const linhas = conf.despesaPorEntidade.filter(
    (l) => l.comparavel && (!entidade || l.entidadeBetha === entidade),
  );
  if (!linhas.length) return null;
  const dif = (k) => linhas.reduce((s, l) => s + centavos(l[k]), 0) / 100;
  const [e, l, p] = [dif('difEmpenhado'), dif('difLiquidado'), dif('difPago')];
  if (!e && !l && !p) {
    return { estado: 'confere', titulo: 'Confere com o TCE-SC', motivo: 'Empenhado, liquidado e pago iguais ao centavo.' };
  }
  const divergentes = linhas.filter((x) => x.difEmpenhado || x.difLiquidado || x.difPago).map((x) => x.sigla);
  const empenhos = seloEmpenhos(conf, entidade);
  // Cada etapa por extenso; a primeira que diverge vai para o título.
  const etapas = [['Empenhado', e], ['Liquidado', l], ['Pago', p]];
  const [nome, valor] = etapas.find(([, v]) => v !== 0);
  const demais = etapas
    .filter(([n]) => n !== nome)
    .map(([n, v], i) => [i ? n.toLocaleLowerCase('pt-BR') : n, v])
    .map(([n, v]) => (v === 0 ? `${n} igual` : `${n}: ${sinal(v)}`));
  return {
    estado: 'diverge',
    titulo: `${nome} difere do TCE-SC: ${sinal(valor)}`,
    motivo: [
      `${demais.join('; ')}. Diferença em: ${divergentes.join(', ')}.`,
      empenhos?.estado === 'diverge' && `Na comparação empenho a empenho: ${empenhos.titulo.charAt(0).toLocaleLowerCase('pt-BR') + empenhos.titulo.slice(1)}.`,
    ]
      .filter(Boolean)
      .join(' '),
  };
}

// Selo de uma rubrica da Betha (código de 14 dígitos), comparada no nível de 8 dígitos.
export function seloRubrica(conf, rubrica, siglas) {
  const d = conf?.receitaPorNatureza.find((n) => n.natureza === rubrica.slice(0, 8) && siglas.has(n.entidade));
  if (!d) return null;
  const ate = conf.parcial ? ` até ${MESES_LONGOS[conf.limites.mesReceita - 1]}` : '';
  return {
    estado: 'diverge',
    titulo: `Difere do TCE-SC: ${sinal(d.diferenca)}${ate}`,
    motivo: `Grupo ${d.natureza} (${d.entidade}): Betha ${moeda(d.betha ?? 0)}, TCE ${d.tce === null ? 'não consta' : moeda(d.tce)}. ${d.nota}`,
  };
}

// Selo de um empenho da lista, pelo ID Betha.
export function seloEmpenho(conf, id) {
  const e = conf?.empenhosSemPar.find((x) => x.fonte === 'betha' && x.id === id);
  if (!e) return null;
  return { estado: 'diverge', titulo: 'Não consta no TCE-SC', motivo: e.nota };
}
