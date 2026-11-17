// O primeiro exercício que cada consulta publica na fonte, pela chave do catálogo (`consultas.chave`).
// Sondado no Farol do TCE-SC em 16/11/2026: o painel não tem receitas antes de 2018 nem empenhos
// antes de 2023. A carga não pede o que a fonte não publica, e a tela diz que a fonte não publica.
// Se o Farol abrir anos antigos, muda só aqui.
export const PRIMEIRO_EXERCICIO: Readonly<Record<string, number>> = {
  tcesc_receitas: 2018,
  tcesc_empenhos: 2023,
};
