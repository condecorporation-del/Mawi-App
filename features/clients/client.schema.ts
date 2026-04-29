import { z } from "zod";

const mexicanRfcSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/, "RFC mexicano invalido.");

export const clientIdSchema = z.object({
  id: z.string().uuid(),
});

export const clientListSchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const createClientSchema = z.object({
  name: z.string().trim().min(2).max(160),
  rfc: mexicanRfcSchema,
  legalName: z.string().trim().min(2).max(200),
  taxRegime: z.string().trim().max(120).optional(),
  fiscalAddress: z.string().trim().max(500).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().max(40).optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
