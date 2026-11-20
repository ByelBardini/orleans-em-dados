// O BR Code do Pix estático (EMV QRCPS-MPM), sem valor: o app do banco pede. Campos TLV com o tamanho
// em dois dígitos; o CRC16-CCITT (polinômio 0x1021, início 0xFFFF) é calculado sobre o payload inteiro,
// incluindo o "6304" do próprio campo do CRC, o erro mais comum dos geradores.
// Manual de Padrões para Iniciação do Pix e Manual do BR Code, do Banco Central.

export type DadosDoPix = { chave: string; nome: string; cidade: string };

const GUI_DO_PIX = 'br.gov.bcb.pix';
const MAXIMO_DA_CHAVE = 77; // o campo 26 tem até 99: "0014br.gov.bcb.pix" e "01" + tamanho levam 22.
const MAXIMO_DO_NOME = 25;
const MAXIMO_DA_CIDADE = 15;

/** Um campo TLV: id, tamanho em dois dígitos e o valor. */
export function campo(id: string, valor: string) {
  if (valor.length > 99) throw new Error(`campo ${id} com ${valor.length} caracteres: o máximo é 99`);
  return `${id}${String(valor.length).padStart(2, '0')}${valor}`;
}

/** CRC-16/CCITT-FALSE em quatro dígitos hexadecimais maiúsculos. */
export function crc16(texto: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Sem acento e só ASCII imprimível, com os espaços juntados: o que todo leitor de QR aceita. */
const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const cortar = (texto: string, maximo: number) => texto.slice(0, maximo).trimEnd();

function digitoDoCpf(digitos: string, peso: number) {
  const soma = [...digitos].reduce((total, d, i) => total + Number(d) * (peso - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

function cpfValido(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  return digitoDoCpf(cpf.slice(0, 9), 10) === Number(cpf[9]) && digitoDoCpf(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function digitoDoCnpj(digitos: string) {
  const pesos = digitos.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const resto = [...digitos].reduce((total, d, i) => total + Number(d) * pesos[i]!, 0) % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cnpjValido(cnpj: string) {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  return digitoDoCnpj(cnpj.slice(0, 12)) === Number(cnpj[12]) && digitoDoCnpj(cnpj.slice(0, 13)) === Number(cnpj[13]);
}

/** A chave como o DICT a guarda; recusa o que não é de um dos cinco tipos, dizendo por quê. */
export function normalizarChave(bruta: string) {
  const chave = bruta.trim();
  if (!chave) throw new Error('PIX_CHAVE vazia');
  if (chave.length > MAXIMO_DA_CHAVE) {
    throw new Error(`a chave Pix tem ${chave.length} caracteres; o máximo é ${MAXIMO_DA_CHAVE}`);
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chave)) return chave.toLowerCase();
  if (/^\+55\d{10,11}$/.test(chave)) return chave;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chave)) return chave.toLowerCase();
  const digitos = /^[\d.\-/]+$/.test(chave) ? chave.replace(/\D/g, '') : '';
  if (cpfValido(digitos) || cnpjValido(digitos)) return digitos;
  throw new Error(`a chave Pix "${chave}" não é e-mail, telefone com +55, CPF, CNPJ nem chave aleatória`);
}

/** O nome de quem recebe como vai no código: sem acento, até 25 caracteres. */
export function normalizarNome(nome: string) {
  const normalizado = cortar(semAcento(nome), MAXIMO_DO_NOME);
  if (!normalizado) throw new Error('PIX_NOME vazio depois de tirar acentos e símbolos');
  return normalizado;
}

/** A cidade como vai no código: sem acento, em maiúsculas, até 15 caracteres. */
export function normalizarCidade(cidade: string) {
  const normalizada = cortar(semAcento(cidade).toUpperCase(), MAXIMO_DA_CIDADE);
  if (!normalizada) throw new Error('PIX_CIDADE vazia depois de tirar acentos e símbolos');
  return normalizada;
}

/** O "copia e cola" do Pix estático, sem valor. */
export function montarBrCode({ chave, nome, cidade }: DadosDoPix) {
  const semCrc = [
    campo('00', '01'),
    campo('26', campo('00', GUI_DO_PIX) + campo('01', normalizarChave(chave))),
    campo('52', '0000'),
    campo('53', '986'),
    campo('58', 'BR'),
    campo('59', normalizarNome(nome)),
    campo('60', normalizarCidade(cidade)),
    campo('62', campo('05', '***')),
    '6304',
  ].join('');
  return semCrc + crc16(semCrc);
}
