import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

import type { ToolDefinition } from "./types";

const getProjectBalanceInputSchema = z.object({
  projectId: z.string().uuid(),
});

const getProjectBalanceOutputSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string(),
  currency: z.literal("MXN"),
  budgetCents: z.number().int(),
  expenseCents: z.number().int(),
  receivableCents: z.number().int(),
  payableCents: z.number().int(),
  netCashFlowCents: z.number().int(),
  varianceCents: z.number().int(),
  source: z.literal("prisma.project+expense+invoice"),
  period: z.object({
    from: z.null(),
    to: z.null(),
    timezone: z.literal("America/Mexico_City"),
  }),
});

export const getProjectBalanceTool: ToolDefinition<
  z.infer<typeof getProjectBalanceInputSchema>,
  z.infer<typeof getProjectBalanceOutputSchema>
> = {
  name: "finance.get_project_balance",
  description: "Consulta balance financiero actual de un proyecto.",
  inputSchema: getProjectBalanceInputSchema,
  outputSchema: getProjectBalanceOutputSchema,
  riskLevel: "low",
  requiredPermissions: ["agent.chat"],
  requiresConfirmation: false,
  auditEvent: "agent.tool.finance_get_project_balance.executed",
  version: "1.0.0",
  async execute(context, input) {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        tenantId: context.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        budgetCents: true,
      },
    });

    if (!project) {
      throw new Error("Proyecto no encontrado.");
    }

    const [expenseAgg, receivableAgg, payableAgg] = await Promise.all([
      prisma.expense.aggregate({
        where: {
          tenantId: context.tenantId,
          projectId: project.id,
          deletedAt: null,
        },
        _sum: { totalCents: true },
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId: context.tenantId,
          projectId: project.id,
          type: "receivable",
          deletedAt: null,
        },
        _sum: { totalCents: true },
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId: context.tenantId,
          projectId: project.id,
          type: "payable",
          deletedAt: null,
        },
        _sum: { totalCents: true },
      }),
    ]);

    const expenseCents = expenseAgg._sum.totalCents ?? 0;
    const receivableCents = receivableAgg._sum.totalCents ?? 0;
    const payableCents = payableAgg._sum.totalCents ?? 0;

    return {
      projectId: project.id,
      projectName: project.name,
      currency: "MXN",
      budgetCents: project.budgetCents,
      expenseCents,
      receivableCents,
      payableCents,
      netCashFlowCents: receivableCents - payableCents,
      varianceCents: project.budgetCents - expenseCents,
      source: "prisma.project+expense+invoice",
      period: {
        from: null,
        to: null,
        timezone: "America/Mexico_City",
      },
    };
  },
};
