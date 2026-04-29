import { z } from "zod";

const mexicanRfcSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/, "RFC mexicano invalido.");

export const supplierIdSchema = z.object({
  id: z.string().uuid(),
});

export const supplierListSchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  rfc: mexicanRfcSchema,
  legalName: z.string().trim().min(2).max(200),
  taxRegime: z.string().trim().min(2).max(120),
  paymentTerms: z.string().trim().min(2).max(120),
  email: z.string().email().optional(),
  phone: z.string().trim().max(40).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
