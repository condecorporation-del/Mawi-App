import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const createPaymentSchema = z.object({
  tenantId: z.string().uuid().optional(),
  invoiceId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  paidAt: z.string().datetime(),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.transfer),
  reference: z.string().trim().max(120).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
