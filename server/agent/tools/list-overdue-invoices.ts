import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

import type { ToolDefinition } from "./types";

const listOverdueInvoicesInputSchema = z.object({
  type: z.enum(["payable", "receivable"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const listOverdueInvoicesOutputSchema = z.object({
  currency: z.literal("MXN"),
  source: z.literal("prisma.invoice"),
  period: z.object({
    from: z.null(),
    to: z.string().datetime(),
    timezone: z.literal("America/Mexico_City"),
  }),
  invoices: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.enum(["payable", "receivable"]),
      number: z.string(),
      totalCents: z.number().int(),
      dueDate: z.string().datetime().nullable(),
      projectName: z.string().nullable(),
      supplierName: z.string().nullable(),
      clientName: z.string().nullable(),
    }),
  ),
});

export const listOverdueInvoicesTool: ToolDefinition<
  z.infer<typeof listOverdueInvoicesInputSchema>,
  z.infer<typeof listOverdueInvoicesOutputSchema>
> = {
  name: "finance.list_overdue_invoices",
  description: "Lista cuentas por pagar/cobrar vencidas del tenant.",
  inputSchema: listOverdueInvoicesInputSchema,
  outputSchema: listOverdueInvoicesOutputSchema,
  riskLevel: "low",
  requiredPermissions: ["agent.chat"],
  requiresConfirmation: false,
  auditEvent: "agent.tool.finance_list_overdue_invoices.executed",
  version: "1.0.0",
  async execute(context, input) {
    const now = new Date();
    const limit = input.limit ?? 25;
    const rows = await prisma.invoice.findMany({
      where: {
        tenantId: context.tenantId,
        deletedAt: null,
        dueDate: { lt: now },
        status: { notIn: ["paid", "cancelled"] },
        ...(input.type ? { type: input.type } : {}),
      },
      select: {
        id: true,
        type: true,
        number: true,
        totalCents: true,
        dueDate: true,
        project: { select: { name: true } },
        supplier: { select: { name: true } },
        client: { select: { name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: limit,
    });

    return {
      currency: "MXN",
      source: "prisma.invoice",
      period: {
        from: null,
        to: now.toISOString(),
        timezone: "America/Mexico_City",
      },
      invoices: rows.map((row) => ({
        id: row.id,
        type: row.type,
        number: row.number,
        totalCents: row.totalCents,
        dueDate: row.dueDate?.toISOString() ?? null,
        projectName: row.project?.name ?? null,
        supplierName: row.supplier?.name ?? null,
        clientName: row.client?.name ?? null,
      })),
    };
  },
};
