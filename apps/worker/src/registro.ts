// Os importadores da plataforma. Fonte nova entra aqui.
import { criarImportadorBetha } from '@orleans-em-dados/importador-betha';
import { criarImportadoresDeEducacao } from '@orleans-em-dados/importador-educacao';
import { criarImportadorIbge } from '@orleans-em-dados/importador-ibge';
import type { Importador } from '@orleans-em-dados/importador-nucleo';
import { criarImportadorSiconfi } from '@orleans-em-dados/importador-siconfi';
import { criarImportadorTcesc } from '@orleans-em-dados/importador-tcesc';

export const criarImportadores = (): Importador[] => [
  criarImportadorBetha(),
  criarImportadorTcesc(),
  criarImportadorIbge(),
  criarImportadorSiconfi(),
  ...criarImportadoresDeEducacao(),
];
