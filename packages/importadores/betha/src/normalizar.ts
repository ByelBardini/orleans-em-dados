// Registro bruto da Betha → linha da tabela. Dinheiro vira texto decimal, sem passar
// por soma de float; ausência continua nula. O id é `<exercício>:<entidade>:<registro>`,
// com sufixo `_<mês>` na 57153: o mês é inferido daí, semântica ainda não confirmada.
import { codigoRubrica, dinheiro, type Dinheiro } from '@orleans-em-dados/contracts';
import type { RegistroBruto } from '@orleans-em-dados/importador-nucleo';

const valor = (v: unknown): Dinheiro | null => (v === null || v === undefined ? null : dinheiro(v as string | number));

function entidadeDoId(id: string): string {
  const entidade = id.split(':')[1];
  if (!entidade) throw new Error(`Id sem entidade: ${id}; esperado <exercício>:<entidade>:<registro>`);
  return entidade;
}

function textoObrigatorio(registro: RegistroBruto, campo: string): string {
  const texto = registro[campo];
  if (typeof texto !== 'string') throw new Error(`Campo ${campo} ausente em ${registro.id}`);
  return texto;
}

function mesDoId(id: string): number | null {
  const sufixo = id.split('_')[1];
  if (!sufixo) return null;
  const mes = Number(sufixo);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12)
    throw new Error(`Mês inválido no id ${id}; esperado sufixo _1 a _12`);
  return mes;
}

export function normalizarReceita(r: RegistroBruto) {
  return {
    idExterno: r.id,
    entidadeCodigo: entidadeDoId(r.id),
    idRubricaBetha: r.id.split('_')[0] as string,
    mes: mesDoId(r.id),
    rubrica: codigoRubrica(r.rubricaNatureza),
    descricao: textoObrigatorio(r, 'descricaoNatureza'),
    valorOrcado: valor(r.valorOrcado),
    valorOrcadoDeducoes: valor(r.valorOrcadoDeducoes),
    valorOrcadoAtualizado: valor(r.valorOrcadoAtualizado),
    valorLancadoMes: valor(r.valorLancadoNoMes),
    valorArrecadadoMes: valor(r.valorArrecadadoNoMes),
    valorArrecadadoAteMes: valor(r.valorArrecadadoAteMes),
    // Percentual, não dinheiro: o NUMERIC(10,2) do banco arredonda.
    percentualRealizado:
      r.percentualRealizado === null || r.percentualRealizado === undefined ? null : String(r.percentualRealizado),
  };
}

export function normalizarEmpenho(r: RegistroBruto) {
  const numero = r.numeroEmpenho;
  if (!Number.isInteger(numero)) throw new Error(`Número de empenho inválido em ${r.id}: ${String(numero)}`);
  const credor = r.credor as { nomeCredor?: string | null } | null | undefined;
  return {
    idExterno: r.id,
    entidadeCodigo: entidadeDoId(r.id),
    numero: numero as number,
    dataEmpenho: (r.dataEmpenho as string | null | undefined) ?? null,
    orgao: (r.descricaoOrgao as string | null | undefined) ?? null,
    credor: credor?.nomeCredor ?? null,
    historico: (r.historicoEmpenho as string | null | undefined) ?? null,
    valorEmpenho: valor(r.valorEmpenho),
    valorLiquidado: valor(r.valorLiquidadoEmpenho),
    valorPago: valor(r.valorPagoEmpenho),
    saldoAPagar: valor(r.saldoAPagar),
  };
}

export function normalizarDespesa(r: RegistroBruto) {
  return {
    idExterno: r.id,
    entidadeCodigo: entidadeDoId(r.id),
    natureza: textoObrigatorio(r, 'idNatureza'),
    acaoNumero: (r.numero as string | null | undefined) ?? null,
    acao: (r.descricao as string | null | undefined) ?? null,
    valorOrcado: valor(r.valorOrcado),
    valorOrcadoAtualizado: valor(r.valorOrcadoAtualizado),
    valorEmpenhado: valor(r.valorEmpenhadoAtualizado),
    valorLiquidado: valor(r.valorLiquidadoAtualizado),
    valorPago: valor(r.valorPagoAtualizado),
  };
}
