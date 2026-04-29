import "server-only";

import type { InvoiceType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type TenantContext = { tenantId: string; userId: string };

type InvoiceQuery = Record<string, string | string[] | undefined> & {
  type: InvoiceType;
};

export async function listInvoices(ctx: TenantContext, query: InvoiceQuery) {
  const rows = await prisma.invoice.findMany({
    where: { tenantId: ctx.tenantId, type: query.type, deletedAt: null },
    include: {
      client: { select: { name: true } },
      supplier: { select: { name: true } },
      project: { select: { name: true } },
      payments: { select: { amountCents: true } },
    },
    orderBy: { issueDate: "desc" },
    take: 50,
  });

  return rows.map((r) => {
    const paidCents = r.payments.reduce((sum, p) => sum + p.amountCents, 0);
    const { payments, ...rest } = r;
    return { ...rest, paidCents, currency: "MXN" as const };
  });
}
