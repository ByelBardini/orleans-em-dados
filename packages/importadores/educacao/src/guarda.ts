// A guarda de dados pessoais: registro de educação só carrega os campos do vocabulário, e nada
// com cara de CPF. O erro nomeia o campo, nunca o valor: mensagem de erro vai para log e banco.
export const CAMPOS_DE_VALORES = new Set([
  'id',
  'indicador',
  'lugar',
  'rede',
  'etapa',
  'recorte',
  'periodo',
  'valor',
  'texto',
  'unidade',
]);
export const CAMPOS_DE_FINANCAS = new Set([
  'id',
  'indicador',
  'lugar',
  'rede',
  'recorte',
  'periodo',
  'valor',
  'percentual',
]);

// Com pontos, mascarado como no SIOPE (***.456.789-**) ou em 11 dígitos soltos. `12345678909.12` é dinheiro.
const CPF = /[\d*]{3}\.\d{3}\.\d{3}-[\d*]{2}|(?<![\d.])\d{11}(?![\d.])/;

export const pareceCpf = (texto: string) => CPF.test(texto);

export function recusarDadoPessoal(registro: Record<string, unknown>, campos: ReadonlySet<string>): void {
  for (const [campo, valor] of Object.entries(registro)) {
    if (!campos.has(campo)) throw new Error(`campo desconhecido: ${campo}`);
    if (typeof valor === 'string' && pareceCpf(valor)) throw new Error(`campo ${campo} com padrão de CPF`);
  }
}
