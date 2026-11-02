// O importador dos painéis municipais do Farol TCE-SC (Qlik Engine API): receitas e
// empenhos, conferidos contra o total calculado pelo próprio motor. A coleta confere
// também que só os dois filtros pedidos estão ativos e que o app não recarregou no meio.
import { centavos, deCentavos, dinheiro } from '@orleans-em-dados/contracts';
import { tabelas } from '@orleans-em-dados/db';
import type {
  Coleta,
  ConsultaImportada,
  Importador,
  ItemDeConferencia,
  RegistroBruto,
  Validacao,
} from '@orleans-em-dados/importador-nucleo';
import { centavosDoMotor, textoDaCelula, type CelulaQlik } from './celulas';
import { CUBO_EMPENHOS, CUBO_RECEITAS, TCESC, type ConsultaDoCubo } from './config';
import { normalizarEmpenho, normalizarReceita } from './normalizar';
import { QlikSessao, type CuboQlik, type SessaoQlik } from './sessao-qlik';

type AbrirSessao = (appId: string) => Promise<SessaoQlik>;

const ordenar = (selecoes: Record<string, string[]>) => JSON.stringify(Object.entries(selecoes).sort());

async function lerCubo(cubo: ConsultaDoCubo, ano: number, abrirSessao: AbrirSessao, erros: string[]) {
  const sessao = await abrirSessao(TCESC.apps[cubo.app].id);
  try {
    const antes = await sessao.infoApp();
    await sessao.limparSelecoes();
    await sessao.selecionar(cubo.filtroEnte, TCESC.municipio);
    await sessao.selecionar(cubo.filtroAno, String(ano));

    // Exatamente os dois filtros pedidos, com um valor cada.
    const selecoes = await sessao.selecoes();
    const esperado = { [cubo.filtroEnte]: [TCESC.municipio], [cubo.filtroAno]: [String(ano)] };
    if (ordenar(selecoes) !== ordenar(esperado)) erros.push(`seleções inesperadas: ${JSON.stringify(selecoes)}`);

    const dados = await sessao.hipercubo({ dimensoes: cubo.dimensoes, medidas: cubo.medidas.map((m) => m.expr) });
    const depois = await sessao.infoApp();
    if (antes.ultimaRecarga !== depois.ultimaRecarga) {
      erros.push(`app recarregado durante a coleta (${antes.ultimaRecarga} → ${depois.ultimaRecarga})`);
    }
    return { dados, selecoes, ultimaRecarga: depois.ultimaRecarga };
  } finally {
    sessao.fechar();
  }
}

// Medida somada vira texto decimal; célula vazia é ausência, não zero.
function montarRegistros(cubo: ConsultaDoCubo, dados: CuboQlik, erros: string[]) {
  const nd = cubo.dimensoes.length;
  const camposAusentes = Object.fromEntries(cubo.medidas.map((m) => [m.campo, 0]));
  const registros = dados.linhas.map((linha) => {
    const dims = linha.slice(0, nd).map(textoDaCelula);
    const registro: RegistroBruto = { id: dims.map((d) => d ?? '').join('|') };
    cubo.dimensoes.forEach((d, i) => (registro[d] = dims[i]));
    cubo.medidas.forEach((medida, i) => {
      const celula = linha[nd + i] as CelulaQlik;
      if (!medida.soma) {
        registro[medida.campo] = textoDaCelula(celula);
      } else {
        const c = centavosDoMotor(celula.qNum);
        if (c === null && textoDaCelula(celula) !== null) {
          erros.push(`valor não monetário em ${medida.campo}: ${celula.qText}`);
        }
        registro[medida.campo] = c === null ? null : deCentavos(c);
      }
      if (registro[medida.campo] === null) camposAusentes[medida.campo]! += 1;
    });
    return registro;
  });
  return { registros, camposAusentes };
}

const validarContraOMotor =
  (cubo: ConsultaDoCubo) =>
  (coleta: Coleta): Validacao => {
    const totais = (coleta.extras as { totais: CelulaQlik[] }).totais;
    const erros: string[] = [];
    const conferencia = cubo.medidas.flatMap((medida, i): ItemDeConferencia[] => {
      if (!medida.soma) return [];
      const soma = coleta.registros.reduce((total, registro) => {
        const v = registro[medida.campo] as string | null | undefined;
        return v === null || v === undefined ? total : total + centavos(dinheiro(v));
      }, 0n);
      const fonte = centavosDoMotor(totais[i]?.qNum);
      const base = { campo: medida.campo, titulo: medida.expr, calculado: deCentavos(soma) };
      if (fonte === null) {
        erros.push(`total do motor ausente para ${medida.campo}`);
        return [{ ...base, fonte: null, diferenca: null }];
      }
      const diferenca = deCentavos(soma - fonte);
      if (soma !== fonte) erros.push(`${medida.campo}: soma das linhas difere do total do motor (${diferenca})`);
      return [
        {
          ...base,
          descricao: 'Total geral do hipercubo no motor Qlik',
          fonte: deCentavos(fonte),
          diferenca,
        },
      ];
    });
    return { conferencia, erros };
  };

function consultaDoCubo(
  cubo: ConsultaDoCubo,
  declaracao: Pick<ConsultaImportada, 'id' | 'chave' | 'tabela' | 'normalizar'>,
  abrirSessao: AbrirSessao,
): ConsultaImportada {
  return {
    ...declaracao,
    async coletar({ ano }) {
      const erros: string[] = [];
      const { dados, selecoes, ultimaRecarga } = await lerCubo(cubo, ano, abrirSessao, erros);
      const { registros, camposAusentes } = montarRegistros(cubo, dados, erros);
      return {
        filtro: {
          appId: TCESC.apps[cubo.app].id,
          selecoes: { [cubo.filtroEnte]: TCESC.municipio, [cubo.filtroAno]: String(ano) },
          selecoesConfirmadas: selecoes,
          dimensoes: cubo.dimensoes,
          medidas: cubo.medidas.map((m) => m.expr),
          ultimaRecargaApp: ultimaRecarga,
        },
        totalHits: dados.linhasTotal,
        registros,
        camposAusentes,
        erros,
        extras: { totais: dados.totais },
      };
    },
    validar: validarContraOMotor(cubo),
  };
}

export function criarImportadorTcesc({
  abrirSessao = QlikSessao.abrir,
}: { abrirSessao?: AbrirSessao } = {}): Importador {
  return {
    id: 'tcesc',
    fonte: 'tcesc',
    agenda: '0 4 * * *',
    // O exercício anterior ainda aceita retificação.
    anosDaRodada: (agora) => [agora.getUTCFullYear(), agora.getUTCFullYear() - 1],
    consultas: [
      consultaDoCubo(
        CUBO_RECEITAS,
        { id: 900001, chave: 'receitas', tabela: tabelas.tcescReceitas, normalizar: normalizarReceita },
        abrirSessao,
      ),
      consultaDoCubo(
        CUBO_EMPENHOS,
        { id: 900002, chave: 'empenhos', tabela: tabelas.tcescEmpenhos, normalizar: normalizarEmpenho },
        abrirSessao,
      ),
    ],
  };
}
