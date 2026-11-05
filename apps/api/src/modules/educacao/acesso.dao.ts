// A fonte não publica a matrícula da etapa por rede: a soma é das folhas `<etapa> > <série> > <rede>`.
// Na educação infantil, a folha já é `Ensino infantil > Creche > <rede>`. Rede sem nenhum valor soma NULL, nunca zero.
import { consultar } from '../../lib/consultas';

export type MatriculaPorRede = { etapa: string; rede: string; valor: number | null };

export const matriculasPorRede = (coletaId: number, localidade: string, periodo: string) =>
  consultar<MatriculaPorRede>(
    `SELECT CASE split_part(categoria, ' > ', 2)
              WHEN 'Ensino infantil' THEN split_part(categoria, ' > ', 3)
              ELSE split_part(categoria, ' > ', 2)
            END AS etapa,
            split_part(categoria, ' > ', 4) AS rede,
            SUM(valor) AS valor
     FROM ibge_valores_publicados
     WHERE coleta_id = $1 AND tabela = 'pesquisa-13' AND localidade = $2 AND periodo = $3
       AND categoria LIKE 'Matrículas > % > % > %'
     GROUP BY 1, 2`,
    [coletaId, localidade, periodo],
  );
