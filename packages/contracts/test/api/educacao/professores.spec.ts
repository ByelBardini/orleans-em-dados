import { describe, expect, it } from 'vitest';
import { educacaoProfessoresSchema } from '../../../src/api';

const indisponivel = {
  disponivel: false,
  faltando: ['inep_turmas'],
  turmas: null,
  horas: null,
  formacao: null,
  docentesSuperior: null,
  regularidade: null,
  alunosPorDocente: null,
  temporarios: null,
  remuneracao: null,
  rais: null,
};

const FONTE = { nome: 'SIOPE', url: 'https://siope.exemplo' };
const comProfissionais = (profissionais: unknown) => ({
  ...indisponivel,
  temporarios: {
    fonte: FONTE,
    anos: [
      {
        periodo: '2026-05',
        magisterio: { cargaTemporaria: 40, profissionais },
        outros: { cargaTemporaria: null, profissionais: null },
      },
    ],
  },
});

describe('educacaoProfessoresSchema', () => {
  it('todo bloco é nulável, e a resposta sem coleta passa', () => {
    expect(educacaoProfessoresSchema.parse(indisponivel).faltando).toEqual(['inep_turmas']);
  });

  it('bloco ausente é recusado: sem coleta é nulo, não some da resposta', () => {
    const { rais: _rais, ...semRais } = indisponivel;

    expect(educacaoProfessoresSchema.safeParse(semRais).error?.issues[0]?.path).toEqual(['rais']);
  });

  it('campo a mais é recusado: nada de nome ou escola passa pelo contrato', () => {
    expect(educacaoProfessoresSchema.safeParse({ ...indisponivel, escola: 'x' }).success).toBe(false);
  });

  it.each([[120], ['menos de 5'], [null]])('profissionais aceita %s', (valor) => {
    expect(educacaoProfessoresSchema.safeParse(comProfissionais(valor)).success).toBe(true);
  });

  it('a RAIS recusa uma rede fora da municipal e da pública', () => {
    const rais = {
      ano: '2021',
      fonte: FONTE,
      linhas: [{ lugar: 'orleans', rede: 'privada', mediaPor40h: 1, docentes: 1 }],
    };

    expect(educacaoProfessoresSchema.safeParse({ ...indisponivel, rais }).success).toBe(false);
  });
});
