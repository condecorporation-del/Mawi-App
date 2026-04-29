import "server-only";

import { prisma } from "@/lib/db/prisma";

type TenantContext = { tenantId: string; userId: string };

export async function listExpenses(
  ctx: TenantContext,
  _query: Record<string, string | string[] | undefined>,
) {
  const rows = await prisma.expense.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    include: {
      project: { select: { name: true } },
      supplier: { select: { name: true } },
    },
    orderBy: { expenseDate: "desc" },
    take: 50,
  });

  return rows.map((r) => ({ ...r, currency: "MXN" as const }));
}
