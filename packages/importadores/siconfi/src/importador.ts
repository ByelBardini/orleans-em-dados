// O importador do SICONFI: despesa por função (DCA Anexo I-E, validada contra a linha de total do
// próprio anexo; a conferência com o TCE-SC é em packages/db/src/conferencia) e índices legais de
// educação (RREO Anexo 14 do último bimestre).
import { centavos, deCentavos } from '@orleans-em-dados/contracts';
import { tabelas } from '@orleans-em-dados/db';
import type {
  Coleta,
  ConsultaImportada,
  Importador,
  ItemDeConferencia,
  Validacao,
} from '@orleans-em-dados/importador-nucleo';
import { SiconfiClienteHttp, type ClienteSiconfi } from './cliente';
import { SICONFI, SICONFI_RREO } from './config';
import {
  INDICADORES_DO_RREO,
  normalizarConta,
  normalizarIndice,
  registroDoItem,
  registrosDosIndices,
  type LinhaDeFuncao,
  type LinhaDeIndice,
} from './normalizar';

// Só as três etapas fecham com a soma das funções; a inscrição de restos a pagar fica guardada, sem validação.
const ETAPAS_VALIDADAS = ['empenhado', 'liquidado', 'pago'];

// A DCA do exercício é entregue até 30 de abril do ano seguinte. O RREO do 6º bimestre vence antes,
// em 30 de janeiro (LRF, art. 52), e entra na mesma rodada: os índices do exercício chegam junto com
// a DCA, de maio em diante, sem mudar os anos que ela já atualiza.
const ULTIMO_MES_SEM_A_DCA = 3; // abril, com janeiro = 0

function validar(_coleta: Coleta, linhas: readonly LinhaDeFuncao[]): Validacao {
  const conferencia: ItemDeConferencia[] = [];
  const erros: string[] = [];
  for (const etapa of ETAPAS_VALIDADAS) {
    const daEtapa = linhas.filter((l) => l.etapa === etapa);
    const total = daEtapa.find((l) => l.tipo === 'total');
    if (!total) {
      erros.push(`${etapa}: a DCA não tem a linha de total`);
      continue;
    }
    const calculado = daEtapa.filter((l) => l.tipo === 'funcao').reduce((s, l) => s + centavos(l.valor), 0n);
    const fonte = centavos(total.valor);
    const diferenca = deCentavos(calculado - fonte);
    conferencia.push({
      campo: `total_${etapa}`,
      titulo: total.conta,
      descricao: 'Soma das funções = linha de total do Anexo I-E',
      fonte: total.valor,
      calculado: deCentavos(calculado),
      diferenca,
    });
    if (calculado !== fonte) erros.push(`${etapa}: a soma das funções difere do total em ${diferenca}`);
  }
  return { conferencia, erros };
}

function consultaDeFuncoes(cliente: ClienteSiconfi): ConsultaImportada<LinhaDeFuncao> {
  return {
    id: 900201,
    chave: 'siconfi_funcoes',
    tabela: tabelas.siconfiFuncoes,
    async coletar({ ano }) {
      const itens = await cliente.anexo(ano);
      const fora = new Set(itens.map((i) => i.exercicio).filter((exercicio) => exercicio !== ano));
      return {
        filtro: { an_exercicio: ano, no_anexo: SICONFI.anexo, id_ente: SICONFI.ente },
        totalHits: itens.length,
        registros: itens.map(registroDoItem),
        erros: [...fora].map((exercicio) => `item do exercício ${String(exercicio)} na coleta de ${ano}`),
      };
    },
    normalizar: normalizarConta,
    validar,
  };
}

// Ano sem a linha (2018 vem vazio, 2019 não a traz) é lote rejeitado, não falha: nada é publicado e a
// rodada segue. Não há total a conferir: o Anexo 14 é simplificado e só traz o valor e o percentual.
function validarIndices(_coleta: Coleta, linhas: readonly LinhaDeIndice[]): Validacao {
  const erros: string[] = [];
  for (const indicador of INDICADORES_DO_RREO) {
    const quantas = linhas.filter((l) => l.indicador === indicador).length;
    if (quantas === 0) erros.push(`${indicador}: o Anexo 14 não traz a linha`);
    if (quantas > 1) erros.push(`${indicador}: o Anexo 14 traz ${quantas} linhas`);
  }
  return { conferencia: [], erros };
}

function consultaDeIndices(cliente: ClienteSiconfi): ConsultaImportada<LinhaDeIndice> {
  return {
    id: 900202,
    chave: 'siconfi_indices',
    tabela: tabelas.educacaoFinancas,
    async coletar({ ano }) {
      const itens = await cliente.rreo(ano);
      const { registros, erros } = registrosDosIndices(itens);
      const fora = new Set(
        itens
          .filter((i) => i.exercicio !== ano || i.periodo !== SICONFI_RREO.periodo)
          .map((i) => `item do exercício ${String(i.exercicio)} e período ${String(i.periodo)} na coleta de ${ano}`),
      );
      return {
        filtro: {
          an_exercicio: ano,
          nr_periodo: SICONFI_RREO.periodo,
          co_tipo_demonstrativo: SICONFI_RREO.demonstrativo,
          no_anexo: SICONFI_RREO.anexo,
          id_ente: SICONFI.ente,
        },
        totalHits: registros.length,
        registros,
        erros: [...fora, ...erros],
      };
    },
    normalizar: normalizarIndice,
    validar: validarIndices,
  };
}

export function criarImportadorSiconfi({
  cliente = new SiconfiClienteHttp(),
}: { cliente?: ClienteSiconfi } = {}): Importador {
  return {
    id: 'siconfi',
    fonte: 'siconfi',
    agenda: '0 6 5 * *',
    // Retificação do exercício anterior ainda pode chegar.
    anosDaRodada: (agora) => {
      const ano = agora.getUTCFullYear();
      const ultimo = agora.getUTCMonth() > ULTIMO_MES_SEM_A_DCA ? ano - 1 : ano - 2;
      return [ultimo, ultimo - 1];
    },
    consultas: [consultaDeFuncoes(cliente), consultaDeIndices(cliente)],
  };
}
