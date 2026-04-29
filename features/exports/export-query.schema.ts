import { z } from "zod";

export const EXPORT_TYPES = [
  "expenses",
  "payable_invoices",
  "receivable_invoices",
] as const;

export type ExportType = (typeof EXPORT_TYPES)[number];

const MAX_EXPORT_DAYS = 366;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const exportQuerySchema = z
  .object({
    type: z.enum(EXPORT_TYPES),
    from: z.string().regex(DATE_REGEX, "Formato inválido. Use YYYY-MM-DD."),
    to: z.string().regex(DATE_REGEX, "Formato inválido. Use YYYY-MM-DD."),
  })
  .refine(
    ({ from, to }) => new Date(from).getTime() < new Date(to).getTime(),
    { message: "La fecha fin debe ser posterior a la de inicio." },
  )
  .refine(
    ({ from, to }) => {
      const diffMs = new Date(to).getTime() - new Date(from).getTime();
      return diffMs <= MAX_EXPORT_DAYS * 24 * 60 * 60 * 1000;
    },
    { message: `El rango máximo de exportación es ${MAX_EXPORT_DAYS} días.` },
  );

export type ExportQuery = z.infer<typeof exportQuerySchema>;
