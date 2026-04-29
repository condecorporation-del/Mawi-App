import { InvoiceStatus, PaymentMethod } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { NotFoundError, DomainError } from "@/lib/errors/domain-error";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  invoiceId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  paidAt: z.string().datetime(),
  method: z.enum(["transfer", "check", "cash", "credit_card", "other"]).optional(),
  reference: z.string().trim().max(200).optional(),
});

const confirmationRequiredSchema = z.object({
  status: z.literal("confirmation_required"),
  summary: z.string(),
  confirmationToken: z.string().uuid(),
});

const successSchema = z.object({
  status: z.literal("executed"),
  paymentId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  amountCents: z.number().int(),
  invoiceStatus: z.string(),
  idempotencyKey: z.string(),
});

const outputSchema = z.union([confirmationRequiredSchema, successSchema]);

export const markInvoicePaidTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "invoice.mark_paid",
  description: "Marca una factura como pagada y registra el pago. Requiere confirmación. Aplica a facturas por cobrar y por pagar.",
  inputSchema,
  outputSchema,
  riskLevel: "high",
  requiredPermissions: ["invoice.manage", "payment.create"],
  requiresConfirmation: true,
  auditEvent: "agent.tool.invoice_mark_paid.executed",
  version: "1.0.0",
  async execute(context, input) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, tenantId: context.tenantId, deletedAt: null },
      select: { id: true, status: true, totalCents: true },
    });
    if (!invoice) throw new NotFoundError("Factura no encontrada.");
    if (invoice.status === InvoiceStatus.paid) {
      throw new DomainError("La factura ya está marcada como pagada.", 409);
    }

    const existingPayment = await prisma.payment.findFirst({
      where: {
        tenantId: context.tenantId,
        invoiceId: input.invoiceId,
        deletedAt: null,
      },
      select: { id: true, amountCents: true },
    });

    if (existingPayment) {
      return {
        status: "executed",
        paymentId: existingPayment.id,
        invoiceId: input.invoiceId,
        amountCents: existingPayment.amountCents,
        invoiceStatus: InvoiceStatus.paid,
        idempotencyKey: input.idempotencyKey,
      };
    }

    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          tenantId: context.tenantId,
          invoiceId: input.invoiceId,
          amountCents: input.amountCents,
          paidAt: new Date(input.paidAt),
          method: (input.method ?? "transfer") as PaymentMethod,
          reference: input.reference,
          createdBy: context.userId,
          updatedBy: context.userId,
        },
        select: { id: true },
      }),
      prisma.invoice.update({
        where: { id: input.invoiceId },
        data: { status: InvoiceStatus.paid, updatedBy: context.userId },
      }),
    ]);

    return {
      status: "executed",
      paymentId: payment.id,
      invoiceId: input.invoiceId,
      amountCents: input.amountCents,
      invoiceStatus: InvoiceStatus.paid,
      idempotencyKey: input.idempotencyKey,
    };
  },
};
