// GET /api/educacao/aprendizado: alfabetização, IDEB e ENEM, por rede. Falta de dado é nulo, nunca zero.
import { z } from 'zod';
import { camposDaAba, comparacaoSchema, fonteDoBlocoSchema, redeSchema, valoresDaRedeSchema } from '../educacao';

const numeroOuNulo = z.number().nullable();
// A meta de 2030 de SC e do Brasil é texto, `> 80`.
const metaDoLugar = z.union([z.number(), z.string()]).nullable();

// Orleans é a rede municipal, e SC e o Brasil, a pública: a fonte não abre a mesma rede nos três lugares.
const alfabetizacaoSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  redes: z.strictObject({
    orleans: redeSchema.nullable(),
    santaCatarina: redeSchema.nullable(),
    brasil: redeSchema.nullable(),
  }),
  serie: z.array(z.strictObject({ ano: z.string(), valores: valoresDaRedeSchema })),
  metas: z.array(
    z.strictObject({ ano: z.string(), orleans: metaDoLugar, santaCatarina: metaDoLugar, brasil: metaDoLugar }),
  ),
  participacao: valoresDaRedeSchema,
});

// Ano sem dado fica na lista, com `valor` nulo: é a lacuna da linha.
const pontosSchema = z.array(z.strictObject({ ano: z.number(), valor: numeroOuNulo }));

const idebSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  // O arquivo do INEP: o Brasil, SC na rede municipal e as parcelas. Nulo sem a coleta.
  fonteDoInep: fonteDoBlocoSchema.nullable(),
  etapas: z.array(
    z.strictObject({
      etapa: z.string(),
      comparacao: comparacaoSchema,
      series: z.partialRecord(
        redeSchema,
        z.strictObject({ orleans: pontosSchema, santaCatarina: pontosSchema, brasil: pontosSchema }),
      ),
    }),
  ),
  // Prova e aprovação, separadas: o IDEB junta as duas.
  parcelas: z.array(
    z.strictObject({
      lugar: z.enum(['orleans', 'santaCatarina', 'brasil']),
      rede: redeSchema,
      etapa: z.string(),
      ideb: numeroOuNulo,
      rendimento: numeroOuNulo,
      aprovacao: numeroOuNulo,
      matematica: numeroOuNulo,
      portugues: numeroOuNulo,
    }),
  ),
});

const inseSchema = z.strictObject({ ano: z.string(), fonte: fonteDoBlocoSchema, comparacao: comparacaoSchema });

const enemSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  fonteDaTerceiraSerie: fonteDoBlocoSchema.nullable(),
  anos: z.array(
    z.strictObject({
      ano: z.string(),
      // Só as redes de Orleans que a coleta publicou: rede com menos de 2 escolas não tem linha.
      redes: z.array(
        z.strictObject({
          rede: redeSchema,
          escolas: numeroOuNulo,
          inscritos: numeroOuNulo,
          presentes: numeroOuNulo,
          terceiraSerie: numeroOuNulo,
          presentesSobreTerceiraSerie: numeroOuNulo,
        }),
      ),
      comparacoes: z.array(comparacaoSchema),
    }),
  ),
});

export const educacaoAprendizadoSchema = z.strictObject({
  ...camposDaAba,
  alfabetizacao: alfabetizacaoSchema.nullable(),
  ideb: idebSchema.nullable(),
  inse: inseSchema.nullable(),
  enem: enemSchema.nullable(),
});

export type EducacaoAprendizado = z.infer<typeof educacaoAprendizadoSchema>;
