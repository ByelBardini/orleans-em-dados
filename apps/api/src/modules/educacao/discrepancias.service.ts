// O que as fontes da educação registram de diferente, em todos os exercícios. Só mostra os valores: os demonstrativos
// não explicam a diferença, e nada aqui afirma causa. Fora de /api/discrepancias?ano e da conta do ano.
import type { EducacaoDiscrepancias } from '@orleans-em-dados/contracts';
import { conferirGastoEducacao } from '@orleans-em-dados/db/conferencias';
import { financasDosLotes, funcao12Liquidada, type LinhaDeFinanca } from './discrepancias.dao';
import { faltandoDe, fonteDoLote, lotesDeMaiorAno, lotesDeTodosOsAnos, type LoteDeEducacao } from './educacao.comum';

type Grupo = EducacaoDiscrepancias['grupos'][number];
type Caso = Grupo['casos'][number];
type Lado = Caso['a'];

const CONSULTAS = ['siope_anexo8', 'siconfi_indices', 'siconfi_funcoes'];

const INDICES = [
  { indicador: 'indice_educacao', item: 'Aplicação em educação' },
  { indicador: 'fundeb_remuneracao', item: 'Fundeb na remuneração' },
];
const GASTO = 'gasto_total';
const RECORTE_DO_GASTO = 'liquidado';

const NOME_DA_ETAPA = { empenhado: 'Empenhado', liquidado: 'Liquidado', pago: 'Pago' };

const NOTA_SEM_VALOR = 'Uma das fontes não traz o valor deste ano, e só os percentuais ficam lado a lado.';

const emCentavos = (valor: number) => Math.round(valor * 100);

const soValor = (valor: number): Lado => ({ valor, percentual: null });

/** Caso é valor diferente, mesmo com o percentual igual. Sem o valor de um lado não há diferença a calcular: o caso só
 *  existe se os dois percentuais existem e diferem. Valor igual nunca é caso. */
function casoDe(ano: number, item: string, a: Lado, b: Lado): Caso | null {
  if (a.valor !== null && b.valor !== null) {
    const diferenca = emCentavos(a.valor) - emCentavos(b.valor);
    if (diferenca === 0) return null;
    return { ano, item, a, b, diferenca: Math.abs(diferenca) / 100, maior: diferenca > 0 ? 'a' : 'b', nota: null };
  }
  if (a.percentual === null || b.percentual === null || a.percentual === b.percentual) return null;
  return { ano, item, a, b, diferenca: null, maior: null, nota: NOTA_SEM_VALOR };
}

const paraLado = ({ valor, percentual }: LinhaDeFinanca): Lado => ({ valor, percentual });

const presente = <T>(caso: T | null): caso is T => caso !== null;

const fonteDoSiope = (lote: LoteDeEducacao): Grupo['fonteA'] => ({
  coluna: 'SIOPE',
  lado: 'no SIOPE',
  ...fonteDoLote(lote, 'SIOPE, Anexo 8'),
});
const fonteDoSiconfi = (lote: LoteDeEducacao, nome: string): Grupo['fonteA'] => ({
  coluna: 'SICONFI',
  lado: 'no SICONFI',
  ...fonteDoLote(lote, nome),
});

const NOME_DA_DCA = 'SICONFI, DCA Anexo I-E';

/** A função 12 × as ações da Betha, nos anos com DCA. Só o estado `diferenca` vira caso, e cada etapa fica à parte. */
async function casosDasAcoes(anos: readonly number[]) {
  const conferencias = await Promise.all(anos.map(conferirGastoEducacao));
  return conferencias.flatMap((c) =>
    c.estado === 'diferenca'
      ? c.etapas.map((e) => casoDe(c.ano, NOME_DA_ETAPA[e.etapa], soValor(e.dca), soValor(e.betha))).filter(presente)
      : [],
  );
}

export async function discrepanciasDeEducacao(): Promise<EducacaoDiscrepancias> {
  const lotes = await lotesDeTodosOsAnos(CONSULTAS);
  const faltando = faltandoDe(CONSULTAS, lotes);
  if (faltando.length) return { disponivel: false, faltando, grupos: [] };

  const dosLotes = (chave: string) => lotes.filter((l) => l.chave === chave);
  const doAnexo8 = dosLotes('siope_anexo8');
  const indicadores = INDICES.map((i) => i.indicador);
  const [linhasDoAnexo8, linhasDoAnexo14, funcao12] = await Promise.all([
    financasDosLotes(doAnexo8, [...indicadores, GASTO]),
    financasDosLotes(dosLotes('siconfi_indices'), indicadores),
    funcao12Liquidada(),
  ]);
  const anos = doAnexo8.map((l) => l.ano).sort((a, b) => a - b);

  const indices = anos.flatMap((ano) =>
    INDICES.map(({ indicador, item }) => {
      const naLinha = (l: LinhaDeFinanca) => l.ano === ano && l.indicador === indicador && l.recorte === '';
      const a = linhasDoAnexo8.find(naLinha);
      const b = linhasDoAnexo14.find(naLinha);
      return a && b ? casoDe(ano, item, paraLado(a), paraLado(b)) : null;
    }).filter(presente),
  );

  const gastoTotal = anos
    .map((ano) => {
      const a = linhasDoAnexo8.find((l) => l.ano === ano && l.indicador === GASTO && l.recorte === RECORTE_DO_GASTO);
      const b = funcao12.find((l) => l.ano === ano);
      return a && b ? casoDe(ano, 'Gasto liquidado', paraLado(a), soValor(b.valor)) : null;
    })
    .filter(presente);

  const acoes = await casosDasAcoes(funcao12.map((l) => l.ano));
  // Sem `faltando`, as três consultas têm lote.
  const primeiro = (chave: string) => dosLotes(chave)[0] as LoteDeEducacao;
  const [loteDoAnexo8, loteDoAnexo14, loteDaDca] = [
    primeiro('siope_anexo8'),
    primeiro('siconfi_indices'),
    primeiro('siconfi_funcoes'),
  ];
  const [loteDaBetha] = acoes.length ? await lotesDeMaiorAno(['despesas']) : [];

  const grupos: (Grupo | null)[] = [
    indices.length
      ? {
          id: 'indices',
          rotulo: 'Índices legais: SIOPE × SICONFI',
          explicacao:
            'O valor aplicado em cada índice legal, no Anexo 8 do SIOPE e no Anexo 14 do RREO, no SICONFI. Entra todo ano em que o valor difere, mesmo com o percentual igual. Os demonstrativos não explicam a diferença: aqui ficam os valores.',
          fonteA: fonteDoSiope(loteDoAnexo8),
          fonteB: fonteDoSiconfi(loteDoAnexo14, 'SICONFI, RREO Anexo 14'),
          casos: indices,
        }
      : null,
    gastoTotal.length
      ? {
          id: 'gasto_total',
          rotulo: 'Gasto total com educação: SIOPE × SICONFI',
          explicacao: 'O total liquidado em educação no Anexo 8 do SIOPE e a função 12 da DCA, no SICONFI.',
          fonteA: fonteDoSiope(loteDoAnexo8),
          fonteB: fonteDoSiconfi(loteDaDca, NOME_DA_DCA),
          casos: gastoTotal,
        }
      : null,
    acoes.length && loteDaBetha
      ? {
          id: 'gasto_acoes',
          rotulo: 'Função 12: SICONFI × Betha',
          explicacao:
            'A função 12 da DCA e a soma das ações de educação da Betha 57170, em cada etapa. As etapas não se somam.',
          fonteA: fonteDoSiconfi(loteDaDca, NOME_DA_DCA),
          fonteB: { coluna: 'Betha', lado: 'na Betha', ...fonteDoLote(loteDaBetha, 'Betha, consulta 57170') },
          casos: acoes,
        }
      : null,
  ];
  return { disponivel: true, faltando: [], grupos: grupos.filter(presente) };
}
