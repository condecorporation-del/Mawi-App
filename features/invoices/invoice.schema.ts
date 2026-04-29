import { InvoiceStatus, InvoiceType } from "@prisma/client";
import { z } from "zod";

export const invoiceIdSchema = z.object({
  id: z.string().uuid(),
});

export const invoiceListSchema = z.object({
  type: z.nativeEnum(InvoiceType),
  status: z.nativeEnum(InvoiceStatus).optional(),
  supplierId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  dueBefore: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const invoiceBaseSchema = z.object({
  type: z.nativeEnum(InvoiceType),
  status: z.nativeEnum(InvoiceStatus).default(InvoiceStatus.pending_review),
  number: z.string().trim().min(1).max(80),
  cfdiUuid: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  totalCents: z.number().int().positive(),
});

export const createInvoiceSchema = invoiceBaseSchema.refine(
  (input) =>
    input.type === InvoiceType.receivable
      ? Boolean(input.clientId) && !input.supplierId
      : Boolean(input.supplierId),
  "Facturas por cobrar requieren cliente; facturas por pagar requieren proveedor.",
);

export const updateInvoiceSchema = invoiceBaseSchema.partial();

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceListInput = z.infer<typeof invoiceListSchema>;
