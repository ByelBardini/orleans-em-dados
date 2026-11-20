// O Pix do apoio vem das variáveis de ambiente da API em execução (PIX_CHAVE, PIX_NOME, PIX_CIDADE):
// troca sem rebuild. Sem PIX_CHAVE, o apoio fica desligado, e a página Apoiar não existe.
import { montarBrCode, normalizarChave, normalizarCidade, normalizarNome } from './brcode';

export type ConfigDoApoio = { chave: string; nome: string; cidade: string; copiaECola: string };

type Ambiente = Record<string, string | undefined>;

/** A config do apoio, nula sem `PIX_CHAVE`; erro que nomeia a variável ou cita a chave quando está errada. */
export function lerConfigDoApoio(env: Ambiente): ConfigDoApoio | null {
  const chave = env.PIX_CHAVE?.trim();
  if (!chave) return null;
  const nome = env.PIX_NOME?.trim();
  const cidade = env.PIX_CIDADE?.trim();
  if (!nome) throw new Error('PIX_NOME ausente: com PIX_CHAVE, defina também o nome de quem recebe');
  if (!cidade) throw new Error('PIX_CIDADE ausente: com PIX_CHAVE, defina também a cidade de quem recebe');
  return {
    chave: normalizarChave(chave),
    nome: normalizarNome(nome),
    cidade: normalizarCidade(cidade),
    copiaECola: montarBrCode({ chave, nome, cidade }),
  };
}

/** Na subida: config errada não derruba o site; desliga o apoio e diz o motivo. */
export function apoioDaSubida(env: Ambiente, avisar: (motivo: string) => void): ConfigDoApoio | null {
  try {
    return lerConfigDoApoio(env);
  } catch (erro) {
    avisar(`apoio desligado: ${(erro as Error).message}`);
    return null;
  }
}
