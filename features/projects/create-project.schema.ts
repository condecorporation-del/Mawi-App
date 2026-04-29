import { z } from "zod";

export const createProjectFormSchema = z.object({
  code: z.string().trim().min(1, "El codigo es obligatorio.").max(40),
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
  description: z.string().trim().max(2000).optional().transform((v) => (v === "" ? undefined : v)),
  budgetPesos: z.coerce.number().finite().min(0, "El presupuesto no puede ser negativo."),
});

export type CreateProjectFormInput = z.infer<typeof createProjectFormSchema>;

export function budgetPesosToCents(pesos: number): number {
  return Math.round(pesos * 100);
}
