// Registro bruto do TCE-SC → linha da tabela. Os valores já chegam da coleta como
// texto decimal conferido; ausência continua nula.
import { dinheiro, type Dinheiro } from '@orleans-em-dados/contracts';
import type { RegistroBruto } from '@orleans-em-dados/importador-nucleo';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const valor = (v: unknown): Dinheiro | null => (v === null || v === undefined ? null : dinheiro(v as string));
const texto = (v: unknown) => (v as string | null | undefined) ?? null;

function obrigatorio(r: RegistroBruto, campo: string): string {
  const v = r[campo];
  if (typeof v !== 'string') throw new Error(`Campo ${campo} ausente em ${r.id}`);
  return v;
}

function mesDoNome(nome: string): number {
  const indice = MESES.indexOf(nome);
  if (indice < 0) throw new Error(`Mês desconhecido: ${nome}; esperado ${MESES.join(', ')}`);
  return indice + 1;
}

export function normalizarReceita(r: RegistroBruto) {
  return {
    idExterno: r.id,
    unidade: obrigatorio(r, 'nomeunidade'),
    codigo: obrigatorio(r, 'codigoreceita'),
    natureza: texto(r.natureza),
    tipoDeducao: texto(r.descricaotipodeducaoreceita), // nulo = receita bruta
    mes: mesDoNome(obrigatorio(r, 'Mês')),
    valorArrecadado: dinheiro(obrigatorio(r, 'valorArrecadado')),
  };
}

function numeroDoEmpenho(r: RegistroBruto): number | null {
  const numero = r.numero;
  if (numero === null || numero === undefined) return null;
  if (!/^\d+$/.test(String(numero))) throw new Error(`Número de empenho inválido em ${r.id}: ${String(numero)}`);
  return Number(numero);
}

export function normalizarEmpenho(r: RegistroBruto) {
  return {
    idExterno: r.id,
    codigoUg: obrigatorio(r, 'codigoUG'),
    numero: numeroDoEmpenho(r),
    dataEmpenho: texto(r.dataEmpenho),
    credor: texto(r.credor),
    historico: texto(r.historico),
    valorOriginal: valor(r.valorOriginal),
    valorReforco: valor(r.valorReforco),
    valorEstorno: valor(r.valorEstorno),
    valorEmpenhado: valor(r.valorEmpenhado),
    valorLiquidado: valor(r.valorLiquidado),
    valorPago: valor(r.valorPago),
  };
}
