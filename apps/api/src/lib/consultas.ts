// O que os DAOs da API compartilham. As agregações são feitas no PostgreSQL (NUMERIC exato).
import { pool } from '@orleans-em-dados/db';

export const consultar = async <T = Record<string, unknown>>(sql: string, params: unknown[]) =>
  (await pool.query(sql, params)).rows as T[];

export const ENTIDADE = `json_build_object('nome', en.nome, 'sigla', en.sigla, 'status', en.status_mapeamento)`;

// Alguns textos chegam da Betha sem os caracteres acentuados ("SERVIO", "GUA").
// Removendo tudo que não é A-Z/0-9 das duas grafias, elas viram a mesma chave;
// o nome exibido é a grafia mais frequente do grupo.
export const chaveTexto = (coluna: string) => `regexp_replace(upper(${coluna}), '[^A-Z0-9 ]', '', 'g')`;
