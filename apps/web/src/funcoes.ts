// A regra de Para onde vai, sem DOM: o que mudou na série, a régua da divisão e a linha de cada função.
import type { FuncoesSerie } from '@orleans-em-dados/contracts';
import { umaCasa } from './comparacao';

export type Etapa = 'empenhado' | 'liquidado' | 'pago';
type AnoDaSerie = FuncoesSerie['anos'][number];

const emPorcento = (v: number) => `${umaCasa(v)}%`;
// Participação vem com duas casas: compara e soma em centésimos, sem erro de ponto flutuante.
const emCentesimos = (v: number) => Math.round(v * 100);

type Ponto = { ano: number; participacao: number };

function pontosPorFuncao(anos: readonly AnoDaSerie[], etapa: Etapa) {
  const funcoes = new Map<string, { codigo: string; nome: string; pontos: Ponto[] }>();
  for (const { ano, funcoes: doAno } of anos) {
    for (const { codigo, nome, participacao } of doAno) {
      const valor = participacao[etapa];
      if (valor === null) continue;
      const funcao = funcoes.get(codigo) ?? { codigo, nome, pontos: [] };
      funcao.pontos.push({ ano, participacao: valor });
      funcoes.set(codigo, funcao);
    }
  }
  return [...funcoes.values()];
}

function aMaior<T>(itens: readonly T[], medida: (item: T) => number): T | null {
  return itens.reduce<T | null>((melhor, item) => (!melhor || medida(item) > medida(melhor) ? item : melhor), null);
}

export type Mudanca = { codigo: string; nome: string; frase: string };

// Três leituras da série, sempre calculadas: a maior alta do período, a maior queda entre os dois últimos anos e a
// função que mais oscilou. Sem o que dizer, a leitura não aparece.
export function oQueMudou(anos: readonly AnoDaSerie[], etapa: Etapa): Mudanca[] {
  if (anos.length < 2) return [];
  const primeiro = anos[0]!.ano;
  const ultimo = anos.at(-1)!.ano;
  const penultimo = anos.at(-2)!.ano;
  const funcoes = pontosPorFuncao(anos, etapa);
  const entre = (de: number, ate: number) =>
    funcoes.flatMap((funcao) => {
      const inicio = funcao.pontos.find((p) => p.ano === de);
      const fim = funcao.pontos.find((p) => p.ano === ate);
      return inicio && fim
        ? [{ ...funcao, inicio, fim, variacao: emCentesimos(fim.participacao) - emCentesimos(inicio.participacao) }]
        : [];
    });

  const mudancas: Mudanca[] = [];
  const alta = aMaior(entre(primeiro, ultimo), (f) => f.variacao);
  if (alta && alta.variacao > 0) {
    mudancas.push({
      codigo: alta.codigo,
      nome: alta.nome,
      frase: `passou de ${emPorcento(alta.inicio.participacao)} do total em ${primeiro} para ${emPorcento(alta.fim.participacao)} em ${ultimo}, a maior alta do período.`,
    });
  }
  const queda = aMaior(entre(penultimo, ultimo), (f) => -f.variacao);
  if (queda && queda.variacao < 0) {
    mudancas.push({
      codigo: queda.codigo,
      nome: queda.nome,
      frase: `caiu de ${emPorcento(queda.inicio.participacao)} em ${penultimo} para ${emPorcento(queda.fim.participacao)} em ${ultimo}, a maior queda de um ano para o outro.`,
    });
  }
  if (anos.length > 2) {
    const oscilacoes = funcoes.map((funcao) => {
      const menor = aMaior(funcao.pontos, (p) => -p.participacao)!;
      const maior = aMaior(funcao.pontos, (p) => p.participacao)!;
      return {
        ...funcao,
        menor,
        maior,
        amplitude: emCentesimos(maior.participacao) - emCentesimos(menor.participacao),
      };
    });
    const oscilou = aMaior(oscilacoes, (f) => f.amplitude);
    if (oscilou && oscilou.amplitude > 0) {
      mudancas.push({
        codigo: oscilou.codigo,
        nome: oscilou.nome,
        frase: `foi a que mais oscilou: de ${emPorcento(oscilou.menor.participacao)} em ${oscilou.menor.ano} a ${emPorcento(oscilou.maior.participacao)} em ${oscilou.maior.ano}.`,
      });
    }
  }
  return mudancas;
}

const FAIXAS_DA_REGUA = 6;

export type FaixaDaRegua = { chave: string; nome: string; participacao: number; tom: 'destaque' | 'normal' | 'outras' };

/** Recebe as funções em ordem. As seis maiores têm faixa própria, e as outras dividem uma; sozinha, ela não se junta. */
export function reguaDasFuncoes(
  funcoes: readonly { codigo: string; nome: string; participacao: number }[],
): FaixaDaRegua[] {
  const cabem = funcoes.length <= FAIXAS_DA_REGUA + 1 ? funcoes.length : FAIXAS_DA_REGUA;
  const faixas: FaixaDaRegua[] = funcoes.slice(0, cabem).map((f, i) => ({
    chave: f.codigo,
    nome: f.nome,
    participacao: f.participacao,
    tom: i < 2 ? 'destaque' : 'normal',
  }));
  const resto = funcoes.slice(cabem);
  if (!resto.length) return faixas;
  const soma = resto.reduce((total, f) => total + emCentesimos(f.participacao), 0);
  return [
    ...faixas,
    { chave: 'outras', nome: `Outras ${resto.length} funções`, participacao: soma / 100, tom: 'outras' },
  ];
}

const LARGURA_DA_LINHA = 200;
const ALTURA_DA_LINHA = 36;
const ALTURA_MINIMA_EM_PONTOS = 2;

// Cada linha tem a própria escala, com altura mínima: variação de décimos não vira um salto.
export function linhaDaParticipacao(valores: readonly (number | null)[]) {
  const presentes = valores.filter((v) => v !== null);
  if (!presentes.length) return { pontos: '', ultimo: null };
  const menor = Math.min(...presentes);
  const maior = Math.max(...presentes);
  const altura = Math.max(maior - menor, ALTURA_MINIMA_EM_PONTOS);
  const base = (menor + maior) / 2 - altura / 2;
  const coordenadas = valores.flatMap((v, i) =>
    v === null
      ? []
      : [
          {
            x: valores.length > 1 ? (i / (valores.length - 1)) * LARGURA_DA_LINHA : LARGURA_DA_LINHA,
            y: ALTURA_DA_LINHA - ((v - base) / altura) * ALTURA_DA_LINHA,
          },
        ],
  );
  const ultimo = coordenadas.at(-1)!;
  return {
    pontos: coordenadas.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
    ultimo: { esquerda: (ultimo.x / LARGURA_DA_LINHA) * 100, topo: (ultimo.y / ALTURA_DA_LINHA) * 100 },
  };
}
