import "server-only";

import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import type { CreatePaymentInput } from "@/features/payments/payment.schema";
import { ActorType } from "@prisma/client";

type ServiceContext = { tenantId: string; userId: string };

export async function registerPayment(
  ctx: ServiceContext,
  input: CreatePaymentInput,
) {
  const payment = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: input.invoiceId, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!invoice) {
      const { DomainError } = await import("@/lib/errors/domain-error");
      throw new DomainError("Factura no encontrada.", 404);
    }

    const created = await tx.payment.create({
      data: {
        tenantId: ctx.tenantId,
        invoiceId: input.invoiceId,
        amountCents: input.amountCents,
        paidAt: new Date(input.paidAt),
        method: input.method,
        reference: input.reference,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });

    return created;
  });

  await createAuditLog({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    actorType: ActorType.user,
    entityType: "payment",
    entityId: payment.id,
    action: "payment.create",
    after: { amountCents: payment.amountCents, method: payment.method },
  });

  return payment;
}
