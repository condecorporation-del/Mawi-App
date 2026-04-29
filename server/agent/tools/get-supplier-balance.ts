import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

import type { ToolDefinition } from "./types";

const getSupplierBalanceInputSchema = z.object({
  supplierId: z.string().uuid(),
});

const getSupplierBalanceOutputSchema = z.object({
  supplierId: z.string().uuid(),
  supplierName: z.string(),
  currency: z.literal("MXN"),
  payableTotalCents: z.number().int(),
  payableOverdueCents: z.number().int(),
  expenseTotalCents: z.number().int(),
  source: z.literal("prisma.supplier+invoice+expense"),
  period: z.object({
    from: z.null(),
    to: z.null(),
    timezone: z.literal("America/Mexico_City"),
  }),
});

export const getSupplierBalanceTool: ToolDefinition<
  z.infer<typeof getSupplierBalanceInputSchema>,
  z.infer<typeof getSupplierBalanceOutputSchema>
> = {
  name: "finance.get_supplier_balance",
  description: "Consulta balance de egresos y cuentas por pagar de un proveedor.",
  inputSchema: getSupplierBalanceInputSchema,
  outputSchema: getSupplierBalanceOutputSchema,
  riskLevel: "low",
  requiredPermissions: ["supplier.manage", "invoice.manage", "expense.manage"],
  requiresConfirmation: false,
  auditEvent: "agent.tool.finance_get_supplier_balance.executed",
  version: "1.0.0",
  async execute(context, input) {
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: input.supplierId,
        tenantId: context.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!supplier) {
      throw new Error("Proveedor no encontrado.");
    }

    const now = new Date();
    const [payableTotalAgg, payableOverdueAgg, expenseTotalAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          tenantId: context.tenantId,
          supplierId: supplier.id,
          type: "payable",
          deletedAt: null,
        },
        _sum: { totalCents: true },
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId: context.tenantId,
          supplierId: supplier.id,
          type: "payable",
          deletedAt: null,
          dueDate: { lt: now },
          status: { notIn: ["paid", "cancelled"] },
        },
        _sum: { totalCents: true },
      }),
      prisma.expense.aggregate({
        where: {
          tenantId: context.tenantId,
          supplierId: supplier.id,
          deletedAt: null,
        },
        _sum: { totalCents: true },
      }),
    ]);

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      currency: "MXN",
      payableTotalCents: payableTotalAgg._sum.totalCents ?? 0,
      payableOverdueCents: payableOverdueAgg._sum.totalCents ?? 0,
      expenseTotalCents: expenseTotalAgg._sum.totalCents ?? 0,
      source: "prisma.supplier+invoice+expense",
      period: {
        from: null,
        to: null,
        timezone: "America/Mexico_City",
      },
    };
  },
};
